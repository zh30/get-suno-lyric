# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome browser extension that downloads synchronized lyrics from Suno.com in LRC or SRT formats. The extension injects download buttons on song pages, fetches aligned word data from Suno's API, and converts it to downloadable lyric files.

## Key Architecture

- **Manifest V3 Chrome Extension** targeting `https://suno.com/*`
- **Content Script** (`src/scripts/contentScript.ts`) - Main logic for DOM manipulation, API calls, and lyric processing
- **Background Script** (`src/scripts/background.ts`) - Monitors tab URL changes and handles extension icon clicks
- **Build System** - Uses Rspack for fast TypeScript compilation and bundling
- **Internationalization** - Supports English and Chinese via `_locales/` directories

## Development Commands

```bash
# Install dependencies
pnpm install

# Development build with file watching
pnpm dev

# Production build
pnpm build

# Type checking
pnpm tsc

# Package extension for distribution
pnpm zip
```

## Core Components

### Content Script (`src/scripts/contentScript.ts`)
- Extracts song ID from URL path (`/song/{id}`)
- Fetches aligned lyrics from `https://studio-api.prod.suno.com/api/gen/{songId}/aligned_lyrics/v2/`
- Uses `__session` cookie for authentication
- Creates overlay buttons on song images for download and format toggle
- Converts aligned word data to LRC or SRT format

### Background Script (`src/scripts/background.ts`)
- Listens for tab URL changes using `chrome.tabs.onUpdated`
- Sends messages to content script when navigating to `/song/` pages
- Handles extension icon clicks for manual trigger

### Build Configuration
- **Rspack** (`rspack.config.js`) - Bundles TypeScript with SWC loader
- **Entry Points**: `background.ts`, `contentScript.ts`
- **Output**: `dist/` directory with `background.js`, `contentScript.js`
- **Assets**: Copies `manifest.json`, `_locales/`, and `public/` to dist

### Manifest (`src/manifest.json`)
- Targets Chrome 114+ with Manifest V3
- Content script injected on `https://suno.com/*`
- Service worker background script
- Host permissions for Suno domain

## Key Functions

- **`main()`** - Entry point that extracts song ID, fetches session token, and initiates lyric download UI
- **`fetchAlignedWords()`** - API call to Suno's aligned lyrics endpoint
- **`addButtons()`** - Creates download and format toggle buttons on song images
- **`convertToLRC()`/`convertToSRT()`** - Format conversion utilities
- **`getSongIdFromUrl()`** - Extracts song ID from current URL

## Testing & Development

The extension loads automatically on Suno song pages or can be manually triggered via the extension icon. Check browser console for debug logs prefixed with "Content script" or "URL changed".

The build outputs to `dist/` and can be loaded as an unpacked extension in Chrome's developer mode.