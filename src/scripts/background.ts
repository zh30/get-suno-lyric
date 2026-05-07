chrome.action.setPopup({ popup: 'popup.html' }).catch((error) => {
  console.error('Error setting popup:', error);
});

export {};

const SUNO_API_BASE_URL = 'https://studio-api.prod.suno.com';

interface FetchSunoApiMessage {
  action: 'FETCH_SUNO_API';
  path: string;
  token: string;
}

interface FetchSunoApiResponse {
  ok: boolean;
  status?: number;
  data?: unknown;
  error?: string;
}

function isFetchSunoApiMessage(message: unknown): message is FetchSunoApiMessage {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const candidate = message as Record<string, unknown>;
  return (
    candidate.action === 'FETCH_SUNO_API' &&
    typeof candidate.path === 'string' &&
    typeof candidate.token === 'string'
  );
}

async function fetchSunoApi(message: FetchSunoApiMessage): Promise<FetchSunoApiResponse> {
  if (!message.path.startsWith('/api/')) {
    return {
      ok: false,
      error: 'Invalid Suno API path'
    };
  }

  try {
    const response = await fetch(`${SUNO_API_BASE_URL}${message.path}`, {
      headers: {
        'Authorization': `Bearer ${message.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `Suno API request failed with status ${response.status}`
      };
    }

    return {
      ok: true,
      status: response.status,
      data: await response.json()
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Suno API request failed'
    };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isFetchSunoApiMessage(message)) {
    return false;
  }

  fetchSunoApi(message).then(sendResponse);
  return true;
});

// 监听标签页 URL 变化
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 只有当 URL 变化时才处理
  if (changeInfo.url) {
    const url = new URL(changeInfo.url);

    // 检查 URL 是否匹配歌曲详情页模式
    if (url.pathname.startsWith('/song/')) {
      // 向内容脚本发送消息，通知 URL 已变化到歌曲页面
      chrome.tabs.sendMessage(tabId, {
        action: "URL_CHANGED",
        url: changeInfo.url,
        songId: url.pathname.split('/').pop()
      }).catch(error => {
        // 如果内容脚本尚未加载，这个错误是正常的，可以忽略
        // console.debug("Could not send message to content script:", error);
      });
    }
  }
});
