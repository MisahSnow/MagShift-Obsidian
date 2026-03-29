# GitHub Releases Sync

Obsidian plugin that keeps Obsidian pages in sync with releases and commits from a GitHub repository.

## What it does

- Accepts either a GitHub repository URL or `owner/repo`.
- Fetches releases from the GitHub Releases API.
- Fetches recent commits from the GitHub commits API.
- Writes clean generated releases and commit-log notes, or a managed block when preserving other note content.
- Formats the synced note as a clean release table with dates, tags, and summaries.
- Formats the commit log as a clean table with commit links, authors, dates, and messages.
- Replaces only the managed block on later syncs, so other note content can stay intact.
- Can sync on startup, on a timer, or from a command/ribbon button.

## Install

1. Put this folder in your vault at `.obsidian/plugins/github-releases-sync/`.
2. Enable **GitHub Releases Sync** in Obsidian community plugins.

## Use

1. Open the plugin settings.
2. Set **Repository** to a GitHub repo URL or `owner/repo`.
3. Set **Releases note** and **Commit log note** to either note paths or existing folders where you want the pages created.
4. Run **Sync GitHub pages** or use the settings button.

If a target note is dedicated to generated content, the plugin replaces the whole note and no markers are shown.

If a target note also contains your own content, the plugin preserves that content and writes a managed block between these markers:

```md
<!-- github-releases-sync:start -->
...
<!-- github-releases-sync:end -->
```

If the target note already exists and contains that block, only the block is replaced.

## Notes

- Draft releases are ignored.
- Pre-releases are optional.
- Commits are pulled from the repository's default branch feed.
- GitHub rate limits apply; add a token in settings if you need a higher limit.
