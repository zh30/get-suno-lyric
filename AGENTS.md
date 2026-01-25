# Repository Guidelines

This repository contains the **Suno Lyric Downloader** Chrome extension (Manifest V3). Use the notes below to make consistent, reviewable contributions.

## Project Structure & Module Organization
- `src/manifest.json`: Extension manifest and entry points.
- `src/scripts/`: Content and background scripts (`contentScript.ts`, `background.ts`).
- `src/popup/` and `src/sidePanel/`: React TSX UI plus HTML shells.
- `src/styles/tailwind.css`: Tailwind entry for UI styling.
- `_locales/`: Chrome i18n message bundles.
- `public/`: Extension icons.
- `dist/`: Build output (generated; do not edit by hand).
- `scripts/zip.js`: Packaging script for Chrome Web Store ZIP.

## Build, Test, and Development Commands
- `pnpm dev`: Development build with watch mode (outputs to `dist/`).
- `pnpm build`: Production bundle via Rspack.
- `pnpm tsc`: Type-check the project.
- `pnpm zip`: Runs build and creates `SunoLyricDownloader.zip` from `dist/`.
- `pnpm test`: Placeholder and exits with error; no automated test suite yet.

## Coding Style & Naming Conventions
- Language: TypeScript + React (TSX) with 2‑space indentation and semicolons.
- Prefer explicit interfaces/types and descriptive names (e.g., `AlignedWord`, `lyricsCache`).
- Keep UI strings in `_locales/` and avoid hard‑coding text in scripts.
- Styling: Tailwind CSS v4 via PostCSS; add new styles in `src/styles/tailwind.css` or component classes.

## Testing Guidelines
- No test framework is configured. Validate changes via:
  - `pnpm tsc` for type safety.
  - Manual Chrome extension load from `dist/` and smoke‑test popup/side panel and lyric download flows.

## Commit & Pull Request Guidelines
- Commit style follows Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:` with optional scopes (e.g., `feat(i18n): ...`).
- PRs should include a clear summary, testing notes (commands run), and screenshots or screen recordings for UI changes.
- If changing release behavior, update both `src/manifest.json` and `package.json` version fields.

## Release & Configuration Notes
- GitHub Actions publishes on tags matching `v*`; it syncs the tag version into `src/manifest.json` and `package.json` before zipping.
- Keep secrets out of source files; all Chrome Web Store credentials are managed via GitHub secrets.
