let watchStartTime: number | null = null;
let currentVideoId: string | null = null;
let lastSaveTime: number | null = null;
let currentRecordId: number | null = null;

const MIN_WATCH_TIME_TO_SAVE_SECONDS = 10;
const SAVE_INTERVAL_MS = 30000;

function getVideoId(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('v')) {
    return urlParams.get('v');
  }
  if (window.location.pathname.startsWith('/shorts/')) {
    return window.location.pathname.split('/')[2] || null;
  }
  return null;
}

function extractVideoData() {
  const titleEl = document.querySelector('h1.ytd-video-primary-info-renderer, h1.ytd-watch-metadata, title');
  const title = titleEl ? (titleEl as HTMLElement).innerText || titleEl.textContent || '' : '';

  const metaTags = Array.from(document.querySelectorAll('meta[name="keywords"]'));
  const tags = metaTags.length > 0 ? (metaTags[0] as HTMLMetaElement).content.split(',').map((t) => t.trim()) : [];

  const channelNameEl = document.querySelector('.ytd-channel-name a');
  const channelName = channelNameEl ? (channelNameEl as HTMLElement).innerText : '';

  const channelIconEl = document.querySelector('#avatar img.yt-img-shadow');
  const channelIconUrl = channelIconEl ? (channelIconEl as HTMLImageElement).src : '';

  const channelUrlEl = document.querySelector('.ytd-channel-name a');
  const channelUrl = channelUrlEl ? (channelUrlEl as HTMLAnchorElement).href : '';

  const isShorts = window.location.pathname.startsWith('/shorts/');

  return {
    videoId: getVideoId() || '',
    title: title.replace(' - YouTube', '').trim(),
    tags,
    channelName,
    channelId: channelUrl.split('/').pop() || '',
    channelIconUrl,
    channelUrl,
    type: isShorts ? 'shorts' : 'video' as 'video' | 'shorts',
  };
}

async function saveCurrentRecord() {
  if (!watchStartTime || !currentVideoId) return;

  const now = Date.now();
  const watchTimeSeconds = Math.floor((now - watchStartTime) / 1000);

  if (watchTimeSeconds < MIN_WATCH_TIME_TO_SAVE_SECONDS) return;

  // Prevent spamming saves too frequently
  if (lastSaveTime && now - lastSaveTime < SAVE_INTERVAL_MS) return;

  const videoData = extractVideoData();

  // Don't save if we couldn't extract basic info
  if (!videoData.title || !videoData.channelName) return;

  const record: any = {
    ...videoData,
    timestamp: now,
    watchTimeSeconds,
    extractedKeywords: [],
  };

  if (currentRecordId) {
    record.id = currentRecordId;
  }

  // NLP processing in content script
  try {
    const { processVideoKeywords } = await import('./nlp');
    record.extractedKeywords = await processVideoKeywords(record.title, record.tags);
  } catch (err) {
    console.error('Error extracting keywords in content script:', err);
  }

  chrome.runtime.sendMessage({ type: 'SAVE_VIDEO_RECORD', data: record }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error sending message:', chrome.runtime.lastError);
    } else if (response && response.success) {
      lastSaveTime = now;
      currentRecordId = response.id;
      console.log('Video record saved/updated successfully.');
    }
  });
}

function handleVideoChange() {
  const newVideoId = getVideoId();

  if (newVideoId !== currentVideoId) {
    if (currentVideoId) {
      // Save data for the previous video before switching
      saveCurrentRecord();
    }
    currentVideoId = newVideoId;
    watchStartTime = newVideoId ? Date.now() : null;
    lastSaveTime = null;
    currentRecordId = null;
  }
}

// Observe URL changes for SPAs (Single Page Applications) like YouTube
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    handleVideoChange();
  }
}).observe(document, {subtree: true, childList: true});

// Also check periodically in case the user stays on the same video for a long time
setInterval(() => {
  if (currentVideoId && !document.hidden) {
    saveCurrentRecord();
  }
}, SAVE_INTERVAL_MS);

// Initial setup
handleVideoChange();

// Handle tab close or navigation away
window.addEventListener('beforeunload', () => {
  saveCurrentRecord();
});