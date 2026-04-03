# Dev Timeline — Obsidian Plugin

Renders beautiful interactive development timelines from a simple YAML
code block. Automatically respects your Obsidian theme (light/dark).

Also supports a kanban board view with task completion bars and subtasks.

---

## Installation

1. Copy the `dev-timeline-plugin` folder into your vault's plugin directory:
   ```
   <your-vault>/.obsidian/plugins/dev-timeline/
   ```
   The folder must contain:
   - `main.js`
   - `manifest.json`
   - `styles.css`

2. Open Obsidian → Settings → Community Plugins → turn off Safe Mode if needed.

3. Under Installed Plugins, enable **Dev Timeline**.

4. Done. Open `MagShift Roadmap.md` to see it in action.

---

## Usage

Create a fenced code block with the language `dev-timeline`:

~~~markdown
```dev-timeline
title: My Project
subtitle: Jan 2026 – Dec 2026

phases:
  - label: Phase 1
    color: purple
    tasks:
      - name: Research
        start: 2026-01-01
        end: 2026-01-15
        done: true
      - name: Design
        start: 2026-01-15
        end: 2026-02-01
        active: true
      - name: Launch
        start: 2026-02-01
        milestone: true
```
~~~

You can also render a board view with `dev-kanban`:

~~~markdown
```dev-kanban
title: Vertical Slice Board
subtitle: Week of Apr 3

columns:
  - label: In Progress
    color: purple
    tasks:
      - name: Vehicle Upgrades L2
        progress: 72
        owner: Jason
        due: 2026-04-12
        status: At Risk
        note: Handling is stable, but upgrade UI still needs balancing.
        subtasks:
          - name: Upgrade stats tuning
            done: true
          - name: UI layout pass
            progress: 80
          - name: Save/load validation
            progress: 35

  - label: Up Next
    color: teal
    tasks:
      - name: Career Mode Tutorial
        owner: Jason
        subtasks:
          - name: Intro beats
          - name: Objective scripting
          - name: Checkpoint fail states

  - label: Done
    color: green
    tasks:
      - name: Vehicle Garage
        done: true
        tags:
          - ui
          - systems
```
~~~

If you want to keep using `dev-timeline`, you can set `view: kanban` in the YAML instead.

---

## Task fields

| Field | Type | Description |
|---|---|---|
| `name` | string | Task label |
| `start` | YYYY-MM-DD | Start date |
| `end` | YYYY-MM-DD | End date (omit for milestones) |
| `duration` | number | Days (alternative to `end`) |
| `done` | boolean | Renders as fully filled with a checkmark |
| `active` | boolean | Renders as partially filled based on today's date |
| `milestone` | boolean | Renders as a diamond marker instead of a bar |

## Phase fields

| Field | Type | Description |
|---|---|---|
| `label` | string | Phase name |
| `color` | string | One of: `purple`, `teal`, `amber`, `coral`, `blue`, `pink`, `green`, `red`, `gray` |
| `tasks` | list | List of task objects |

---

## Kanban task fields

| Field | Type | Description |
|---|---|---|
| `name` | string | Task title |
| `progress` | number | 0-100 completion percentage |
| `done` | boolean | Forces task to 100% |
| `owner` | string | Optional owner badge |
| `due` | YYYY-MM-DD | Optional due date chip |
| `status` | string | Optional status chip |
| `note` | string | Optional supporting text |
| `tags` | list/string | Optional labels shown as pills |
| `subtasks` | list | Checklist items, each with `name`, `progress`, or `done` |

## Kanban column fields

| Field | Type | Description |
|---|---|---|
| `label` | string | Column heading |
| `color` | string | Accent color |
| `tasks` / `items` | list | Cards rendered in that column |

---

## Colours

Each phase gets its own colour. If you don't specify one, colours are
assigned automatically in order: purple → teal → amber → coral → blue → pink → green.

The colours automatically adapt to light and dark mode.
