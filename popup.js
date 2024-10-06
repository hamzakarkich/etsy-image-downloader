document.addEventListener('DOMContentLoaded', function() {
  const statusDiv = document.getElementById('status');
  const downloadMainBtn = document.getElementById('downloadMain');
  const downloadAllBtn = document.getElementById('downloadAll');

  function showStatus(message, type = 'progress') {
    statusDiv.textContent = message;
    statusDiv.className = type;
    if (type === 'success') {
      setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = '';
      }, 3000);
    }
  }

  async function findImages() {
    const results = await chrome.tabs.query({active: true, currentWindow: true});
    const tab = results[0];
    
    if (!tab?.url?.includes('etsy.com')) {
      throw new Error('Please navigate to an Etsy listing page');
    }

    const images = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Find all possible image containers
        const selectors = [
          '.listing-page-image-carousel-component img',
          '.carousel-image',
          '.carousel-pane img',
          '.listing-page-image img',
          'img[data-zoom-image]',
          '.listing-right-nav img'
        ];

        const images = [];
        selectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(img => {
            const possibleSources = [
              img.dataset.originalImage,
              img.dataset.fullImage,
              img.dataset.zoom,
              img.dataset.srcZoom,
              img.dataset.src,
              img.src
            ];
            const imageUrl = possibleSources.find(src => src) || img.src;
            if (imageUrl && !images.includes(imageUrl)) {
              images.push(imageUrl);
            }
          });
        });

        const title = document.querySelector([
          '.listing-page-title-component h1',
          '.listing-title',
          'h1[data-listing-id]'
        ].join(','))?.textContent?.trim();

        return { images, title };
      }
    });

    return images[0]?.result || { images: [], title: '' };
  }

  async function downloadImages(all = false) {
    try {
      downloadMainBtn.disabled = true;
      downloadAllBtn.disabled = true;
      showStatus('Finding images...');

      const { images, title } = await findImages();
      
      if (!images.length) {
        throw new Error('No images found on this page');
      }

      const imagesToDownload = all ? images : [images[0]];
      showStatus(`Downloading ${imagesToDownload.length} image(s)...`);

      for (let i = 0; i < imagesToDownload.length; i++) {
        const response = await new Promise(resolve => {
          chrome.runtime.sendMessage({
            action: 'download',
            url: imagesToDownload[i],
            title: title,
            index: all ? i + 1 : null
          }, resolve);
        });

        if (!response.success) {
          throw new Error(response.error || 'Download failed');
        }
      }

      showStatus(`Successfully downloaded ${imagesToDownload.length} image(s)!`, 'success');
    } catch (error) {
      showStatus(error.message, 'error');
    } finally {
      downloadMainBtn.disabled = false;
      downloadAllBtn.disabled = false;
    }
  }

  downloadMainBtn.addEventListener('click', () => downloadImages(false));
  downloadAllBtn.addEventListener('click', () => downloadImages(true));
});