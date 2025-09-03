# Suno Lyric Downloader

A Chrome browser extension that downloads synchronized lyrics from Suno.com in LRC or SRT formats.

## Features

- 🎵 **Automatic Detection**: Automatically detects Suno song pages and adds download buttons
- 📝 **Multiple Formats**: Download lyrics in LRC or SRT formats with format switching
- 🔐 **Secure Authentication**: Uses your existing Suno session cookie for API access
- 🌐 **Multi-language Support**: Available in English and Chinese
- 🚀 **Fast & Lightweight**: Built with TypeScript and Rspack for optimal performance
- 🎯 **Precise Timing**: Downloads word-level synchronized lyrics with accurate timestamps

## How It Works

1. **Navigate to any Suno song page** (https://suno.com/song/{id})
2. **Download buttons appear** automatically on song cover images
3. **Choose your format**: LRC for music players or SRT for video subtitles
4. **Click download** to get perfectly synchronized lyrics

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/your-username/get-suno-lyric.git
   cd get-suno-lyric
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the extension:
   ```bash
   pnpm build
   ```

4. Load in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `dist` folder

## Development

```bash
# Install dependencies
pnpm install

# Development build with watch mode
pnpm dev

# Production build
pnpm build

# Type checking
pnpm tsc

# Package for distribution
pnpm zip
```

## Supported Formats

### LRC Format
Perfect for music players and karaoke applications:
```
[00:12.34]Hello world
[00:15.67]This is synchronized lyrics
```

### SRT Format
Ideal for video subtitles and captioning:
```
1
00:00:12,340 --> 00:00:15,670
Hello world

2
00:00:15,670 --> 00:00:19,120
This is synchronized lyrics
```

## Technical Details

- **Manifest V3** Chrome extension
- **TypeScript** for type safety and better development experience
- **Rspack** for fast builds and bundling
- **Chrome i18n** for internationalization
- **Word-level synchronization** with precise timing

## Privacy & Security

- Only accesses Suno.com domains
- Uses your existing session cookie (no login required)
- All data processing happens locally in your browser
- No external servers or data collection

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details
