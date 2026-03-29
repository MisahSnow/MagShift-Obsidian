# Website Full Page Viewer

Desktop-only Obsidian plugin that opens a website in a full-page custom view.

## Features

- Opens a website in its own Obsidian tab or pane
- Prompts for a URL from a command or ribbon button
- Supports a default home URL
- Supports `.website` shortcut files inside your vault so websites can live alongside notes
- Includes a simple toolbar with address field, reload, and external browser button
- Uses an Electron `webview` when available, with a persistent session and a browser-like user agent
- Falls back to an `iframe` only when a desktop `webview` is unavailable

## Install

1. Put this folder in your vault at `.obsidian/plugins/website-full-page-viewer/`.
2. Enable **Website Full Page Viewer** in Obsidian community plugins.

## Use

1. Run `Open website as full page` to enter any URL.
2. Run `Open home website as full page` to open the configured default site.
3. Run `Create website shortcut file` to make a `.website` file in the current folder.
4. Click a `.website` file in the file explorer to open it in the viewer.
5. Use the plugin settings to set the home URL and toolbar behavior.

## Notes

- This plugin is desktop-only.
- `.website` shortcut files store the target URL as plain text on the first line.
- Some websites block iframe embedding with security headers. When that happens, the Electron `webview` path is the best chance of rendering inside Obsidian.
- If a site still refuses to load, use the `Open in Browser` button.
