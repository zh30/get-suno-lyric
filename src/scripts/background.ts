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

// 处理扩展图标点击事件
chrome.action.onClicked.addListener((tab) => {
  if (tab.url && tab.url.includes('suno.com/song/')) {
    // 如果当前在歌曲页面，向内容脚本发送消息，手动触发功能
    chrome.tabs.sendMessage(tab.id!, {
      action: "MANUALLY_TRIGGER"
    }).catch(error => {
      console.error("Error sending manual trigger message:", error);
    });
  }
});