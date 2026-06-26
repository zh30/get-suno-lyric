import '../styles/tailwind.css';

type PageState = 'loading' | 'not_suno' | 'suno_page' | 'song_page' | 'unknown';

interface CurrentTabState {
  id?: number;
  url?: string;
  pageState: PageState;
}

type Child = HTMLElement | Text | string | undefined | null | false;

const SUNO_HOME_URL = 'https://suno.com/';
const DEMO_URL = chrome.runtime.getURL('show.gif');

const fallbackMessages: Record<string, string> = {
  extension_name: 'Suno Lyric Downloader',
  extension_description: 'Download synchronized lyrics from Suno.com in LRC or SRT formats.',
  popup_subtitle: 'Open a Suno song page, then download synced lyrics from the song cover.',
  popup_demo_alt: 'Demo showing where the LRC and SRT download buttons appear on a Suno song cover.',
  popup_status_loading: 'Checking the current tab...',
  popup_status_not_suno: 'Open Suno and choose a song detail page to start.',
  popup_status_suno_page: 'You are on Suno. Open a song detail page whose URL starts with /song/.',
  popup_status_song_page: 'Song page detected. If buttons do not appear, sign in to Suno and refresh this page.',
  popup_status_unknown: 'Open a Suno song detail page to use this extension.',
  popup_button_open_suno: 'Open Suno',
  popup_button_find_buttons: 'Find Download Buttons',
  popup_feedback_triggered: 'Done. If LRC and SRT do not appear on the cover, sign in to Suno and refresh the page.',
  popup_feedback_trigger_failed: 'Could not reach the Suno page. Refresh the tab, then try again.',
  popup_feedback_no_tab: 'No active browser tab was found.',
  popup_steps_heading: 'How to use',
  popup_step_login_title: 'Sign in to Suno',
  popup_step_login_body: 'Use your existing Suno account in this browser.',
  popup_step_open_title: 'Open a song page',
  popup_step_open_body: 'The URL should look like https://suno.com/song/...',
  popup_step_download_title: 'Click LRC or SRT',
  popup_step_download_body: 'The buttons appear at the top of the song cover after lyrics are found.',
  popup_login_hint_title: 'No buttons yet?',
  popup_login_hint_body: 'If you are not signed in to Suno, the extension cannot read lyric data. Sign in, refresh the song page, then try again.',
  popup_troubleshooting_heading: 'If you do not see buttons',
  popup_troubleshooting_login: 'If you are not signed in to Suno, download buttons will not appear.',
  popup_troubleshooting_song_page: 'Use a song detail page, not the home, create, or playlist page.',
  popup_troubleshooting_cover: 'Wait for the song cover to finish loading, or refresh the page.',
  popup_troubleshooting_aligned: 'Some songs do not provide synchronized lyric timing data.',
  popup_footer_tip: 'Tip: LRC is for music players. SRT is for subtitles and video editors.'
};

let currentTab: CurrentTabState = {
  pageState: 'loading'
};
let feedback = '';

function getMessage(key: string): string {
  return chrome.i18n.getMessage(key) || fallbackMessages[key] || key;
}

function getPageState(url?: string): PageState {
  if (!url) {
    return 'unknown';
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== 'suno.com' && !parsedUrl.hostname.endsWith('.suno.com')) {
      return 'not_suno';
    }

    return parsedUrl.pathname.startsWith('/song/') ? 'song_page' : 'suno_page';
  } catch {
    return 'unknown';
  }
}

function getStatusMessage(pageState: PageState): string {
  if (pageState === 'loading') {
    return getMessage('popup_status_loading');
  }
  if (pageState === 'not_suno') {
    return getMessage('popup_status_not_suno');
  }
  if (pageState === 'suno_page') {
    return getMessage('popup_status_suno_page');
  }
  if (pageState === 'song_page') {
    return getMessage('popup_status_song_page');
  }
  return getMessage('popup_status_unknown');
}

function element<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  options: {
    className?: string;
    text?: string;
    attrs?: Record<string, string>;
    onClick?: (event: MouseEvent) => void;
  } = {},
  children: Child[] = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tagName);
  if (options.className) {
    node.className = options.className;
  }
  if (options.text !== undefined) {
    node.textContent = options.text;
  }
  Object.entries(options.attrs ?? {}).forEach(([name, value]) => {
    node.setAttribute(name, value);
  });
  if (options.onClick) {
    node.addEventListener('click', (event) => options.onClick?.(event as MouseEvent));
  }
  children.forEach((child) => {
    if (!child) {
      return;
    }
    node.append(child instanceof Node ? child : document.createTextNode(child));
  });
  return node;
}

function render(): void {
  const root = document.getElementById('root');
  if (!root) {
    return;
  }

  document.title = getMessage('extension_name');
  root.replaceChildren(buildPopup());
}

function setFeedback(value: string): void {
  feedback = value;
  render();
}

function openSuno(): void {
  chrome.tabs.create({ url: SUNO_HOME_URL });
}

async function findDownloadButtons(): Promise<void> {
  if (!currentTab.id) {
    setFeedback(getMessage('popup_feedback_no_tab'));
    return;
  }

  try {
    await chrome.tabs.sendMessage(currentTab.id, { action: 'MANUALLY_TRIGGER' });
    setFeedback(getMessage('popup_feedback_triggered'));
  } catch {
    setFeedback(getMessage('popup_feedback_trigger_failed'));
  }
}

function buildPopup(): HTMLElement {
  const primaryAction = currentTab.pageState === 'song_page'
    ? { label: getMessage('popup_button_find_buttons'), onClick: () => void findDownloadButtons() }
    : { label: getMessage('popup_button_open_suno'), onClick: openSuno };

  return element('main', { className: 'w-[360px] bg-neutral-950 text-neutral-50' }, [
    buildHeader(),
    element('section', { className: 'px-4 py-4' }, [
      buildDemoImage(),
      buildStatusCard(primaryAction),
      currentTab.pageState === 'song_page' ? buildLoginHint() : undefined,
      buildSteps(),
      buildTroubleshooting(),
      element('p', {
        className: 'mt-4 text-[12px] leading-5 text-neutral-500',
        text: getMessage('popup_footer_tip')
      })
    ])
  ]);
}

function buildHeader(): HTMLElement {
  return element('section', {
    className: 'border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.24),transparent_34%),linear-gradient(135deg,#111827_0%,#050505_72%)] px-4 py-4'
  }, [
    element('div', { className: 'flex items-start gap-3' }, [
      element('img', {
        className: 'mt-0.5 h-10 w-10 rounded-lg',
        attrs: {
          src: chrome.runtime.getURL('public/icon48.png'),
          alt: ''
        }
      }),
      element('div', {}, [
        element('h1', {
          className: 'text-[18px] font-bold leading-tight tracking-normal',
          text: getMessage('extension_name')
        }),
        element('p', {
          className: 'mt-1 text-[13px] leading-5 text-neutral-300',
          text: getMessage('popup_subtitle')
        })
      ])
    ])
  ]);
}

function buildDemoImage(): HTMLElement {
  return element('div', {
    className: 'overflow-hidden rounded-lg border border-white/10 bg-neutral-900 shadow-2xl shadow-black/40'
  }, [
    element('img', {
      className: 'aspect-[1092/720] w-full object-cover',
      attrs: {
        src: DEMO_URL,
        alt: getMessage('popup_demo_alt')
      }
    })
  ]);
}

function buildStatusCard(primaryAction: { label: string; onClick: (event: MouseEvent) => void }): HTMLElement {
  return element('div', {
    className: 'mt-4 rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-3'
  }, [
    element('p', {
      className: 'text-[13px] leading-5 text-emerald-50',
      text: getStatusMessage(currentTab.pageState)
    }),
    element('button', {
      className: 'mt-3 inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-400 px-4 text-[14px] font-bold text-neutral-950 transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:ring-offset-2 focus:ring-offset-neutral-950',
      text: primaryAction.label,
      attrs: { type: 'button' },
      onClick: primaryAction.onClick
    }),
    feedback
      ? element('p', {
          className: 'mt-2 text-[12px] leading-4 text-emerald-100',
          text: feedback
        })
      : undefined
  ]);
}

function buildLoginHint(): HTMLElement {
  return element('div', {
    className: 'mt-3 rounded-lg border border-amber-300/25 bg-amber-300/10 p-3'
  }, [
    element('p', {
      className: 'text-[13px] font-bold leading-5 text-amber-100',
      text: getMessage('popup_login_hint_title')
    }),
    element('p', {
      className: 'mt-1 text-[12px] leading-5 text-amber-50/90',
      text: getMessage('popup_login_hint_body')
    })
  ]);
}

function buildSteps(): HTMLElement {
  const steps = [
    {
      title: getMessage('popup_step_login_title'),
      body: getMessage('popup_step_login_body')
    },
    {
      title: getMessage('popup_step_open_title'),
      body: getMessage('popup_step_open_body')
    },
    {
      title: getMessage('popup_step_download_title'),
      body: getMessage('popup_step_download_body')
    }
  ];

  return element('section', { className: 'mt-5' }, [
    element('h2', {
      className: 'text-[13px] font-bold uppercase tracking-normal text-neutral-300',
      text: getMessage('popup_steps_heading')
    }),
    element('ol', { className: 'mt-3 space-y-3' }, steps.map((step, index) =>
      element('li', { className: 'grid grid-cols-[28px_1fr] gap-3' }, [
        element('span', {
          className: 'flex h-7 w-7 items-center justify-center rounded-full bg-white text-[13px] font-bold text-neutral-950',
          text: String(index + 1)
        }),
        element('span', {}, [
          element('span', {
            className: 'block text-[14px] font-bold leading-5 text-white',
            text: step.title
          }),
          element('span', {
            className: 'mt-0.5 block text-[12px] leading-5 text-neutral-400',
            text: step.body
          })
        ])
      ])
    ))
  ]);
}

function buildTroubleshooting(): HTMLElement {
  const troubleshootingItems = [
    getMessage('popup_troubleshooting_login'),
    getMessage('popup_troubleshooting_song_page'),
    getMessage('popup_troubleshooting_cover'),
    getMessage('popup_troubleshooting_aligned')
  ];

  return element('section', {
    className: 'mt-5 rounded-lg border border-white/10 bg-white/[0.04] p-3'
  }, [
    element('h2', {
      className: 'text-[13px] font-bold text-neutral-200',
      text: getMessage('popup_troubleshooting_heading')
    }),
    element('ul', { className: 'mt-2 space-y-2' }, troubleshootingItems.map((item) =>
      element('li', { className: 'flex gap-2 text-[12px] leading-5 text-neutral-400' }, [
        element('span', { className: 'mt-[0.45rem] h-1.5 w-1.5 flex-none rounded-full bg-emerald-300' }),
        element('span', { text: item })
      ])
    ))
  ]);
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  currentTab = {
    id: tab?.id,
    url: tab?.url,
    pageState: getPageState(tab?.url)
  };
  render();
});

render();
