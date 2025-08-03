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
const BUTTON_CLASS = 'font-sans font-medium text-center rounded-md cursor-pointer bg-quaternary text-primary hover:bg-primary/30 hover:text-primary px-3 py-2 min-w-0 text-sm block w-full';

function getCookie(name: string): string | undefined {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  return parts.length === 2 ? parts.pop()?.split(';').shift() : undefined;
}

async function fetchAlignedWords(songId: string, token: string): Promise<AlignedWord[] | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/${songId}/aligned_lyrics/v2/`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    return data.aligned_words?.length ? data.aligned_words : null;
  } catch (error) {
    console.error('Error fetching aligned words:', error);
    return null;
  }
}

function createButton(text: string, onClick: (e: MouseEvent) => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.innerText = text;
  button.className = BUTTON_CLASS;
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
  Object.assign(toolsBox.style, {
    position: 'absolute',
    bottom: '0',
    left: '0',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '8px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  });

  const downloadButton = createButton(
    chrome.i18n.getMessage('download_lyric', [currentFileType.toUpperCase()]),
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const content = currentFileType === 'srt' ? convertToSRT(alignedWords) : convertToLRC(alignedWords);
      const fileName = `${songId}-lyrics-${chrome.i18n.getMessage('extension_name').toLowerCase().replace(/\s+/g, '-')}.${currentFileType}`;
      
      downloadFile(content, fileName, `text/${currentFileType}`);
    }
  );

  const toggleButton = createButton(
    chrome.i18n.getMessage('toggle_type', [currentFileType === 'lrc' ? 'SRT' : 'LRC']),
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      currentFileType = currentFileType === 'lrc' ? 'srt' : 'lrc';
      downloadButton.innerText = chrome.i18n.getMessage('download_lyric', [currentFileType.toUpperCase()]);
      toggleButton.innerText = chrome.i18n.getMessage('toggle_type', [currentFileType === 'lrc' ? 'SRT' : 'LRC']);
    }
  );

  toolsBox.appendChild(toggleButton);
  toolsBox.appendChild(downloadButton);
  return toolsBox;
}

function addButtons(songId: string, alignedWords: AlignedWord[]): void {
  const imageElements = document.querySelectorAll<HTMLImageElement>(`div>img[src*="${songId}"].w-full.h-full`);

  if (!imageElements.length) {
    console.warn(`No images found for song ID: ${songId}`);
    return;
  }

  imageElements.forEach((imageElement) => {
    const parent = imageElement.parentElement;
    if (!parent) return;
    
    parent.appendChild(createToolsOverlay(songId, alignedWords));
  });
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
  return window.location.pathname.split('/').pop() || '';
}

async function main() {
  const songId = getSongIdFromUrl();
  if (!songId) {
    console.error('Could not extract song ID from URL');
    return;
  }

  const sessionToken = getCookie('__session');
  if (!sessionToken) {
    console.error('Session token not found in cookies');
    return;
  }

  const alignedWords = await fetchAlignedWords(songId, sessionToken);
  if (alignedWords) {
    addButtons(songId, alignedWords);
  } else {
    console.error('No aligned words data available for this song');
  }
}

chrome.runtime.onMessage.addListener((message) => {
  console.log("Content script received message:", message);

  if (message.action === "URL_CHANGED" && message.songId) {
    console.log("URL changed to song page with ID:", message.songId);
    setTimeout(main, 1000);
  } else if (message.action === "MANUALLY_TRIGGER") {
    console.log("Manual trigger received");
    main();
  }

  return true;
});

setTimeout(() => {
  if (window.location.pathname.startsWith('/song/')) {
    main();
  }
}, 3000);