import { saveVideoRecord } from './db';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_VIDEO_RECORD') {
    (async () => {
      try {
        const record = message.data;
        const id = await saveVideoRecord(record);
        console.log(`Saved video record with ID: ${id}`);
        sendResponse({ success: true, id });
      } catch (error: any) {
        console.error('Failed to save video record:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep the message channel open for async response
  }
});

chrome.action.onClicked.addListener(() => {
  const url = chrome.runtime.getURL('src/dashboard/index.html');
  chrome.tabs.create({ url });
});
