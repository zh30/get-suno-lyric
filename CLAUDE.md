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

## Data Flow

1. **URL Detection**: Extension detects Suno song page URLs (`/song/{id}`)
2. **Authentication**: Extracts `__session` cookie from document
3. **API Call**: Fetches aligned lyrics from Suno's API using Bearer token
4. **DOM Injection**: Adds overlay buttons to song images containing the song ID
5. **Format Conversion**: Converts aligned word data to LRC or SRT format on demand
6. **Download**: Generates and downloads lyric files with proper naming

## Internationalization

The extension supports multiple languages through Chrome's i18n system:
- English: `_locales/en/messages.json`
- Chinese: `_locales/zh_CN/messages.json`
- All UI text uses `chrome.i18n.getMessage()` for localization

## File Formats

### LRC Format
```
[mm:ss.xx]Lyric text
[mm:ss.xx]Next lyric text
```

### SRT Format
```
1
00:00:00,000 --> 00:00:02,500
Lyric text

2
00:00:02,500 --> 00:00:05,000
Next lyric text
```

## Testing & Development

The extension loads automatically on Suno song pages or can be manually triggered via the extension icon. Check browser console for debug logs prefixed with "Content script" or "URL changed".

The build outputs to `dist/` and can be loaded as an unpacked extension in Chrome's developer mode.

## Key Implementation Details

- Uses `document.querySelectorAll()` to find song images by ID pattern
- Implements retry logic with setTimeout for page load timing
- Handles both automatic URL change detection and manual extension icon clicks
- Uses Blob and URL.createObjectURL for file downloads
- Implements proper error handling and logging throughout