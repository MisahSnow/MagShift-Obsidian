# Roadmap Board View

An Obsidian plugin that renders a markdown roadmap note as a horizontal board view instead of Mermaid.

## What it does

- Opens a dedicated custom view for roadmap notes
- Parses a simple markdown format
- Renders each release section as a wide horizontal column
- Avoids Mermaid sizing issues in Canvas and notes

## Install manually

Copy these files into:

```text
YourVault/.obsidian/plugins/roadmap-board-view/
```

Files needed:

- `manifest.json`
- `main.js`
- `styles.css`

Then enable **Roadmap Board View** in **Settings -> Community plugins**.

## Commands

- **Open Roadmap Board**
- **Open current note in Roadmap Board**

## Roadmap note format

Create a normal markdown note like this:

```md
# MagShift Roadmap

## Vertical Slice | 01/05/26
> First playable release target.
- [ ] Career Mode Tutorial
- [ ] Vehicle Garage
- [ ] Vehicle Upgrades L2
- [ ] Varoxis Maps x2
- [ ] Helios Maps x2
- [ ] VFX and SFX
- [ ] Bug Fixing

## Alpha | 01/08/26
> Wider content push.
- [ ] Career Mode 6 Planets
- [ ] Battle Mode

## Beta | 01/11/26
- [ ] Final Content and Polish
- [ ] Balance Pass
- [ ] All Cutscenes

## Full Release | 01/02/27
- [ ] Final Bug Fixing
- [ ] Final Balance
- [ ] Version 1.0
```

## Notes

- Section headings use `## Section Name | date`
- Dates can be `DD/MM/YY`, `DD/MM/YYYY`, or `YYYY-MM-DD`
- Blockquotes directly under a section become the section description
- Tasks support checkbox format `- [ ]` and `- [x]`
