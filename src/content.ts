let watchStartTime: number | null = null;
let currentVideoId: string | null = null;
let currentRecordId: number | null = null;
let currentVideoData: any = null;
let extractionIntervalId: number | null = null;
let activePollingId: number | null = null;

const SAVE_INTERVAL_MS = 5000; // Save more frequently to capture real-time data

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

  let videoData = currentVideoData;

  // We are ready to save the first time for this video, or updating.
  const isInitialSave = currentRecordId === null;

  if (isInitialSave || !videoData) {
    videoData = extractVideoData();
    // Don't save if we couldn't extract basic info
    if (!videoData.title || !videoData.channelName) {
      return;
    }
    currentVideoData = videoData;
  }

  const record: any = {
    ...videoData,
    timestamp: isInitialSave ? now : (watchStartTime || now), // Keep original timestamp
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
      console.error('[YouTube History Mapper] Error sending message:', chrome.runtime.lastError);
    } else if (response && response.success) {
      if (isInitialSave) {
        console.log(`[YouTube History Mapper] Detected new video: "${videoData.title}"`);
      }
      currentRecordId = response.id;
      console.log(`[YouTube History Mapper] Saved/Updated record ID: ${response.id} | Watch Time: ${watchTimeSeconds}s`);
    }
  });
}

// Ensure we clean up any running intervals
function clearActiveIntervals() {
  if (activePollingId !== null) {
    window.clearInterval(activePollingId);
    activePollingId = null;
  }
  if (extractionIntervalId !== null) {
    window.clearInterval(extractionIntervalId);
    extractionIntervalId = null;
  }
}

function handleVideoChange() {
  const newVideoId = getVideoId();

  if (newVideoId !== currentVideoId) {
    if (currentVideoId) {
      // Save data for the previous video before switching
      saveCurrentRecord();
    }
    clearActiveIntervals();

    currentVideoId = newVideoId;
    watchStartTime = newVideoId ? Date.now() : null;
    currentRecordId = null;
    currentVideoData = null;

    if (newVideoId) {
      // Initial aggressive polling to wait for DOM elements to load on SPA transitions
      extractionIntervalId = window.setInterval(() => {
        const data = extractVideoData();
        if (data.title && data.channelName) {
          // As soon as data is ready, do the first save and stop aggressive polling
          if (extractionIntervalId !== null) {
            window.clearInterval(extractionIntervalId);
            extractionIntervalId = null;
          }
          saveCurrentRecord();

          // Start the regular save interval
          activePollingId = window.setInterval(() => {
            if (currentVideoId && !document.hidden) {
              saveCurrentRecord();
            }
          }, SAVE_INTERVAL_MS);
        }
      }, 1000);
    }
  }
}

// 1. Listen for YouTube's custom SPA navigation event
document.addEventListener('yt-navigate-finish', () => {
  handleVideoChange();
});

// 2. Also keep the MutationObserver as a fallback for some edge cases
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    handleVideoChange();
  }
}).observe(document, {subtree: true, childList: true});

// Initial setup on hard reload
handleVideoChange();

// Handle tab close or navigation away
window.addEventListener('beforeunload', () => {
  saveCurrentRecord();
});