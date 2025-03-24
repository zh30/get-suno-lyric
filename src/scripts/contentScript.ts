/**
 * Lyrics Downloader TypeScript Script
 * This script allows downloading synchronized lyrics in LRC or SRT format
 * from a music streaming service.
 */

// Define core domain models
interface AlignedWord {
  word: string;
  start_s: number;
  end_s: number;
}

interface ApiResponse {
  aligned_words: AlignedWord[];
  [key: string]: any; // For other potential fields in the response
}

interface Config {
  fileType: 'lrc' | 'srt';
  buttonStyles: Record<string, string>;
  apiBaseUrl: string;
}

// Default configuration
const DEFAULT_CONFIG: Config = {
  fileType: 'lrc',
  buttonStyles: {
    zIndex: '9999',
    position: 'relative',
    background: 'gray',
    borderRadius: '4px',
    padding: '6px 10px',
    color: 'white',
    display: 'block',
    width: '100%',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    textAlign: 'center',
    transition: 'background 0.3s ease',
  },
  apiBaseUrl: 'https://studio-api.prod.suno.com/api/gen'
};

// Cookie utility
function getCookie(name: string): string | undefined {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
}

// API interaction
async function fetchAlignedWords(
  songId: string,
  token: string,
  config: Config
): Promise<AlignedWord[] | undefined> {
  const apiUrl = `${config.apiBaseUrl}/${songId}/aligned_lyrics/v2/`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    if (data?.aligned_words?.length) {
      console.log(`Successfully fetched ${data.aligned_words.length} aligned words`);
      return data.aligned_words;
    } else {
      console.error('No aligned words found in the response.');
      return undefined;
    }
  } catch (error) {
    console.error('Error fetching aligned words:', error);
    return undefined;
  }
}

// UI helpers
function applyStyles(element: HTMLElement, styles: Record<string, string>): void {
  Object.entries(styles).forEach(([property, value]) => {
    (element.style as any)[property] = value;
  });
}

function createButton(
  text: string,
  styles: Record<string, string>,
  clickHandler: (e: MouseEvent) => void,
  className?: string,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.innerText = text;
  applyStyles(button, styles);
  button.addEventListener('click', clickHandler);

  if (className) {
    button.className = className;
  }

  return button;
}

function createDownloadLink(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();

  // Clean up the URL object after a short delay
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// UI components
function addButtons(imageSrc: string, alignedWords: AlignedWord[], config: Config): void {
  const imageElements = document.querySelectorAll<HTMLImageElement>(
    `img[src*="${imageSrc}"].w-full.h-full`
  );

  if (!imageElements.length) {
    console.warn(`No images found matching selector for song ID: ${imageSrc}`);
    return;
  }

  console.log(`Found ${imageElements.length} matching image(s) for: ${imageSrc}`);

  imageElements.forEach((imageElement, index) => {
    const parent = imageElement.parentElement;
    if (!parent) {
      console.error('Image has no parent element, cannot add buttons.');
      return;
    }
    const toolsBox = document.createElement('div');
    toolsBox.style.position = 'absolute';
    toolsBox.style.bottom = '0';
    toolsBox.style.left = '0';
    toolsBox.style.width = '100%';
    toolsBox.style.height = 'auto';
    toolsBox.style.display = 'flex';
    toolsBox.style.flexDirection = 'column';
    toolsBox.style.justifyContent = 'center';
    toolsBox.style.alignItems = 'center';
    toolsBox.style.gap = '4px';
    toolsBox.style.padding = '8px';
    toolsBox.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';

    // Create download button
    const downloadButton = createButton(
      chrome.i18n.getMessage('download_lyric', [config.fileType.toUpperCase()]),
      // config.buttonStyles,
      {},
      (e) => {
        e.preventDefault();
        e.stopPropagation();

        const content = config.fileType === 'srt'
          ? convertToSRT(alignedWords)
          : convertToLRC(alignedWords);

        createDownloadLink(
          content,
          `${imageSrc}-lyrics-${chrome.i18n.getMessage('extension_name').toLowerCase().split(' ').join('-')}.${config.fileType}`,
          `text/${config.fileType}`
        );
      },
      'font-sans font-medium text-center rounded-md cursor-pointer bg-quaternary text-primary hover:bg-primary/30 hover:text-primary px-3 py-2 min-w-0 text-sm block w-full'
    );

    // Create format toggle button
    const toggleButton = createButton(
      chrome.i18n.getMessage('toggle_type', [config.fileType === 'lrc' ? 'SRT' : 'LRC']),
      {},
      (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Toggle the file type
        config.fileType = config.fileType === 'lrc' ? 'srt' : 'lrc';

        // Update button texts
        downloadButton.innerText = chrome.i18n.getMessage('download_lyric', [config.fileType.toUpperCase()]);
        toggleButton.innerText = chrome.i18n.getMessage('toggle_type', [config.fileType === 'lrc' ? 'SRT' : 'LRC']);
      },
      'font-sans font-medium text-center rounded-md cursor-pointer bg-quaternary text-primary hover:bg-primary/30 hover:text-primary px-3 py-2 min-w-0 text-sm block w-full'
    );

    // Add buttons to the parent
    toolsBox.appendChild(toggleButton);
    toolsBox.appendChild(downloadButton);
    parent.appendChild(toolsBox);

    console.log(`Added buttons to image ${index}`);
  });
}

// Format conversion
function convertToSRT(alignedWords: AlignedWord[]): string {
  return alignedWords.reduce((content, wordObj, index) => {
    const startTime = formatSRTTime(wordObj.start_s);
    const endTime = formatSRTTime(wordObj.end_s);
    return content +
      `${index + 1}\n` +
      `${startTime} --> ${endTime}\n` +
      `${wordObj.word}\n\n`;
  }, '');
}

function convertToLRC(alignedWords: AlignedWord[]): string {
  return alignedWords.reduce((content, wordObj) => {
    const time = formatLRCTime(wordObj.start_s);
    return content + `${time}${wordObj.word}\n`;
  }, '');
}

// Time formatting
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

function formatLRCTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.floor((seconds % 1) * 100);

  return `[${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}]`;
}

// Utility functions
function getSongIdFromUrl(): string {
  const urlParts = window.location.href.split('/');
  return urlParts[urlParts.length - 1];
}

// Main application
function main(): void {
  // Create a configuration object with defaults
  const config: Config = { ...DEFAULT_CONFIG };

  try {
    const songId = getSongIdFromUrl();
    if (!songId) {
      throw new Error('Could not extract song ID from URL');
    }

    // Get the token from the cookie
    const sessionToken = getCookie('__session');
    if (!sessionToken) {
      throw new Error('Session token not found in cookies.');
    }

    // Fetch aligned words and add the buttons
    fetchAlignedWords(songId, sessionToken, config)
      .then((alignedWords) => {
        if (alignedWords?.length) {
          addButtons(songId, alignedWords, config);
        } else {
          console.error('No aligned words data available for this song.');
        }
      })
      .catch((error) => {
        console.error('Failed to process aligned words:', error);
      });
  } catch (error) {
    console.error('Error initializing the script:', error);
  }
}

// Start the application when the DOM is loaded
setTimeout(function () { main(); }, 3000);