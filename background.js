chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'download') {
    handleDownload(request, sendResponse);
    return true; // Keep message channel open
  }
});

async function handleDownload(request, sendResponse) {
  try {
    const highQualityUrl = getHighestQualityUrl(request.url);
    const filename = generateFilename(request.title, request.index);
    
    // Try primary URL first
    try {
      const downloadId = await initiateDownload(highQualityUrl, filename);
      await trackDownload(downloadId);
      sendResponse({ success: true, filename });
    } catch (error) {
      // If primary fails, try fallback URL
      const fallbackUrl = getFallbackUrl(request.url);
      const downloadId = await initiateDownload(fallbackUrl, filename);
      await trackDownload(downloadId);
      sendResponse({ success: true, filename });
    }
  } catch (error) {
    sendResponse({ 
      success: false, 
      error: error.message,
      attempted_url: request.url
    });
  }
}

function getHighestQualityUrl(originalUrl) {
  // Remove any existing size parameters
  let baseUrl = originalUrl
    .replace(/il_\d+x\d+\./i, 'il_fullxfull.')
    .replace(/il_\d+xN\./i, 'il_fullxfull.');
  
  // Ensure we're getting the fullxfull version
  if (!baseUrl.includes('fullxfull')) {
    baseUrl = baseUrl.replace(/\.(jpg|jpeg|png|gif)/, '_fullxfull.$1');
  }
  
  return baseUrl;
}

function getFallbackUrl(originalUrl) {
  return originalUrl.replace(/il_\d+x\d+\./, 'il_1140xN.');
}

function generateFilename(title, index) {
  const cleanTitle = (title || 'etsy_image')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  
  const timestamp = new Date().toISOString()
    .replace(/[:]/g, '-')
    .replace(/\..+/, '');
  
  const indexSuffix = index ? `_${index}` : '';
  return `etsy_${cleanTitle}${indexSuffix}_${timestamp}.jpg`;
}

function initiateDownload(url, filename) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(downloadId);
      }
    });
  });
}

function trackDownload(downloadId) {
  return new Promise((resolve, reject) => {
    chrome.downloads.onChanged.addListener(function listener(delta) {
      if (delta.id === downloadId) {
        if (delta.state && delta.state.current === 'complete') {
          chrome.downloads.onChanged.removeListener(listener);
          resolve();
        } else if (delta.error) {
          chrome.downloads.onChanged.removeListener(listener);
          reject(new Error(delta.error.current));
        }
      }
    });
  });
}