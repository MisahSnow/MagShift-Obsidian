const {
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	normalizePath,
	requestUrl,
} = require("obsidian");

const MANAGED_BLOCK_START = "<!-- github-releases-sync:start -->";
const MANAGED_BLOCK_END = "<!-- github-releases-sync:end -->";

const DEFAULT_SETTINGS = {
	repository: "",
	targetFile: "GitHub Releases.md",
	commitTargetFile: "GitHub Commit Log.md",
	includePrereleases: false,
	maxReleases: 10,
	maxCommits: 25,
	autoSyncOnStartup: true,
	syncIntervalMinutes: 60,
	githubToken: "",
};

function parseRepository(input) {
	const trimmed = String(input || "").trim();
	if (!trimmed) {
		throw new Error("GitHub repository is required.");
	}

	const withoutGitSuffix = trimmed.replace(/\.git$/i, "");
	if (/^https?:\/\//i.test(withoutGitSuffix)) {
		let url;
		try {
			url = new URL(withoutGitSuffix);
		} catch (error) {
			throw new Error("GitHub repository URL is invalid.");
		}

		if (!/^(www\.)?github\.com$/i.test(url.hostname)) {
			throw new Error("Repository URL must point to github.com.");
		}

		const segments = url.pathname.split("/").filter(Boolean);
		if (segments.length < 2) {
			throw new Error("Repository URL must include owner and repository name.");
		}

		return {
			owner: segments[0],
			repo: segments[1],
		};
	}

	const match = withoutGitSuffix.match(/^([\w.-]+)\/([\w.-]+)$/);
	if (!match) {
		throw new Error("Use either owner/repo or a full GitHub repository URL.");
	}

	return {
		owner: match[1],
		repo: match[2],
	};
}

function clampCount(value, fallback) {
	const numericValue = Number(value);
	if (!Number.isFinite(numericValue)) {
		return fallback;
	}

	return Math.max(1, Math.min(100, Math.round(numericValue)));
}

function formatIsoDate(dateString) {
	if (!dateString) {
		return "Unknown date";
	}

	const parsed = new Date(dateString);
	if (Number.isNaN(parsed.getTime())) {
		return "Unknown date";
	}

	return parsed.toISOString().slice(0, 10);
}

function formatSyncTimestamp(date) {
	const parsed = date instanceof Date ? date : new Date(date);
	if (Number.isNaN(parsed.getTime())) {
		return "Unknown sync time";
	}

	return `${parsed.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function escapeMarkdownTableCell(value) {
	return String(value || "")
		.replace(/\r?\n/g, " ")
		.replace(/\|/g, "\\|")
		.trim();
}

function summarizeReleaseBody(body) {
	if (!body) {
		return "";
	}

	const firstMeaningfulLine = String(body)
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find((line) => line && !/^#+\s/.test(line));

	if (!firstMeaningfulLine) {
		return "";
	}

	const cleaned = firstMeaningfulLine
		.replace(/[*_`~]/g, "")
		.replace(/\[(.*?)\]\((.*?)\)/g, "$1");

	if (cleaned.length <= 120) {
		return cleaned;
	}

	return `${cleaned.slice(0, 117).trimEnd()}...`;
}

function summarizeCommitMessage(message) {
	const firstLine = String(message || "")
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find(Boolean);

	if (!firstLine) {
		return "No commit message";
	}

	return firstLine.length <= 100 ? firstLine : `${firstLine.slice(0, 97).trimEnd()}...`;
}

function getCommitAuthor(commit) {
	if (commit?.author?.login) {
		return commit.author.login;
	}

	if (commit?.commit?.author?.name) {
		return commit.commit.author.name;
	}

	return "Unknown";
}

function buildReleaseDocument(repositoryLabel, releases) {
	const syncedAt = new Date();
	const sourceUrl = `https://github.com/${repositoryLabel}/releases`;
	const lines = [
		"## GitHub Releases",
		"",
		`Repository: [${repositoryLabel}](${sourceUrl})`,
		`Updated: ${formatSyncTimestamp(syncedAt)}`,
		`Showing: ${releases.length} release${releases.length === 1 ? "" : "s"}`,
		"",
	];

	if (!releases.length) {
		lines.push("> No releases matched the current settings.");
	} else {
		lines.push("| Release | Tag | Published | Type | Summary |");
		lines.push("| --- | --- | --- | --- | --- |");

		for (const release of releases) {
			const published = formatIsoDate(release.published_at);
			const displayName = escapeMarkdownTableCell(
				String(
					release.name || release.tag_name || release.html_url || "Untitled release",
				).replace(/\r?\n/g, " "),
			);
			const tagName = escapeMarkdownTableCell(release.tag_name || "");
			const releaseType = release.prerelease ? "Pre-release" : "Release";
			const summary = escapeMarkdownTableCell(summarizeReleaseBody(release.body));
			lines.push(
				`| [${displayName}](${release.html_url}) | \`${tagName}\` | ${published} | ${releaseType} | ${summary || " "} |`,
			);
		}
	}

	return lines.join("\n");
}

function buildCommitDocument(repositoryLabel, commits) {
	const syncedAt = new Date();
	const sourceUrl = `https://github.com/${repositoryLabel}/commits`;
	const lines = [
		"## GitHub Commit Log",
		"",
		`Repository: [${repositoryLabel}](${sourceUrl})`,
		`Updated: ${formatSyncTimestamp(syncedAt)}`,
		`Showing: ${commits.length} commit${commits.length === 1 ? "" : "s"}`,
		"",
	];

	if (!commits.length) {
		lines.push("> No commits matched the current settings.");
	} else {
		lines.push("| Commit | Date | Author | Message |");
		lines.push("| --- | --- | --- | --- |");

		for (const commit of commits) {
			const shortSha = escapeMarkdownTableCell(String(commit.sha || "").slice(0, 7));
			const commitUrl = commit.html_url || sourceUrl;
			const commitDate = formatIsoDate(commit?.commit?.author?.date);
			const author = escapeMarkdownTableCell(getCommitAuthor(commit));
			const message = escapeMarkdownTableCell(
				summarizeCommitMessage(commit?.commit?.message),
			);
			lines.push(
				`| [\`${shortSha}\`](${commitUrl}) | ${commitDate} | ${author} | ${message} |`,
			);
		}
	}

	return lines.join("\n");
}

function wrapManagedBlock(content) {
	return [MANAGED_BLOCK_START, content, MANAGED_BLOCK_END].join("\n");
}

function stripManagedBlock(content) {
	const text = String(content || "");
	const startIndex = text.indexOf(MANAGED_BLOCK_START);
	const endIndex = text.indexOf(MANAGED_BLOCK_END);
	if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
		return text.trim();
	}

	const before = text.slice(0, startIndex).trim();
	const after = text.slice(endIndex + MANAGED_BLOCK_END.length).trim();
	return [before, after].filter(Boolean).join("\n\n").trim();
}

function upsertManagedBlock(existingContent, newBlock) {
	const content = String(existingContent || "");
	const startIndex = content.indexOf(MANAGED_BLOCK_START);
	const endIndex = content.indexOf(MANAGED_BLOCK_END);

	if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
		const before = content.slice(0, startIndex).replace(/\s*$/, "");
		const after = content.slice(endIndex + MANAGED_BLOCK_END.length).replace(/^\s*/, "");
		const parts = [];

		if (before) {
			parts.push(before);
		}
		parts.push(newBlock);
		if (after) {
			parts.push(after);
		}
		return `${parts.join("\n\n")}\n`;
	}

	if (!content.trim()) {
		return `${newBlock}\n`;
	}

	return `${content.replace(/\s*$/, "")}\n\n${newBlock}\n`;
}

function shouldReplaceEntireNote(existingContent) {
	const content = String(existingContent || "");
	if (!content.trim()) {
		return true;
	}

	if (!content.includes(MANAGED_BLOCK_START) || !content.includes(MANAGED_BLOCK_END)) {
		return false;
	}

	return !stripManagedBlock(content);
}

function isGeneratedPageContent(existingContent, markdown) {
	const existing = String(existingContent || "").trim();
	const next = String(markdown || "").trim();
	if (!existing || !next) {
		return false;
	}

	if (existing === next) {
		return true;
	}

	const existingFirstLine = existing.split(/\r?\n/, 1)[0].trim();
	const nextFirstLine = next.split(/\r?\n/, 1)[0].trim();
	return Boolean(existingFirstLine && existingFirstLine === nextFirstLine);
}

function hasFileExtension(path) {
	const lastSegment = String(path || "").split("/").filter(Boolean).pop() || "";
	return /\.[^./\\]+$/.test(lastSegment);
}

module.exports = class GitHubReleasesSyncPlugin extends Plugin {
	async onload() {
		this.syncPromise = null;
		this.syncIntervalId = null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

		this.addCommand({
			id: "sync-github-pages",
			name: "Sync GitHub pages",
			callback: () => {
				void this.syncAll(true);
			},
		});

		this.addCommand({
			id: "sync-github-releases",
			name: "Sync GitHub releases page",
			callback: () => {
				void this.syncReleases(true);
			},
		});

		this.addCommand({
			id: "sync-github-commit-log",
			name: "Sync GitHub commit log page",
			callback: () => {
				void this.syncCommitLog(true);
			},
		});

		this.addRibbonIcon("sync", "Sync GitHub pages", () => {
			void this.syncAll(true);
		});

		this.addSettingTab(new GitHubReleasesSettingTab(this.app, this));
		this.refreshAutoSyncTimer();

		if (this.settings.autoSyncOnStartup && this.settings.repository.trim()) {
			void this.syncAll(false);
		}
	}

	onunload() {
		this.clearAutoSyncTimer();
	}

	async saveSettings() {
		this.settings.maxReleases = clampCount(
			this.settings.maxReleases,
			DEFAULT_SETTINGS.maxReleases,
		);
		this.settings.maxCommits = clampCount(
			this.settings.maxCommits,
			DEFAULT_SETTINGS.maxCommits,
		);
		this.settings.targetFile = normalizePath(
			String(this.settings.targetFile || DEFAULT_SETTINGS.targetFile).trim() ||
				DEFAULT_SETTINGS.targetFile,
		);
		this.settings.commitTargetFile = normalizePath(
			String(
				this.settings.commitTargetFile || DEFAULT_SETTINGS.commitTargetFile,
			).trim() || DEFAULT_SETTINGS.commitTargetFile,
		);

		await this.saveData(this.settings);
		this.refreshAutoSyncTimer();
	}

	clearAutoSyncTimer() {
		if (this.syncIntervalId !== null) {
			window.clearInterval(this.syncIntervalId);
			this.syncIntervalId = null;
		}
	}

	refreshAutoSyncTimer() {
		this.clearAutoSyncTimer();

		const minutes = Number(this.settings.syncIntervalMinutes);
		if (!this.settings.repository.trim() || !Number.isFinite(minutes) || minutes <= 0) {
			return;
		}

		this.syncIntervalId = window.setInterval(() => {
			void this.syncAll(false);
		}, minutes * 60 * 1000);
	}

	async syncAll(showSuccessNotice) {
		if (this.syncPromise) {
			return this.syncPromise;
		}

		this.syncPromise = this.performSync(showSuccessNotice, "all")
			.then(() => true)
			.catch((error) => {
				const message =
					error instanceof Error && error.message
						? error.message
						: "Failed to sync GitHub pages.";
				console.error("GitHub Releases Sync:", error);
				new Notice(message);
				return false;
			})
			.finally(() => {
				this.syncPromise = null;
			});

		return this.syncPromise;
	}

	async syncReleases(showSuccessNotice) {
		return this.performIndependentSync(showSuccessNotice, "releases");
	}

	async syncCommitLog(showSuccessNotice) {
		return this.performIndependentSync(showSuccessNotice, "commits");
	}

	async performIndependentSync(showSuccessNotice, mode) {
		try {
			await this.performSync(showSuccessNotice, mode);
			return true;
		} catch (error) {
			const message =
				error instanceof Error && error.message
					? error.message
					: `Failed to sync GitHub ${mode === "releases" ? "releases" : "commit log"}.`;
			console.error("GitHub Releases Sync:", error);
			new Notice(message);
			return false;
		}
	}

	async performSync(showSuccessNotice, mode) {
		const repository = parseRepository(this.settings.repository);
		const repositoryLabel = `${repository.owner}/${repository.repo}`;

		if (mode === "releases") {
			const releases = await this.fetchReleases(repository.owner, repository.repo);
			const filteredReleases = this.filterReleases(releases);
			const file = await this.upsertTargetNote(
				this.settings.targetFile,
				buildReleaseDocument(repositoryLabel, filteredReleases),
			);

			if (showSuccessNotice) {
				new Notice(`Synced ${filteredReleases.length} releases to ${file.path}`);
			}
			return;
		}

		if (mode === "commits") {
			const commits = await this.fetchCommits(repository.owner, repository.repo);
			const filteredCommits = this.filterCommits(commits);
			const file = await this.upsertTargetNote(
				this.settings.commitTargetFile,
				buildCommitDocument(repositoryLabel, filteredCommits),
			);

			if (showSuccessNotice) {
				new Notice(`Synced ${filteredCommits.length} commits to ${file.path}`);
			}
			return;
		}

		const [releases, commits] = await Promise.all([
			this.fetchReleases(repository.owner, repository.repo),
			this.fetchCommits(repository.owner, repository.repo),
		]);
		const filteredReleases = this.filterReleases(releases);
		const filteredCommits = this.filterCommits(commits);
		const [releasesFile, commitsFile] = await Promise.all([
			this.upsertTargetNote(
				this.settings.targetFile,
				buildReleaseDocument(repositoryLabel, filteredReleases),
			),
			this.upsertTargetNote(
				this.settings.commitTargetFile,
				buildCommitDocument(repositoryLabel, filteredCommits),
			),
		]);

		if (showSuccessNotice) {
			new Notice(
				`Synced ${filteredReleases.length} releases to ${releasesFile.path} and ${filteredCommits.length} commits to ${commitsFile.path}`,
			);
		}
	}

	getGitHubHeaders() {
		const headers = {
			Accept: "application/vnd.github+json",
			"User-Agent": "Obsidian-GitHub-Releases-Sync",
		};

		if (this.settings.githubToken.trim()) {
			headers.Authorization = `Bearer ${this.settings.githubToken.trim()}`;
		}

		return headers;
	}

	async fetchGitHubJson(url, missingArrayMessage) {
		const response = await requestUrl({
			url,
			method: "GET",
			headers: this.getGitHubHeaders(),
			throw: false,
		});

		if (response.status >= 400) {
			let message = `GitHub API returned ${response.status}.`;
			const errorMessage = response.json && response.json.message;
			if (errorMessage) {
				message += ` ${errorMessage}`;
			}
			throw new Error(message);
		}

		if (!Array.isArray(response.json)) {
			throw new Error(missingArrayMessage);
		}

		return response.json;
	}

	async fetchReleases(owner, repo) {
		const url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`;
		return this.fetchGitHubJson(url, "GitHub API response did not contain a releases array.");
	}

	async fetchCommits(owner, repo) {
		const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100`;
		return this.fetchGitHubJson(url, "GitHub API response did not contain a commits array.");
	}

	filterReleases(releases) {
		const filtered = releases.filter((release) => {
			if (!release || release.draft) {
				return false;
			}
			if (!this.settings.includePrereleases && release.prerelease) {
				return false;
			}
			return Boolean(release.html_url);
		});

		return filtered.slice(
			0,
			clampCount(this.settings.maxReleases, DEFAULT_SETTINGS.maxReleases),
		);
	}

	filterCommits(commits) {
		const filtered = commits.filter((commit) => Boolean(commit && commit.sha));
		return filtered.slice(
			0,
			clampCount(this.settings.maxCommits, DEFAULT_SETTINGS.maxCommits),
		);
	}

	async upsertTargetNote(targetPath, markdown) {
		const normalizedPath = await this.resolveTargetFilePath(targetPath, markdown);
		await this.ensureFolderForPath(normalizedPath);

		const existing = this.app.vault.getAbstractFileByPath(normalizedPath);
		if (existing instanceof TFile) {
			const currentContent = await this.app.vault.read(existing);
			const updatedContent =
				shouldReplaceEntireNote(currentContent) ||
				isGeneratedPageContent(currentContent, markdown)
				? `${markdown}\n`
				: upsertManagedBlock(currentContent, wrapManagedBlock(markdown));
			await this.app.vault.modify(existing, updatedContent);
			return existing;
		}

		if (existing) {
			throw new Error(`Target path is not a file: ${normalizedPath}`);
		}

		return this.app.vault.create(normalizedPath, `${markdown}\n`);
	}

	async resolveTargetFilePath(targetPath, markdown) {
		const normalizedInput = normalizePath(String(targetPath || "").trim());
		if (!normalizedInput) {
			throw new Error("Target note path is required.");
		}

		const existing = this.app.vault.getAbstractFileByPath(normalizedInput);
		if (existing && !(existing instanceof TFile)) {
			const defaultFileName = markdown.startsWith("## GitHub Commit Log")
				? DEFAULT_SETTINGS.commitTargetFile.split("/").pop()
				: DEFAULT_SETTINGS.targetFile.split("/").pop();
			return normalizePath(`${normalizedInput}/${defaultFileName}`);
		}

		if (!existing && /[\\/]$/.test(String(targetPath || ""))) {
			const defaultFileName = markdown.startsWith("## GitHub Commit Log")
				? DEFAULT_SETTINGS.commitTargetFile.split("/").pop()
				: DEFAULT_SETTINGS.targetFile.split("/").pop();
			return normalizePath(`${normalizedInput}/${defaultFileName}`);
		}

		if (!hasFileExtension(normalizedInput)) {
			return `${normalizedInput}.md`;
		}

		return normalizedInput;
	}

	async ensureFolderForPath(filePath) {
		const normalized = normalizePath(filePath);
		const segments = normalized.split("/");
		segments.pop();

		let current = "";
		for (const segment of segments) {
			current = current ? `${current}/${segment}` : segment;
			if (!current) {
				continue;
			}

			const existing = this.app.vault.getAbstractFileByPath(current);
			if (!existing) {
				await this.app.vault.createFolder(current);
			}
		}
	}
};

class GitHubReleasesSettingTab extends PluginSettingTab {
	constructor(app, plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "GitHub Sync Pages" });

		new Setting(containerEl)
			.setName("Repository")
			.setDesc("GitHub repository URL or owner/repo.")
			.addText((text) =>
				text
					.setPlaceholder("obsidianmd/obsidian-releases")
					.setValue(this.plugin.settings.repository)
					.onChange(async (value) => {
						this.plugin.settings.repository = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Releases note")
			.setDesc("Note path or existing folder for the generated releases note.")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.targetFile)
					.setValue(this.plugin.settings.targetFile)
					.onChange(async (value) => {
						this.plugin.settings.targetFile = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Commit log note")
			.setDesc("Note path or existing folder for the generated commit log note.")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.commitTargetFile)
					.setValue(this.plugin.settings.commitTargetFile)
					.onChange(async (value) => {
						this.plugin.settings.commitTargetFile = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Maximum releases")
			.setDesc("How many releases to keep in the releases page.")
			.addText((text) =>
				text
					.setPlaceholder(String(DEFAULT_SETTINGS.maxReleases))
					.setValue(String(this.plugin.settings.maxReleases))
					.onChange(async (value) => {
						this.plugin.settings.maxReleases = clampCount(
							value,
							DEFAULT_SETTINGS.maxReleases,
						);
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		new Setting(containerEl)
			.setName("Maximum commits")
			.setDesc("How many commits to keep in the commit log page.")
			.addText((text) =>
				text
					.setPlaceholder(String(DEFAULT_SETTINGS.maxCommits))
					.setValue(String(this.plugin.settings.maxCommits))
					.onChange(async (value) => {
						this.plugin.settings.maxCommits = clampCount(
							value,
							DEFAULT_SETTINGS.maxCommits,
						);
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		new Setting(containerEl)
			.setName("Include pre-releases")
			.setDesc("Include GitHub pre-releases in the releases page.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.includePrereleases).onChange(async (value) => {
					this.plugin.settings.includePrereleases = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Sync on startup")
			.setDesc("Refresh both generated pages when Obsidian starts.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoSyncOnStartup).onChange(async (value) => {
					this.plugin.settings.autoSyncOnStartup = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Sync interval (minutes)")
			.setDesc("Set to 0 to disable background syncing.")
			.addText((text) =>
				text
					.setPlaceholder(String(DEFAULT_SETTINGS.syncIntervalMinutes))
					.setValue(String(this.plugin.settings.syncIntervalMinutes))
					.onChange(async (value) => {
						const numericValue = Number(value);
						this.plugin.settings.syncIntervalMinutes = Number.isFinite(numericValue)
							? Math.max(0, Math.round(numericValue))
							: DEFAULT_SETTINGS.syncIntervalMinutes;
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		new Setting(containerEl)
			.setName("GitHub token")
			.setDesc("Optional personal access token for private repos or higher rate limits.")
			.addText((text) =>
				text
					.setPlaceholder("ghp_...")
					.setValue(this.plugin.settings.githubToken)
					.onChange(async (value) => {
						this.plugin.settings.githubToken = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Sync all now")
			.setDesc("Fetch releases and commits immediately and update both notes.")
			.addButton((button) =>
				button.setButtonText("Sync").setCta().onClick(async () => {
					await this.plugin.syncAll(true);
				}),
			);
	}
}
