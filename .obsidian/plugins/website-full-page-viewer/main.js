const {
	ItemView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} = require("obsidian");
const { shell } = require("electron");

const VIEW_TYPE_WEBSITE_FULL_PAGE = "website-full-page-view";
const WEBVIEW_PARTITION = "persist:website-full-page-viewer";

const DEFAULT_SETTINGS = {
	homeUrl: "https://obsidian.md",
	showToolbar: true,
	openInNewLeaf: true,
};

function normalizeUrl(input) {
	const trimmed = String(input || "").trim();
	if (!trimmed) {
		throw new Error("Website URL is required.");
	}

	const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
		? trimmed
		: `https://${trimmed}`;

	let parsed;
	try {
		parsed = new URL(withProtocol);
	} catch (error) {
		throw new Error("Website URL is invalid.");
	}

	if (!/^https?:$/i.test(parsed.protocol)) {
		throw new Error("Only http and https URLs are supported.");
	}

	return parsed.toString();
}

function getBrowserLikeUserAgent() {
	return navigator.userAgent
		.replace(/\sElectron\/[^\s]+/gi, "")
		.replace(/\sObsidian\/[^\s]+/gi, "")
		.trim();
}

function sanitizeShortcutName(input) {
	const cleaned = String(input || "")
		.replace(/[\\/:*?"<>|]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return cleaned || "Website Shortcut";
}

function buildShortcutPath(folderPath, name) {
	const safeName = sanitizeShortcutName(name);
	return folderPath ? `${folderPath}/${safeName}.website` : `${safeName}.website`;
}

class WebsiteUrlModal extends Modal {
	constructor(app, initialUrl, onSubmit) {
		super(app);
		this.initialUrl = initialUrl || "";
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Open Website" });
		contentEl.createEl("p", {
			text: "Enter a website URL to open it in a full-page Obsidian view.",
		});

		let currentValue = this.initialUrl;
		const input = contentEl.createEl("input", {
			attr: {
				type: "text",
				placeholder: "https://example.com",
			},
		});
		input.addClass("website-full-page-input");
		input.value = currentValue;
		input.focus();
		input.select();

		const openWebsite = () => {
			try {
				const url = normalizeUrl(currentValue);
				this.close();
				this.onSubmit(url);
			} catch (error) {
				new Notice(error.message || "Invalid website URL.");
			}
		};

		input.addEventListener("input", (event) => {
			currentValue = event.target.value;
		});
		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				openWebsite();
			}
		});

		const buttonRow = contentEl.createDiv({ cls: "website-full-page-modal-actions" });
		const openButton = buttonRow.createEl("button", { text: "Open" });
		openButton.addClass("mod-cta");
		openButton.addEventListener("click", openWebsite);

		const cancelButton = buttonRow.createEl("button", { text: "Cancel" });
		cancelButton.addEventListener("click", () => this.close());
	}
}

class WebsiteShortcutModal extends Modal {
	constructor(app, initialName, initialUrl, onSubmit) {
		super(app);
		this.initialName = initialName || "";
		this.initialUrl = initialUrl || "";
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Create Website Shortcut" });

		let currentName = this.initialName;
		let currentUrl = this.initialUrl;

		const nameInput = contentEl.createEl("input", {
			attr: {
				type: "text",
				placeholder: "Shortcut name",
			},
		});
		nameInput.addClass("website-full-page-input");
		nameInput.value = currentName;

		const urlInput = contentEl.createEl("input", {
			attr: {
				type: "text",
				placeholder: "https://example.com",
			},
		});
		urlInput.addClass("website-full-page-input");
		urlInput.value = currentUrl;
		urlInput.focus();
		urlInput.select();

		const submit = () => {
			try {
				this.onSubmit({
					name: sanitizeShortcutName(currentName),
					url: normalizeUrl(currentUrl),
				});
				this.close();
			} catch (error) {
				new Notice(error.message || "Could not create website shortcut.");
			}
		};

		nameInput.addEventListener("input", (event) => {
			currentName = event.target.value;
		});
		urlInput.addEventListener("input", (event) => {
			currentUrl = event.target.value;
		});
		urlInput.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				submit();
			}
		});

		const buttonRow = contentEl.createDiv({ cls: "website-full-page-modal-actions" });
		const createButton = buttonRow.createEl("button", { text: "Create" });
		createButton.addClass("mod-cta");
		createButton.addEventListener("click", submit);

		const cancelButton = buttonRow.createEl("button", { text: "Cancel" });
		cancelButton.addEventListener("click", () => this.close());
	}
}

class WebsiteFullPageView extends ItemView {
	constructor(leaf, plugin) {
		super(leaf);
		this.plugin = plugin;
		this.currentUrl = "";
		this.currentFile = null;
	}

	getViewType() {
		return VIEW_TYPE_WEBSITE_FULL_PAGE;
	}

	getDisplayText() {
		return "Website Viewer";
	}

	getIcon() {
		return "globe";
	}

	async onOpen() {
		this.currentUrl = "";
		this.currentFile = null;
		this.containerEl.addClass("website-full-page-root");
		await this.render();
	}

	async onClose() {
		this.contentEl.empty();
	}

	async setState(state, result) {
		this.currentFile =
			state?.file && this.app.vault.getAbstractFileByPath(state.file) instanceof TFile
				? state.file
				: null;
		const url = this.currentFile
			? await this.plugin.readShortcutUrl(this.currentFile)
			: state?.url
				? normalizeUrl(state.url)
				: this.plugin.settings.homeUrl;
		this.currentUrl = url;
		await this.render();
		return result;
	}

	getState() {
		const state = {};
		if (this.currentFile) {
			state.file = this.currentFile;
		}
		state.url = this.currentUrl || this.plugin.settings.homeUrl;
		return state;
	}

	async render() {
		this.contentEl.empty();

		const wrapper = this.contentEl.createDiv({ cls: "website-full-page-wrapper" });
		if (this.plugin.settings.showToolbar) {
			this.renderToolbar(wrapper);
		}

		if (this.currentFile) {
			const fileBadge = wrapper.createDiv({ cls: "website-full-page-shortcut-badge" });
			fileBadge.setText(`Shortcut: ${this.currentFile}`);
		}

		this.renderBrowser(wrapper);
	}

	renderToolbar(parent) {
		const toolbar = parent.createDiv({ cls: "website-full-page-toolbar" });
		const input = toolbar.createEl("input", {
			attr: {
				type: "text",
				placeholder: "https://example.com",
			},
		});
		input.addClass("website-full-page-address");
		input.value = this.currentUrl || this.plugin.settings.homeUrl;

		const navigate = async () => {
			try {
				this.currentUrl = normalizeUrl(input.value);
				await this.plugin.openUrlInLeaf(this.currentUrl, this.leaf);
			} catch (error) {
				new Notice(error.message || "Invalid website URL.");
			}
		};

		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				void navigate();
			}
		});

		const openButton = toolbar.createEl("button", { text: "Go" });
		openButton.addClass("mod-cta");
		openButton.addEventListener("click", () => {
			void navigate();
		});

		const reloadButton = toolbar.createEl("button", { text: "Reload" });
		reloadButton.addEventListener("click", () => {
			void this.render();
		});

		const externalButton = toolbar.createEl("button", { text: "Open in Browser" });
		externalButton.addEventListener("click", () => {
			void this.plugin.openExternalUrl(this.currentUrl || this.plugin.settings.homeUrl);
		});
	}

	renderBrowser(parent) {
		const browserFrame = parent.createDiv({ cls: "website-full-page-browser" });
		const url = this.currentUrl || this.plugin.settings.homeUrl;

		if (navigator.userAgent.includes("Electron")) {
			const webview = document.createElement("webview");
			webview.className = "website-full-page-webview";
			webview.setAttribute("src", url);
			webview.setAttribute("allowpopups", "");
			webview.setAttribute("partition", WEBVIEW_PARTITION);
			webview.setAttribute("useragent", getBrowserLikeUserAgent());
			webview.setAttribute("webpreferences", "contextIsolation=yes");
			browserFrame.appendChild(webview);
			return;
		}

		const iframe = browserFrame.createEl("iframe", {
			cls: "website-full-page-iframe",
			attr: {
				src: url,
				referrerpolicy: "no-referrer",
			},
		});

		iframe.addEventListener("load", () => {
			// Sites with strict frame protections may refuse iframe rendering.
		});

		const hint = browserFrame.createDiv({ cls: "website-full-page-hint" });
		hint.setText(
			"If this site refuses to load here, it is likely blocking iframe embedding. Try the desktop webview or open it in your browser.",
		);
	}
}

module.exports = class WebsiteFullPageViewerPlugin extends Plugin {
	async onload() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

		this.registerView(
			VIEW_TYPE_WEBSITE_FULL_PAGE,
			(leaf) => new WebsiteFullPageView(leaf, this),
		);
		this.registerExtensions(["website"], VIEW_TYPE_WEBSITE_FULL_PAGE);

		this.addCommand({
			id: "open-website-full-page",
			name: "Open website as full page",
			callback: () => {
				this.openUrlPrompt();
			},
		});

		this.addCommand({
			id: "open-home-website-full-page",
			name: "Open home website as full page",
			callback: () => {
				void this.openWebsiteView(this.settings.homeUrl);
			},
		});

		this.addCommand({
			id: "create-website-shortcut-file",
			name: "Create website shortcut file",
			callback: () => {
				this.openCreateShortcutPrompt();
			},
		});

		this.addRibbonIcon("globe", "Open website as full page", () => {
			this.openUrlPrompt();
		});

		this.addSettingTab(new WebsiteFullPageSettingTab(this.app, this));
	}

	async onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_WEBSITE_FULL_PAGE);
	}

	async saveSettings() {
		this.settings.homeUrl = normalizeUrl(this.settings.homeUrl || DEFAULT_SETTINGS.homeUrl);
		await this.saveData(this.settings);
	}

	openUrlPrompt() {
		new WebsiteUrlModal(
			this.app,
			this.settings.homeUrl,
			(url) => {
				void this.openWebsiteView(url);
			},
		).open();
	}

	openCreateShortcutPrompt() {
		new WebsiteShortcutModal(
			this.app,
			"",
			this.settings.homeUrl,
			({ name, url }) => {
				void this.createShortcutFile(name, url);
			},
		).open();
	}

	async openWebsiteView(url) {
		const normalizedUrl = normalizeUrl(url);
		const leaf = this.settings.openInNewLeaf
			? this.app.workspace.getLeaf(true)
			: this.app.workspace.getLeaf(false);

		await this.openUrlInLeaf(normalizedUrl, leaf);
	}

	async openUrlInLeaf(url, leaf) {
		const normalizedUrl = normalizeUrl(url);
		await leaf.setViewState({
			type: VIEW_TYPE_WEBSITE_FULL_PAGE,
			active: true,
			state: { url: normalizedUrl },
		});
		this.app.workspace.revealLeaf(leaf);
	}

	async createShortcutFile(name, url) {
		const activeFile = this.app.workspace.getActiveFile();
		const folderPath = activeFile?.parent?.path || "";
		let targetPath = buildShortcutPath(folderPath, name);
		let counter = 2;

		while (this.app.vault.getAbstractFileByPath(targetPath)) {
			targetPath = buildShortcutPath(folderPath, `${name} ${counter}`);
			counter += 1;
		}

		const file = await this.app.vault.create(targetPath, `${normalizeUrl(url)}\n`);
		new Notice(`Created website shortcut: ${file.path}`);
		await this.app.workspace.getLeaf(true).openFile(file, { active: true });
	}

	async readShortcutUrl(filePath) {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			throw new Error(`Website shortcut not found: ${filePath}`);
		}

		const content = await this.app.vault.read(file);
		return normalizeUrl(content.split(/\r?\n/).find((line) => line.trim()) || "");
	}

	async openExternalUrl(url) {
		if (shell?.openExternal) {
			await shell.openExternal(url);
			return;
		}

		window.open(url, "_blank", "noopener");
	}
};

class WebsiteFullPageSettingTab extends PluginSettingTab {
	constructor(app, plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Website Full Page Viewer" });

		new Setting(containerEl)
			.setName("Home URL")
			.setDesc("Default website to open from the ribbon or home-page command.")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.homeUrl)
					.setValue(this.plugin.settings.homeUrl)
					.onChange(async (value) => {
						this.plugin.settings.homeUrl = value.trim();
						try {
							await this.plugin.saveSettings();
						} catch (error) {
							new Notice(error.message || "Invalid home URL.");
						}
					}),
			);

		new Setting(containerEl)
			.setName("Show toolbar")
			.setDesc("Display the address bar and navigation controls above the page.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showToolbar).onChange(async (value) => {
					this.plugin.settings.showToolbar = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Open in new tab")
			.setDesc("Open websites in a new leaf instead of reusing the current one.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.openInNewLeaf).onChange(async (value) => {
					this.plugin.settings.openInNewLeaf = value;
					await this.plugin.saveSettings();
				}),
			);
	}
}
