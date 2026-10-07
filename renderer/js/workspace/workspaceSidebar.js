/**
 * ZumiTranslator - Workspace Sidebar Service
 * Quản lý danh sách chương bên trái, bộ lọc (Tất cả / Chưa dịch / Đã dịch),
 * tìm kiếm chương, đếm số từ và thanh tỷ lệ ngôn ngữ theo SRP.
 */

const WorkspaceSidebar = {
  toggleChapterSidebar(forceState) {
    const workspace = UI.$('.epub-forge-workspace');
    if (!workspace) return;
    const isCollapsed = forceState !== undefined ? forceState : !workspace.classList.contains('toc-collapsed');
    workspace.classList.toggle('toc-collapsed', isCollapsed);
    
    const toggleBtn = UI.$('#epubToggleTocBtn');
    const toggleText = UI.$('#epubToggleTocText');
    if (toggleText) {
      toggleText.textContent = isCollapsed ? 'Hiện DS' : 'Ẩn DS';
    }
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', isCollapsed);
      toggleBtn.title = isCollapsed ? 'Mở rộng danh sách chương' : 'Thu gọn danh sách chương';
    }
    const collapseBtn = UI.$('#epubCollapseSidebarBtn');
    if (collapseBtn) {
      collapseBtn.title = isCollapsed ? 'Mở rộng danh sách chương' : 'Thu gọn danh sách chương';
    }
  },

  updateTranslateButtonState() {
    const btn = document.getElementById('translateFileBtn');
    if (!btn) return;
    if (State.isTranslating) {
      btn.disabled = true;
      return;
    }
    const hasSelected = Array.isArray(State.chapters) && State.chapters.some(c => c.selected);
    btn.disabled = !hasSelected;
  },

  isChapterDone(ch) {
    if (!ch) return false;
    // 1. Translated in current session
    if (State.finishedChapters && State.finishedChapters.some(fc => fc.sourceChapterId === ch.id || fc.id === ch.id)) {
      return true;
    }
    // 2. Pure illustration check
    const text = ch.content || '';
    const clean = text.replace(/\[IMG:[^\]]+\]/g, '').replace(/<[^>]+>/g, '').trim();
    if (!clean && text.includes('[IMG:')) {
      return true;
    }
    // 3. Current target language
    const targetLang = (State.settings && State.settings.targetLang) || 'vi';
    const normTarget = targetLang.toLowerCase().split('-')[0];

    // 4. Evaluated by ProgressDetector
    if (ch._langEvaluation) {
      const normDetected = (ch._langEvaluation.detectedLang || '').toLowerCase().split('-')[0];
      return normDetected === normTarget;
    }
    // 5. Fast target language check
    if (window.ProgressDetector && typeof window.ProgressDetector.matchesTargetLanguage === 'function') {
      return window.ProgressDetector.matchesTargetLanguage(text || ch.title, targetLang);
    }
    return false;
  },

  updateFilterCounts() {
    const total = State.chapters ? State.chapters.length : 0;
    const translated = State.chapters ? State.chapters.filter(ch => this.isChapterDone(ch)).length : 0;
    const untranslated = Math.max(0, total - translated);

    const elAll = UI.$('#chFilterAllCount');
    const elUntranslated = UI.$('#chFilterUntranslatedCount');
    const elTranslated = UI.$('#chFilterTranslatedCount');

    if (elAll) elAll.textContent = total;
    if (elUntranslated) elUntranslated.textContent = untranslated;
    if (elTranslated) elTranslated.textContent = translated;

    const barEl = UI.$('#fileLanguagesBar');
    const sideBarEl = UI.$('#sidebarLanguagesWidget');
    if (window.ProgressDetector && typeof window.ProgressDetector.getBookLanguageBreakdown === 'function') {
      const currentBook = { 
        chapters: State.chapters, 
        finishedChapters: State.finishedChapters, 
        totalChunks: State.chapters ? State.chapters.length : 0 
      };
      const bd = ProgressDetector.getBookLanguageBreakdown(currentBook);
      if (barEl) barEl.innerHTML = bd.barWithTitleHtml || bd.barHtml;
      if (sideBarEl) sideBarEl.innerHTML = bd.shortBarHtml || bd.barHtml;
    }
  },

  getFilteredChapters() {
    const ws = window.ChapterWorkspace || {};
    const filter = ws.filter || 'all';
    const searchQuery = ws.searchQuery || '';

    if (!Array.isArray(State.chapters)) return [];

    return State.chapters.filter(ch => {
      const isFinished = this.isChapterDone(ch);
      
      // Filter status
      if (filter === 'untranslated' && isFinished) return false;
      if (filter === 'translated' && !isFinished) return false;

      // Filter search
      if (searchQuery) {
        const fc = State.finishedChapters && State.finishedChapters.find(f => f.sourceChapterId === ch.id);
        const transTitle = fc && fc.title ? fc.title.toLowerCase() : '';
        const titleMatch = (ch.title && ch.title.toLowerCase().includes(searchQuery)) || transTitle.includes(searchQuery);
        const idMatch = String(ch.id + 1) === searchQuery;
        if (!titleMatch && !idMatch) return false;
      }

      return true;
    });
  },

  renderListOnly() {
    const list = UI.$('#chapterList');
    if (!list) return;

    const ws = window.ChapterWorkspace || {};
    const activeChapterId = ws.activeChapterId;

    const filtered = this.getFilteredChapters();
    if (filtered.length === 0) {
      list.innerHTML = `
        <div class="epub-list-empty">
          <p>Không tìm thấy chương nào phù hợp</p>
        </div>
      `;
      return;
    }

    list.innerHTML = filtered.map(ch => {
      const fc = State.finishedChapters && State.finishedChapters.find(f => f.sourceChapterId === ch.id);
      const isFinished = this.isChapterDone(ch);
      const isActive = ch.id === activeChapterId;
      
      // Foreign badge: Cache on fc object to avoid re-scanning full text on every render
      let foreignBadge = '';
      if (fc && fc.content && window.ForeignDetector) {
        if (fc._cachedForeignBadge !== undefined) {
          foreignBadge = fc._cachedForeignBadge;
        } else {
          const det = ForeignDetector.detect(fc.content);
          foreignBadge = det.hasForeign ? `<span class="foreign-badge-micro" title="${det.warningMessage}">⚠️ Sót ${det.totalCount}</span>` : '';
          fc._cachedForeignBadge = foreignBadge;
        }
      }

      // Language ratio badge: Fast-path for finished chapters, cache for others
      let statusBadge = '';
      if (ch._isTranslating) {
        statusBadge = `<span class="badge" style="background: #3b82f6; color: #fff; font-size: 10px; padding: 2px 7px; border-radius: 10px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;"><span class="ai-loading-spinner" style="width: 9px; height: 9px; border-width: 1.5px;"></span> Đang dịch</span>`;
      } else if (isFinished) {
        statusBadge = '<span class="lang-ratio-badge done">vi 100%</span>';
      } else if (ch._langEvaluation && ch._langEvaluation.ratioBadgeHtml) {
        statusBadge = ch._langEvaluation.ratioBadgeHtml;
      } else if (ch._cachedLangBadge && !ch._dirtyLang) {
        statusBadge = ch._cachedLangBadge;
      } else {
        statusBadge = '';
      }

      let displayTitle = (isFinished && fc && fc.title) ? fc.title : ((fc && fc.title) || ch._liveDisplayTitle || ch.title);
      if (displayTitle === 'Bìa & Minh họa') {
        displayTitle = 'Cover';
        if (ch) ch.title = 'Cover';
        if (ch && ch.originalTitle === 'Bìa & Minh họa') ch.originalTitle = 'Cover';
        if (fc && fc.title === 'Bìa & Minh họa') fc.title = 'Cover';
      }
      if (displayTitle && window.Translation && /^(?:Chào bạn|Tôi thấy|Tôi nhận thấy|Dưới đây là)/i.test(displayTitle)) {
        const cleaned = Translation.cleanTranslatedTitle(displayTitle, ch.title);
        if (cleaned && cleaned !== displayTitle) {
          displayTitle = cleaned;
          if (fc && fc.title) fc.title = cleaned;
          if (ch && ch.title) ch.title = cleaned;
        }
      }
      const hasTranslatedTitle = displayTitle && displayTitle !== ch.title;
      const titleTooltip = hasTranslatedTitle ? `Tiêu đề dịch: ${displayTitle}\nTên gốc: ${ch.title}` : ch.title;
      const origSubtitle = hasTranslatedTitle 
        ? `<div class="chapter-orig-subtitle" style="font-size: 11px; opacity: 0.6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 2px;" title="Tên gốc: ${ch.title}">${ch.title}</div>` 
        : '';

      // Check R18 content for chapter (Cached on ch)
      if (ch._cachedR18Badge === undefined) {
        let isR18 = false;
        if (window.R18Detector) {
          const sourceLang = (State.settings && State.settings.sourceLang) || 'auto';
          isR18 = R18Detector.isChapterR18(ch, fc, sourceLang);
        }
        ch._cachedR18Badge = isR18 ? (window.R18Detector ? R18Detector.getBadgeHtml() : '<span class="r18-badge-micro">18+</span>') : '';
      }
      const r18Badge = ch._cachedR18Badge;

      // Check Images in chapter (Cached on ch)
      if (ch._cachedImageBadge === undefined) {
        const imgCount = (window.Utils && typeof Utils.countImages === 'function')
          ? (Utils.countImages(ch.content) || (fc && Utils.countImages(fc.content)) || 0)
          : 0;
        ch._cachedImageBadge = imgCount > 0 ? Utils.getImageBadgeHtml(imgCount) : '';
      }
      const imageBadge = ch._cachedImageBadge;

      // Word count: Cached on ch (ch.content is immutable during reading)
      if (ch._cachedWordCount === undefined) {
        ch._cachedWordCount = Utils.formatWordCount(Utils.countWords(ch.content || ''));
      }
      const formattedWordCount = ch._cachedWordCount;

      return `
        <div class="chapter-item ${ch.selected ? 'selected' : ''} ${isActive ? 'active' : ''} ${isFinished ? 'is-translated' : 'is-untranslated'}" data-id="${ch.id}">
          <input type="checkbox" class="chapter-checkbox" ${ch.selected ? 'checked' : ''} title="Chọn để dịch hàng loạt">
          <div class="chapter-info" style="flex: 1; min-width: 0; overflow: hidden;">
            <div class="chapter-title-row" style="display: flex; align-items: center; justify-content: space-between; gap: 6px; min-width: 0; width: 100%;">
              <span class="chapter-title" title="${titleTooltip}" style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${displayTitle}</span>
              <div class="chapter-title-badges" style="display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;">
                ${imageBadge}
                ${r18Badge}
              </div>
            </div>
            ${origSubtitle}
            <div class="chapter-item-sub" style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; min-width: 0; width: 100%;">
              <span class="chapter-metadata" style="flex-shrink: 0;">${formattedWordCount}</span>
              <div class="chapter-item-badges" style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                ${statusBadge}
                ${foreignBadge}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
    this.updateTranslateButtonState();
  }
};

if (typeof window !== 'undefined') {
  window.WorkspaceSidebar = WorkspaceSidebar;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WorkspaceSidebar;
}
