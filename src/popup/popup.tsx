import '../styles/tailwind.css';
import React from 'react';
import ReactDOM from 'react-dom/client';

type PageState = 'loading' | 'not_suno' | 'suno_page' | 'song_page' | 'unknown';

interface CurrentTabState {
  id?: number;
  url?: string;
  pageState: PageState;
}

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
  popup_status_song_page: 'Song page detected. You can search for the download buttons now.',
  popup_status_unknown: 'Open a Suno song detail page to use this extension.',
  popup_button_open_suno: 'Open Suno',
  popup_button_find_buttons: 'Find Download Buttons',
  popup_feedback_triggered: 'Done. Look for LRC and SRT on the top of the song cover.',
  popup_feedback_trigger_failed: 'Could not reach the Suno page. Refresh the tab, then try again.',
  popup_feedback_no_tab: 'No active browser tab was found.',
  popup_steps_heading: 'How to use',
  popup_step_login_title: 'Sign in to Suno',
  popup_step_login_body: 'Use your existing Suno account in this browser.',
  popup_step_open_title: 'Open a song page',
  popup_step_open_body: 'The URL should look like https://suno.com/song/...',
  popup_step_download_title: 'Click LRC or SRT',
  popup_step_download_body: 'The buttons appear at the top of the song cover after lyrics are found.',
  popup_troubleshooting_heading: 'If you do not see buttons',
  popup_troubleshooting_login: 'Make sure you are signed in to Suno.',
  popup_troubleshooting_song_page: 'Use a song detail page, not the home, create, or playlist page.',
  popup_troubleshooting_cover: 'Wait for the song cover to finish loading, or refresh the page.',
  popup_troubleshooting_aligned: 'Some songs do not provide synchronized lyric timing data.',
  popup_footer_tip: 'Tip: LRC is for music players. SRT is for subtitles and video editors.'
};

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

function Popup() {
  const [currentTab, setCurrentTab] = React.useState<CurrentTabState>({
    pageState: 'loading'
  });
  const [feedback, setFeedback] = React.useState('');

  React.useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      setCurrentTab({
        id: tab?.id,
        url: tab?.url,
        pageState: getPageState(tab?.url)
      });
    });
  }, []);

  const openSuno = () => {
    chrome.tabs.create({ url: SUNO_HOME_URL });
  };

  const findDownloadButtons = async () => {
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
  };

  const primaryAction =
    currentTab.pageState === 'song_page'
      ? { label: getMessage('popup_button_find_buttons'), onClick: findDownloadButtons }
      : { label: getMessage('popup_button_open_suno'), onClick: openSuno };

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

  const troubleshootingItems = [
    getMessage('popup_troubleshooting_login'),
    getMessage('popup_troubleshooting_song_page'),
    getMessage('popup_troubleshooting_cover'),
    getMessage('popup_troubleshooting_aligned')
  ];

  return (
    <main className="w-[360px] bg-neutral-950 text-neutral-50">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.24),transparent_34%),linear-gradient(135deg,#111827_0%,#050505_72%)] px-4 py-4">
        <div className="flex items-start gap-3">
          <img
            src={chrome.runtime.getURL('public/icon48.png')}
            alt=""
            className="mt-0.5 h-10 w-10 rounded-lg"
          />
          <div>
            <h1 className="text-[18px] font-bold leading-tight tracking-normal">
              {getMessage('extension_name')}
            </h1>
            <p className="mt-1 text-[13px] leading-5 text-neutral-300">
              {getMessage('popup_subtitle')}
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 py-4">
        <div className="overflow-hidden rounded-lg border border-white/10 bg-neutral-900 shadow-2xl shadow-black/40">
          <img
            src={DEMO_URL}
            alt={getMessage('popup_demo_alt')}
            className="aspect-[1092/720] w-full object-cover"
          />
        </div>

        <div className="mt-4 rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-3">
          <p className="text-[13px] leading-5 text-emerald-50">
            {getStatusMessage(currentTab.pageState)}
          </p>
          <button
            type="button"
            onClick={primaryAction.onClick}
            className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-400 px-4 text-[14px] font-bold text-neutral-950 transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:ring-offset-2 focus:ring-offset-neutral-950"
          >
            {primaryAction.label}
          </button>
          {feedback && (
            <p className="mt-2 text-[12px] leading-4 text-emerald-100">
              {feedback}
            </p>
          )}
        </div>

        <section className="mt-5">
          <h2 className="text-[13px] font-bold uppercase tracking-normal text-neutral-300">
            {getMessage('popup_steps_heading')}
          </h2>
          <ol className="mt-3 space-y-3">
            {steps.map((step, index) => (
              <li key={step.title} className="grid grid-cols-[28px_1fr] gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[13px] font-bold text-neutral-950">
                  {index + 1}
                </span>
                <span>
                  <span className="block text-[14px] font-bold leading-5 text-white">
                    {step.title}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-5 text-neutral-400">
                    {step.body}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-5 rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <h2 className="text-[13px] font-bold text-neutral-200">
            {getMessage('popup_troubleshooting_heading')}
          </h2>
          <ul className="mt-2 space-y-2">
            {troubleshootingItems.map((item) => (
              <li key={item} className="flex gap-2 text-[12px] leading-5 text-neutral-400">
                <span className="mt-[0.45rem] h-1.5 w-1.5 flex-none rounded-full bg-emerald-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-4 text-[12px] leading-5 text-neutral-500">
          {getMessage('popup_footer_tip')}
        </p>
      </section>
    </main>
  );
}

const container = document.getElementById('root');
document.title = getMessage('extension_name');
const root = ReactDOM.createRoot(container as HTMLElement);
root.render(<Popup />);
