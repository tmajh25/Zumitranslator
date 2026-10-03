/**
 * UTILS MODULE
 * Utility functions for formatting and processing
 */

const Utils = {
  // Toast notification
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '';
    if (type === 'success') icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>';
    else if (type === 'error') icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    else icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => container.removeChild(toast), 300);
    }, 4000);
  },

  // Split text into chunks based on limit, respecting paragraphs and sentence boundaries
  splitIntoChunks(text, limit) {
    if (!text || text.length <= limit) return [text || ''];
    
    const chunks = [];
    let currentText = text;
    const minThreshold = limit * 0.55; // Prefer good break points within 55%-100% of chunk limit
    
    while (currentText.length > 0) {
      if (currentText.length <= limit) {
        chunks.push(currentText.trim());
        break;
      }
      
      let splitIndex = -1;

      // 1. Try splitting at double newline (paragraph boundary)
      const pIndex = currentText.lastIndexOf('\n\n', limit);
      if (pIndex >= minThreshold) {
        splitIndex = pIndex + 2;
      }

      // 2. Try splitting at single newline
      if (splitIndex === -1) {
        const nIndex = currentText.lastIndexOf('\n', limit);
        if (nIndex >= minThreshold) {
          splitIndex = nIndex + 1;
        }
      }

      // 3. Try splitting at sentence endings (CJK and Western)
      if (splitIndex === -1) {
        const searchRange = currentText.substring(0, limit);
        const sentenceDelimiters = ['. ', '! ', '? ', '… ', '。\n', '！\n', '？\n', '。', '！', '？', '」\n', '』\n', '」', '』'];
        
        let bestIndex = -1;
        for (const delim of sentenceDelimiters) {
          const idx = searchRange.lastIndexOf(delim);
          if (idx >= minThreshold && idx + delim.length > bestIndex) {
            bestIndex = idx + delim.length;
          }
        }
        if (bestIndex !== -1) {
          splitIndex = bestIndex;
        }
      }

      // 4. Try splitting at space or comma
      if (splitIndex === -1) {
        const spaceIndex = currentText.lastIndexOf(' ', limit);
        if (spaceIndex >= minThreshold) {
          splitIndex = spaceIndex + 1;
        }
      }

      // 5. Fallback: hard cut at limit
      if (splitIndex === -1) {
        splitIndex = limit;
      }
      
      const chunk = currentText.substring(0, splitIndex).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
      currentText = currentText.substring(splitIndex).trim();
    }
    
    return chunks.filter(c => c.length > 0);
  },

  // Format milliseconds to MM:SS
  formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  },

  // Escape HTML characters safely for text content and attribute values
  escapeHtml(text) {
    if (text == null) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  // Count words across languages (supports Latin, Vietnamese, CJK/Hán tự)
  countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    // Strip image markers so they don't distort word counts
    const clean = text.replace(/\[IMG:[^\]]+\]/g, ' ');
    // Count CJK characters as individual words/morphemes
    const cjkChars = (clean.match(/[\u4e00-\u9fa5\u3040-\u30ff\u3400-\u4dbf]/g) || []).length;
    // Remove CJK characters before counting spaced words
    const nonCjkText = clean.replace(/[\u4e00-\u9fa5\u3040-\u30ff\u3400-\u4dbf]/g, ' ').trim();
    const spacedWords = nonCjkText ? (nonCjkText.match(/\S+/gu) || []).length : 0;
    return cjkChars + spacedWords;
  },

  // Format word count string
  formatWordCount(count) {
    return `${(count || 0).toLocaleString()} từ`;
  },

  // Count images in text
  countImages(text) {
    if (!text || typeof text !== 'string') return 0;
    const imgMatches = text.match(/\[IMG:[^\]]+\]/gi) || [];
    const htmlImgMatches = text.match(/<img\b[^>]*>/gi) || [];
    const mdImgMatches = text.match(/!\[.*?\]\(.*?\)/g) || [];
    return imgMatches.length + htmlImgMatches.length + mdImgMatches.length;
  },

  // Standardized Image Badge HTML with SVG icon
  getImageBadgeHtml(imageCount = 1, extraClass = '') {
    const cls = extraClass ? `image-badge-micro ${extraClass}` : 'image-badge-micro';
    const countLabel = imageCount > 1 ? `<span>${imageCount}</span>` : '';
    const tooltip = imageCount > 1 ? `Chương có ${imageCount} hình ảnh minh họa` : 'Chương có hình ảnh minh họa';
    return `<span class="${cls}" title="${tooltip}"><svg class="image-badge-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>${countLabel}</span>`;
  }
};

window.Utils = Utils;
