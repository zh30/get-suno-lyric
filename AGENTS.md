# Repository Guidelines

## Project Structure & Module Organization

This repository contains the Suno Lyric Downloader Chrome extension using Manifest V3.

- `src/manifest.json`: extension manifest, permissions, and entry points.
- `src/scripts/`: content and background scripts (`contentScript.ts`, `background.ts`).
- `src/popup/` and `src/sidePanel/`: React TSX UI entry points with HTML shells.
- `src/styles/tailwind.css`: Tailwind CSS v4 entry file for UI styling.
- `_locales/`: Chrome i18n message bundles.
- `public/`: extension icons and static assets.
- `scripts/zip.js`: packaging script for Chrome Web Store ZIP output.
- `dist/`: generated build output; do not edit by hand.

## Build, Test, and Development Commands

- `pnpm dev`: builds in development mode and watches for changes, outputting to `dist/`.
- `pnpm build`: creates the production extension bundle with Rspack.
- `pnpm tsc`: runs TypeScript type checking.
- `pnpm zip`: runs a production build and creates `SunoLyricDownloader.zip`.
- `pnpm test`: placeholder command that currently exits with an error; no automated suite is configured yet.

Use `pnpm build` before loading the unpacked extension from `dist/` in Chrome.

## Coding Style & Naming Conventions

Use TypeScript and React TSX with 2-space indentation and semicolons. Prefer explicit interfaces or types for structured data and use descriptive names such as `AlignedWord`, `lyricsCache`, or `downloadLyrics`.

Keep user-facing UI strings in `_locales/` and reference them through Chrome i18n instead of hard-coding text in scripts. Use Tailwind utility classes for component styling and add shared style primitives in `src/styles/tailwind.css` only when needed.

## Testing Guidelines

No test framework or coverage threshold is currently configured. Validate changes with:

- `pnpm tsc` for type safety.
- `pnpm build` for bundle correctness.
- Manual Chrome smoke testing by loading `dist/` as an unpacked extension and checking popup, side panel, lyric capture, and LRC/SRT download flows.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commits such as `feat:`, `fix:`, `chore:`, `refactor:`, and `docs:`. Use optional scopes when helpful, for example `feat(i18n): add Japanese messages`.

Pull requests should include a clear summary, testing notes with commands run, linked issues when relevant, and screenshots or screen recordings for UI changes. If release behavior changes, update both `src/manifest.json` and `package.json` version fields.

## Security & Configuration Notes

Do not commit secrets or Chrome Web Store credentials. GitHub Actions handles release packaging for tags matching `v*` and syncs tag versions into the manifest and package metadata before zipping.
