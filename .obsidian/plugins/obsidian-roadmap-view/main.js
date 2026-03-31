const { Plugin, ItemView, Notice, MarkdownView, Setting, PluginSettingTab } = require('obsidian');

const VIEW_TYPE_ROADMAP_BOARD = 'roadmap-board-view';

function normalizeDate(raw) {
  if (!raw) return null;
  const value = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/;
  const dmyShort = /^(\d{2})\/(\d{2})\/(\d{2})$/;
  const dmyLong = /^(\d{2})\/(\d{2})\/(\d{4})$/;

  if (iso.test(value)) {
    const [, y, m, d] = value.match(iso);
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  if (dmyLong.test(value)) {
    const [, d, m, y] = value.match(dmyLong);
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  if (dmyShort.test(value)) {
    const [, d, m, yy] = value.match(dmyShort);
    const year = Number(yy) + 2000;
    return new Date(year, Number(m) - 1, Number(d));
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(raw) {
  const dt = normalizeDate(raw);
  if (!dt) return raw || '';
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = String(dt.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function parseRoadmapMarkdown(content) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  let title = 'Roadmap';
  const sections = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    const titleMatch = line.match(/^#\s+(.+)$/);
    if (titleMatch && !current && sections.length === 0) {
      title = titleMatch[1].trim();
      continue;
    }

    const sectionMatch = line.match(/^##\s+(.+?)(?:\s*\|\s*(.+))?$/);
    if (sectionMatch) {
      current = {
        title: sectionMatch[1].trim(),
        rawDate: (sectionMatch[2] || '').trim(),
        description: '',
        tasks: []
      };
      sections.push(current);
      continue;
    }

    if (!current) continue;

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      current.description += (current.description ? ' ' : '') + quoteMatch[1].trim();
      continue;
    }

    const taskMatch = line.match(/^[-*]\s+\[([ xX])]\s+(.+)$/);
    if (taskMatch) {
      current.tasks.push({
        done: taskMatch[1].toLowerCase() === 'x',
        text: taskMatch[2].trim()
      });
      continue;
    }

    const plainTaskMatch = line.match(/^[-*]\s+(.+)$/);
    if (plainTaskMatch) {
      current.tasks.push({
        done: false,
        text: plainTaskMatch[1].trim()
      });
    }
  }

  return { title, sections };
}

function compareSectionDates(a, b) {
  const ad = normalizeDate(a.rawDate);
  const bd = normalizeDate(b.rawDate);
  if (!ad && !bd) return 0;
  if (!ad) return 1;
  if (!bd) return -1;
  return ad.getTime() - bd.getTime();
}

class RoadmapBoardView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.filePath = '';
  }

  getViewType() {
    return VIEW_TYPE_ROADMAP_BOARD;
  }

  getDisplayText() {
    return 'Roadmap Board';
  }

  getIcon() {
    return 'kanban-square';
  }

  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass('roadmap-board-view');
    await this.refresh();
  }

  async setFile(file) {
    this.filePath = file ? file.path : '';
    this.plugin.settings.lastRoadmapFile = this.filePath;
    await this.plugin.saveSettings();
    await this.refresh();
  }

  async refresh() {
    this.contentEl.empty();
    this.contentEl.addClass('roadmap-board-view');

    const toolbar = this.contentEl.createDiv({ cls: 'roadmap-board-toolbar' });
    const refreshButton = toolbar.createEl('button', { text: 'Refresh' });
    refreshButton.addEventListener('click', () => this.refresh());

    const useActiveButton = toolbar.createEl('button', { text: 'Use Active Note' });
    useActiveButton.addEventListener('click', async () => {
      const file = this.plugin.getActiveMarkdownFile();
      if (!file) {
        new Notice('No active markdown note found.');
        return;
      }
      await this.setFile(file);
    });

    const files = this.app.vault.getMarkdownFiles().sort((a, b) => a.path.localeCompare(b.path));
    const select = toolbar.createEl('select');
    const placeholder = select.createEl('option', { text: 'Choose roadmap note...' });
    placeholder.value = '';

    for (const file of files) {
      const opt = select.createEl('option', { text: file.path });
      opt.value = file.path;
      if (file.path === this.filePath) opt.selected = true;
    }

    select.addEventListener('change', async () => {
      const path = select.value;
      const file = path ? this.app.vault.getAbstractFileByPath(path) : null;
      if (file && file.extension === 'md') {
        await this.setFile(file);
      }
    });

    let file = this.filePath ? this.app.vault.getAbstractFileByPath(this.filePath) : null;
    if (!file || file.extension !== 'md') {
      const remembered = this.plugin.settings.lastRoadmapFile
        ? this.app.vault.getAbstractFileByPath(this.plugin.settings.lastRoadmapFile)
        : null;
      if (remembered && remembered.extension === 'md') {
        file = remembered;
        this.filePath = remembered.path;
      }
    }

    if (!file || file.extension !== 'md') {
      const empty = this.contentEl.createDiv({ cls: 'roadmap-board-empty' });
      empty.createEl('p', { text: 'Pick a roadmap note to render it as a horizontal board.' });
      empty.createEl('p', {
        text: 'Format sections like “## Vertical Slice | 01/05/26” and list tasks beneath them.'
      });
      return;
    }

    try {
      const content = await this.app.vault.cachedRead(file);
      const roadmap = parseRoadmapMarkdown(content);
      roadmap.sections.sort(compareSectionDates);

      const titleRow = this.contentEl.createDiv({ cls: 'roadmap-board-title' });
      titleRow.createEl('h2', { text: roadmap.title || file.basename });
      titleRow.createDiv({
        cls: 'roadmap-board-meta',
        text: file.path
      });

      if (!roadmap.sections.length) {
        const empty = this.contentEl.createDiv({ cls: 'roadmap-board-empty' });
        empty.createEl('p', { text: 'No roadmap sections found in this note.' });
        return;
      }

      const scroll = this.contentEl.createDiv({ cls: 'roadmap-board-scroll' });
      const columns = scroll.createDiv({ cls: 'roadmap-board-columns' });
      const now = new Date();

      roadmap.sections.forEach((section, index) => {
        const col = columns.createDiv({ cls: 'roadmap-board-column' });
        const sectionDate = normalizeDate(section.rawDate);
        const nextSection = roadmap.sections[index + 1];
        const nextDate = nextSection ? normalizeDate(nextSection.rawDate) : null;
        const isCurrent = sectionDate && sectionDate <= now && (!nextDate || now < nextDate);
        if (isCurrent) col.addClass('is-current');

        const header = col.createDiv({ cls: 'roadmap-board-column-header' });
        header.createEl('h3', { cls: 'roadmap-board-column-title', text: section.title || 'Untitled Section' });
        if (section.rawDate) {
          header.createDiv({ cls: 'roadmap-board-column-date', text: formatDate(section.rawDate) });
        }

        if (section.description) {
          col.createEl('p', {
            cls: 'roadmap-board-column-description',
            text: section.description
          });
        }

        const taskList = col.createDiv({ cls: 'roadmap-board-task-list' });
        if (!section.tasks.length) {
          const task = taskList.createDiv({ cls: 'roadmap-board-task' });
          task.createDiv({ cls: 'roadmap-board-task-title', text: 'No tasks yet' });
        }

        for (const taskData of section.tasks) {
          const task = taskList.createDiv({ cls: 'roadmap-board-task' });
          if (taskData.done) task.addClass('is-done');
          task.createDiv({ cls: 'roadmap-board-task-title', text: taskData.text });
          const meta = task.createDiv({ cls: 'roadmap-board-task-meta' });
          meta.createSpan({ text: taskData.done ? 'Done' : 'Open' });
        }
      });
    } catch (error) {
      console.error(error);
      this.contentEl.createDiv({
        cls: 'roadmap-board-error',
        text: `Failed to render roadmap: ${error?.message || String(error)}`
      });
    }
  }
}

class RoadmapBoardSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Roadmap Board View' });

    new Setting(containerEl)
      .setName('Default roadmap note path')
      .setDesc('Optional markdown note to open by default in the roadmap board view.')
      .addText(text => text
        .setPlaceholder('Roadmap.md')
        .setValue(this.plugin.settings.lastRoadmapFile || '')
        .onChange(async (value) => {
          this.plugin.settings.lastRoadmapFile = value.trim();
          await this.plugin.saveSettings();
        }));
  }
}

class RoadmapBoardPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.registerView(
      VIEW_TYPE_ROADMAP_BOARD,
      (leaf) => new RoadmapBoardView(leaf, this)
    );

    this.addRibbonIcon('kanban-square', 'Open Roadmap Board', async () => {
      await this.activateView();
    });

    this.addCommand({
      id: 'open-roadmap-board',
      name: 'Open Roadmap Board',
      callback: async () => {
        await this.activateView();
      }
    });

    this.addCommand({
      id: 'open-current-note-in-roadmap-board',
      name: 'Open current note in Roadmap Board',
      callback: async () => {
        const file = this.getActiveMarkdownFile();
        if (!file) {
          new Notice('No active markdown note found.');
          return;
        }
        const view = await this.activateView();
        await view.setFile(file);
      }
    });

    this.addSettingTab(new RoadmapBoardSettingTab(this.app, this));
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_ROADMAP_BOARD);
  }

  async loadSettings() {
    this.settings = Object.assign({ lastRoadmapFile: '' }, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  getActiveMarkdownFile() {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    return activeView ? activeView.file : null;
  }

  async activateView() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_ROADMAP_BOARD)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE_ROADMAP_BOARD, active: true });
    }

    this.app.workspace.revealLeaf(leaf);
    return leaf.view;
  }
}

module.exports = RoadmapBoardPlugin;
