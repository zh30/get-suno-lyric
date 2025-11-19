interface AlignedWord {
  word: string;
  start_s: number;
  end_s: number;
}

interface ApiResponse {
  aligned_words: AlignedWord[];
}

type FileType = 'lrc' | 'srt';

const API_BASE_URL = 'https://studio-api.prod.suno.com/api/gen';

// Cache for API responses
const lyricsCache = new Map<string, AlignedWord[]>();

// Styles
const STYLES = `
  .suno-lyric-downloader-btn {
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
    font-weight: 600;
    text-align: center;
    border-radius: 0.5rem;
    cursor: pointer;
    background-color: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: white;
    padding: 0.6rem 1rem;
    min-width: 0;
    font-size: 0.875rem;
    line-height: 1.25rem;
    display: block;
    width: 100%;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
  }
  .suno-lyric-downloader-btn:hover {
    background-color: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  .suno-lyric-downloader-btn:active {
    transform: translateY(0);
    background-color: rgba(255, 255, 255, 0.2);
  }
  .suno-lyric-downloader-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 100%);
    backdrop-filter: blur(4px);
    z-index: 10;
    box-sizing: border-box;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
`;

function injectStyles() {
  if (document.getElementById('suno-lyric-downloader-styles')) return;
  const style = document.createElement('style');
  style.id = 'suno-lyric-downloader-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
}

function getCookie(name: string): string | undefined {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  return parts.length === 2 ? parts.pop()?.split(';').shift() : undefined;
}

async function fetchAlignedWords(songId: string, token: string): Promise<AlignedWord[] | null> {
  if (lyricsCache.has(songId)) {
    return lyricsCache.get(songId)!;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/${songId}/aligned_lyrics/v2/`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      // 404 or other errors might mean no lyrics exist
      if (response.status === 404) {
        console.debug(`No lyrics found for song ${songId}`);
      } else {
        console.error(`API request failed: ${response.status}`);
      }
      return null;
    }

    const data: ApiResponse = await response.json();
    const words = data.aligned_words?.length ? data.aligned_words : null;

    if (words) {
      lyricsCache.set(songId, words);
    }

    return words;
  } catch (error) {
    console.error('Error fetching aligned words:', error);
    return null;
  }
}

function createButton(text: string, onClick: (e: MouseEvent) => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.innerText = text;
  button.className = 'suno-lyric-downloader-btn';
  button.addEventListener('click', onClick);
  return button;
}

function downloadFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function createToolsOverlay(songId: string, alignedWords: AlignedWord[]): HTMLElement {
  let currentFileType: FileType = 'lrc';

  const toolsBox = document.createElement('div');
  toolsBox.className = 'suno-lyric-downloader-overlay';
  // Mark this container to prevent duplicates
  toolsBox.dataset.sunoLyricDownloader = 'true';

  const getDownloadText = (type: FileType) => chrome.i18n.getMessage('download_lyric', [type.toUpperCase()]) || `Download ${type.toUpperCase()}`;
  const getToggleText = (type: FileType) => chrome.i18n.getMessage('toggle_type', [type === 'lrc' ? 'SRT' : 'LRC']) || `Switch to ${type === 'lrc' ? 'SRT' : 'LRC'}`;

  const downloadButton = createButton(
    getDownloadText(currentFileType),
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      const content = currentFileType === 'srt' ? convertToSRT(alignedWords) : convertToLRC(alignedWords);
      const extName = chrome.i18n.getMessage('extension_name') || 'SunoLyric';
      const fileName = `${songId}-lyrics-${extName.toLowerCase().replace(/\s+/g, '-')}.${currentFileType}`;

      downloadFile(content, fileName, `text/${currentFileType}`);
    }
  );

  const toggleButton = createButton(
    getToggleText(currentFileType),
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      currentFileType = currentFileType === 'lrc' ? 'srt' : 'lrc';
      downloadButton.innerText = getDownloadText(currentFileType);
      toggleButton.innerText = getToggleText(currentFileType);
    }
  );

  toolsBox.appendChild(toggleButton);
  toolsBox.appendChild(downloadButton);
  return toolsBox;
}

function convertToSRT(alignedWords: AlignedWord[]): string {
  return alignedWords
    .map((word, index) => {
      const startTime = formatSRTTime(word.start_s);
      const endTime = formatSRTTime(word.end_s);
      return `${index + 1}\n${startTime} --> ${endTime}\n${word.word}\n`;
    })
    .join('\n');
}

function convertToLRC(alignedWords: AlignedWord[]): string {
  return alignedWords
    .map(word => `${formatLRCTime(word.start_s)}${word.word}`)
    .join('\n');
}

function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

function formatLRCTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.floor((seconds % 1) * 100);

  return `[${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}]`;
}

function getSongIdFromUrl(): string {
  const path = window.location.pathname;
  if (path.startsWith('/song/')) {
    return path.split('/').pop() || '';
  }
  return '';
}

async function processPage() {
  const songId = getSongIdFromUrl();
  if (!songId) return;

  // Find the image container. This selector might need adjustment if Suno changes their DOM.
  // We look for the image that represents the song art.
  const imageElements = document.querySelectorAll<HTMLImageElement>(`div>img[src*="${songId}"].w-full.h-full`);

  if (!imageElements.length) return;

  const sessionToken = getCookie('__session');
  if (!sessionToken) {
    // No session, can't fetch lyrics yet.
    return;
  }

  // Fetch lyrics (cached if available)
  const alignedWords = await fetchAlignedWords(songId, sessionToken);
  if (!alignedWords) return;

  imageElements.forEach((imageElement) => {
    const parent = imageElement.parentElement;
    if (!parent) return;

    // Check if we already injected the tools
    if (parent.querySelector('.suno-lyric-downloader-overlay')) return;

    // Ensure parent has relative positioning for absolute child
    const computedStyle = window.getComputedStyle(parent);
    if (computedStyle.position === 'static') {
      parent.style.position = 'relative';
    }

    parent.appendChild(createToolsOverlay(songId, alignedWords));
  });
}

// Debounce function to limit how often processPage runs
function debounce(func: Function, wait: number) {
  let timeout: any;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const debouncedProcessPage = debounce(processPage, 500);

function initObserver() {
  injectStyles();

  // Initial check
  processPage();

  const observer = new MutationObserver((mutations) => {
    let shouldProcess = false;
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        shouldProcess = true;
        break;
      }
      // Also check for attribute changes if needed, e.g., src changes
      if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
        shouldProcess = true;
        break;
      }
    }

    if (shouldProcess) {
      debouncedProcessPage();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'] // Only watch src changes for images
  });
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "URL_CHANGED") {
    debouncedProcessPage();
  } else if (message.action === "MANUALLY_TRIGGER") {
    processPage();
  }
  return false;
});

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initObserver);
} else {
  initObserver();
}