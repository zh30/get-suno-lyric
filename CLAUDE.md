# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension (Manifest V3) that downloads synchronized lyrics from Suno.com in LRC or SRT formats. Injects download buttons on song pages, fetches aligned word data from Suno's API, and converts to downloadable files.

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Watch mode development build
pnpm build            # Production build
pnpm tsc              # TypeScript type checking
pnpm zip              # Package for distribution
```

## Architecture

- **Content Script** (`src/scripts/contentScript.ts`) - Main logic: DOM manipulation, API calls, lyric processing
- **Background Script** (`src/scripts/background.ts`) - Service worker for URL monitoring and icon click handling
- **Build**: Rspack with SWC, outputs to `dist/` (entry points: `background.js`, `contentScript.js`)
- **Types**: `chrome-types` package for Chrome API definitions
- **i18n**: Chrome i18n system with `_locales/en/` and `_locales/zh_CN/`

## Key Integration Points

| Component | Details |
|-----------|---------|
| Target | `https://suno.com/*` (content script) |
| API | `https://studio-api.prod.suno.com/api/gen/{songId}/aligned_lyrics/v2/` |
| Auth | Bearer token from `__session` cookie |
| Song ID | Extracted from URL path `/song/{id}` |
| Download | Uses Blob + URL.createObjectURL |

## Data Flow

1. URL change detection or icon click triggers content script
2. Extract song ID from URL and `__session` cookie
3. Fetch aligned lyrics from Suno API
4. Inject overlay buttons on song cover images
5. Convert word-level timestamps to LRC or SRT on demand
6. Generate and download file

## Source File Structure

```
src/
  scripts/
    contentScript.ts    # Core lyric download logic
    background.ts       # Service worker (URL monitoring, icon clicks)
  popup/                # Unused - popup UI (commented out in rspack)
  sidePanel/            # Unused - side panel UI (commented out)
  styles/tailwind.css   # Tailwind styles
```

## Build Configuration

- **rspack.config.js**: Entry points, SWC loader for TSX, asset copying (manifest, locales, icons)
- **tsconfig.json**: ES5 target, DOM + ES2017 lib, strict mode, chrome-types included
- Source maps disabled to prevent CSP violations

## Debugging

Check browser console for logs prefixed with "Content script" or "URL changed". Reload extension after builds via `chrome://extensions/` (developer mode).
