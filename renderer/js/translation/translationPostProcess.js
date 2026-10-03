/**
 * ZumiTranslator - Translation Post Process Service
 * Quản lý kiểm tra chất lượng bản dịch (nghi ngờ lỗi, thiếu đoạn),
 * hiển thị danh sách chương hoàn thành và công cụ tìm/thay thế hàng loạt (Batch Replace).
 */

const TranslationPostProcess = {
  renderCompletedChapters() {
    const container = UI.$('#previewContent');
    if (!container) return;
    container.innerHTML = State.finishedChapters.map((fc, idx) => {
      const isSuspicious = this.isTranslationSuspicious(fc);
      const foreign = window.ForeignDetector ? ForeignDetector.detect(fc.content) : null;
      
      return `
        <div class="finished-chapter-card ${isSuspicious ? 'suspicious' : ''} ${foreign && foreign.hasForeign ? 'has-foreign-chars' : ''}" data-idx="${idx}" data-source-id="${fc.sourceChapterId}">
          <div class="finished-chapter-selection">
            <input type="checkbox" class="finished-chapter-checkbox" data-idx="${idx}">
          </div>
          <div class="finished-chapter-info">
            <div class="title-row" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="finished-chapter-title">${fc.title}</span>
              ${isSuspicious ? '<span class="warning-badge" title="Bản dịch có vẻ giống văn bản gốc hoặc bị lỗi. Click để xem chi tiết.">⚠️ Lỗi?</span>' : ''}
              ${foreign && foreign.hasForeign ? `
                <span class="foreign-badge" title="${foreign.warningMessage}">
                  ⚠️ ${foreign.warningMessage}
                </span>
              ` : ''}
            </div>
            <span class="finished-chapter-meta">${Utils.formatWordCount(Utils.countWords(fc.content))}</span>
          </div>
          <div class="finished-chapter-actions">
             ${foreign && foreign.hasForeign ? `
               <button class="auto-fix-btn" data-idx="${idx}" title="Gọi AI dịch nốt các từ ngoại ngữ còn sót">
                 Sửa AI
               </button>
             ` : ''}
             <button class="btn btn-secondary btn-sm re-translate-btn" data-idx="${idx}" title="Dịch lại chương này">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6m-10 10H1v-6m22 2c-1.5 4.3-5.5 7.4-10.2 7.4-6.6 0-12-5.4-12-12 0-3.3 1.3-6.2 3.5-8.4L11 2m12 10c0-3.3-1.3-6.2-3.5-8.4L13 14"/></svg>
               <span>Dịch lại</span>
             </button>
             <button class="btn btn-secondary btn-sm view-chapter-btn" data-idx="${idx}">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
               <span>Xem</span>
             </button>
             <button class="btn btn-secondary btn-sm delete-chapter-btn" data-idx="${idx}">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
               <span>Xóa</span>
             </button>
          </div>
        </div>
      `;
    }).join('');
    
    const countEl = UI.$('#completedChaptersCount');
    if (countEl) countEl.textContent = `${State.finishedChapters.length} chương`;
  },

  findAndScrollToFaultyChapter() {
    const faultyCards = UI.$$('.finished-chapter-card.suspicious, .finished-chapter-card.suspicious-completeness');
    
    if (faultyCards.length === 0) {
      Utils.showToast('Tuyệt vời! Không tìm thấy chương nào bị nghi ngờ lỗi.', 'success');
      return;
    }
    
    const firstFaulty = faultyCards[0];
    firstFaulty.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    firstFaulty.classList.add('highlight-fault');
    setTimeout(() => firstFaulty.classList.remove('highlight-fault'), 3000);
    
    Utils.showToast(`Phát hiện ${faultyCards.length} chương có dấu hiệu bị lỗi hoặc thiếu nội dung.`, 'warning');
  },

  isTranslationSuspicious(fc) {
    if (!fc.content || !fc.sourceContent) return false;
    
    const source = fc.sourceContent.trim();
    const trans = fc.content.trim();

    if (trans === source) return true;
    
    const checkLen = Math.min(300, source.length, trans.length);
    if (checkLen > 50 && source.substring(0, checkLen) === trans.substring(0, checkLen)) {
      const lenDiffRatio = Math.abs(source.length - trans.length) / source.length;
      if (lenDiffRatio < 0.2) return true;
    }

    if (State.settings.targetLang === 'vi') {
      const foreignRegex = /[\u4e00-\u9fa5\uac00-\ud7af\u3040-\u309f\u30a0-\u30ff]/g;
      const originalCount = (source.match(foreignRegex) || []).length;
      const translatedCount = (trans.match(foreignRegex) || []).length;
      
      if (originalCount > 20 && translatedCount > originalCount * 0.1) {
        return true;
      }
    }

    if (source.length > 1000 && trans.length < source.length * 0.25) {
      return true;
    }

    const refusalPatterns = [
      /xin lỗi/i, /không thể/i, /vi phạm/i, /chính sách/i, /nhạy cảm/i,
      /I'm sorry/i, /I cannot/i, /violates/i, /safety/i, /policy/i,
      /an toàn/i, /mô hình ngôn ngữ/i
    ];
    if (trans.length < 500 && refusalPatterns.some(p => p.test(trans))) {
      return true;
    }

    if (trans.includes('<thought>') || trans.includes('</thought>') || trans.toLowerCase().includes('thinking:')) {
      return true;
    }

    if (source.length > 1000) {
      const midS = source.substring(source.length / 2, source.length / 2 + 100);
      const midT = trans.substring(trans.length / 2, trans.length / 2 + 100);
      if (midS.length > 50 && midS === midT) return true;
    }

    return false;
  },

  compareAndReportCompleteness() {
    if (State.chapters.length === 0) {
      Utils.showToast('Chưa có danh sách chương để kiểm tra.', 'info');
      return;
    }

    let reportMissing = [];
    let reportFaulty = [];
    let totalChecked = State.chapters.length;
    let finishedCount = State.finishedChapters.length;

    State.chapters.forEach((ch) => {
      const fc = State.finishedChapters.find(f => f.sourceChapterId === ch.id);
      
      if (!fc) {
        reportMissing.push(ch.title);
      } else {
        const sourceSegments = ch.content.split('\n').filter(s => s.trim().length > 0).length;
        const transSegments = fc.content.split('\n').filter(s => s.trim().length > 0).length;
        
        const percentage = sourceSegments > 0 ? (transSegments / sourceSegments) * 100 : 100;
        const rounded = Math.round(percentage);
        
        const card = UI.$(`.finished-chapter-card[data-idx="${State.finishedChapters.indexOf(fc)}"]`);
        if (rounded < 90) {
          reportFaulty.push(`- ${ch.title}: ${rounded}% đầy đủ (${transSegments}/${sourceSegments} đoạn)`);
          if (card) {
            card.classList.add('suspicious-completeness');
            let badge = card.querySelector('.completeness-badge');
            if (!badge) {
              badge = document.createElement('span');
              badge.className = 'completeness-badge';
              card.querySelector('.title-row').appendChild(badge);
            }
            badge.textContent = `${rounded}% đầy đủ`;
          }
        } else {
          if (card) {
            card.classList.remove('suspicious-completeness');
            const badge = card.querySelector('.completeness-badge');
            if (badge) badge.remove();
          }
        }
      }
    });

    let finalMsg = `TỔNG QUAN ĐỘ ĐẦY ĐỦ (${finishedCount}/${totalChecked} chương đã dịch):\n\n`;
    
    if (reportFaulty.length > 0) {
      finalMsg += `❌ PHÁT HIỆN ${reportFaulty.length} CHƯƠNG THIẾU NỘI DUNG:\n${reportFaulty.join('\n')}\n\n`;
    } else {
      finalMsg += `✅ Không có chương dịch nào bị thiếu đoạn văn đáng kể.\n\n`;
    }

    if (reportMissing.length > 0) {
      const missingHint = reportMissing.length > 10 
        ? `${reportMissing.slice(0, 10).join(', ')}... (và ${reportMissing.length - 10} chương khác)`
        : reportMissing.join(', ');
      finalMsg += `⚠️ CÓ ${reportMissing.length} CHƯƠNG CHƯA DỊCH:\n${missingHint}\n`;
    } else {
      finalMsg += `✅ Tất cả chương trong file đã được dịch xong.\n`;
    }

    alert(finalMsg);
  },

  batchReplace(findText, replaceText, options = {}) {
    if (!findText) return { chapters: 0, occurrences: 0 };
    
    const { scope = 'finished', caseSensitive = false, useRegex = false, wholeWord = false } = options;
    let modifiedChapters = 0;
    let totalOccurrences = 0;
    
    let regex;
    try {
      if (useRegex) {
        regex = new RegExp(findText, caseSensitive ? 'g' : 'gi');
      } else {
        const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (wholeWord) {
          const letterClass = '[a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]';
          regex = new RegExp(`(?<!${letterClass})${escaped}(?!${letterClass})`, caseSensitive ? 'g' : 'gi');
        } else {
          regex = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
        }
      }
    } catch (e) {
      throw new Error(`Biểu thức chính quy không hợp lệ: ${e.message}`);
    }

    const performReplace = (obj, field) => {
      const original = obj[field] || '';
      if (!original) return false;
      const matches = original.match(regex);
      if (matches) {
        obj[field] = original.replace(regex, () => replaceText);
        totalOccurrences += matches.length;
        return true;
      }
      return false;
    };

    if (scope === 'finished' || scope === 'both') {
      State.finishedChapters.forEach(fc => {
        let changed = false;
        if (performReplace(fc, 'content')) changed = true;
        if (performReplace(fc, 'title')) changed = true;
        if (changed) modifiedChapters++;
      });
    }

    if (scope === 'source' || scope === 'both') {
      State.chapters.forEach(ch => {
        let changed = false;
        if (performReplace(ch, 'content')) changed = true;
        if (performReplace(ch, 'title')) changed = true;
        if (performReplace(ch, 'originalTitle')) changed = true;
        if (changed) modifiedChapters++;
      });
      if (window.Bookshelf && typeof window.Bookshelf.recalculateTitles === 'function') {
        Bookshelf.recalculateTitles();
      }
    }

    if (totalOccurrences > 0) {
      State.updateFinishedChapters();
      State.saveTranslationProgress(State.finishedChapters.length);
      this.renderCompletedChapters();
      if (window.Bookshelf && typeof window.Bookshelf.renderChapterList === 'function') {
        Bookshelf.renderChapterList();
      }

      if (window.ChapterWorkspace) {
        if (ChapterWorkspace.isEditing) {
          ChapterWorkspace.toggleEditMode(false);
        }
        if (typeof ChapterWorkspace.renderActiveContent === 'function') {
          ChapterWorkspace.renderActiveContent();
        }
        if (typeof ChapterWorkspace.renderListOnly === 'function') {
          ChapterWorkspace.renderListOnly();
        }
      }
    }

    return { chapters: modifiedChapters, occurrences: totalOccurrences };
  }
};

if (typeof window !== 'undefined') {
  window.TranslationPostProcess = TranslationPostProcess;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TranslationPostProcess;
}
