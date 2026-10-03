/**
 * CHAPTER WORKSPACE CONTROLLER (EPUB-Forge Style)
 * Manages the 2-column split workspace:
 * - Left pane: Chapter List / TOC with live search, filters, selection
 * - Right pane: Content Viewer with toggle (Bản dịch / Bản gốc), copy, auto-fix, prev/next
 */

const ChapterWorkspace = {
  activeChapterId: null,
  activeMode: 'translated', // 'translated' | 'source'
  filter: 'all', // 'all' | 'untranslated' | 'translated'
  searchQuery: '',
  isEditing: false,

  init() {
    this.bindEvents();
    if (window.EventBus && typeof window.EventBus.on === 'function') {
      window.EventBus.on('chapter:chunk-translated', (data) => {
        if (data) {
          this.updateLiveChunk(data.chapterId, data.title, data.content, data.chunkIndex, data.totalChunks);
        }
      });
    }
  },

  bindEvents() {
    // Search input
    const searchInput = UI.$('#chapterSearchInput');
    const clearSearch = UI.$('#clearChapterSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        if (clearSearch) {
          UI.toggleHidden(clearSearch, !this.searchQuery);
        }
        this.renderListOnly();
      });
    }

    if (clearSearch) {
      clearSearch.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        this.searchQuery = '';
        UI.toggleHidden(clearSearch, true);
        this.renderListOnly();
      });
    }

    // Filter pills
    const filterContainer = UI.$('.epub-filter-tabs');
    if (filterContainer) {
      filterContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.epub-tab-pill');
        if (!btn) return;
        filterContainer.querySelectorAll('.epub-tab-pill').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        this.filter = btn.dataset.filter || 'all';
        this.renderListOnly();
      });
    }

    // Toggle view mode: Bản dịch / Bản gốc
    const showTranslatedBtn = UI.$('#epubShowTranslatedBtn');
    const showSourceBtn = UI.$('#epubShowSourceBtn');
    if (showTranslatedBtn) {
      showTranslatedBtn.addEventListener('click', () => {
        if (this.isEditing) this.toggleEditMode(false);
        this.activeMode = 'translated';
        showTranslatedBtn.classList.add('active');
        if (showSourceBtn) showSourceBtn.classList.remove('active');
        this.renderActiveContent();
      });
    }
    if (showSourceBtn) {
      showSourceBtn.addEventListener('click', () => {
        if (this.isEditing) this.toggleEditMode(false);
        this.activeMode = 'source';
        showSourceBtn.classList.add('active');
        if (showTranslatedBtn) showTranslatedBtn.classList.remove('active');
        this.renderActiveContent();
      });
    }

    // Rename chapter
    const renameBtn = UI.$('#epubRenameChapterBtn');
    if (renameBtn) {
      renameBtn.addEventListener('click', () => this.renameActiveChapter());
    }

    // Translate title of active chapter
    const translateTitleBtn = UI.$('#epubTranslateTitleBtn');
    if (translateTitleBtn) {
      translateTitleBtn.addEventListener('click', () => this.translateActiveTitle());
    }

    // Bulk translate titles
    const bulkTranslateTitlesBtn = UI.$('#bulkTranslateTitlesBtn');
    if (bulkTranslateTitlesBtn) {
      bulkTranslateTitlesBtn.addEventListener('click', () => this.bulkTranslateTitles());
    }

    // Edit content
    const editBtn = UI.$('#epubEditContentBtn');
    if (editBtn) {
      editBtn.addEventListener('click', () => this.toggleEditMode(true));
    }

    // Save edited content
    const saveContentBtn = UI.$('#epubSaveContentBtn');
    if (saveContentBtn) {
      saveContentBtn.addEventListener('click', () => this.saveEditedContent());
    }

    // Cancel edit
    const cancelEditBtn = UI.$('#epubCancelEditBtn');
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener('click', () => this.toggleEditMode(false));
    }

    // Split chapter
    const splitBtn = UI.$('#epubSplitChapterBtn');
    if (splitBtn) {
      splitBtn.addEventListener('click', () => this.splitActiveChapter());
    }

    // Merge selected chapters
    const mergeBtn = UI.$('#mergeSelectedChaptersBtn');
    if (mergeBtn) {
      mergeBtn.addEventListener('click', () => this.mergeSelectedChapters());
    }

    // Copy content
    const copyBtn = UI.$('#epubCopyBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        this.copyActiveContent();
      });
    }

    // Auto-fix AI
    const autoFixBtn = UI.$('#epubAutoFixBtn');
    if (autoFixBtn) {
      autoFixBtn.addEventListener('click', async () => {
        await this.autoFixActiveChapter();
      });
    }

    // Prev / Next navigation
    const prevBtn = UI.$('#epubPrevBtn');
    const nextBtn = UI.$('#epubNextBtn');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.prevChapter());
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextChapter());
    }

    // Toggle chapter sidebar (TOC)
    const toggleTocBtn = UI.$('#epubToggleTocBtn');
    if (toggleTocBtn) {
      toggleTocBtn.addEventListener('click', () => this.toggleChapterSidebar());
    }
    const collapseSidebarBtn = UI.$('#epubCollapseSidebarBtn');
    if (collapseSidebarBtn) {
      collapseSidebarBtn.addEventListener('click', () => this.toggleChapterSidebar(true));
    }

    // Retranslate active chapter
    const retranslateBtn = UI.$('#epubRetranslateChapterBtn');
    if (retranslateBtn) {
      retranslateBtn.addEventListener('click', () => this.retranslateActiveChapter());
    }

    // Clear active chapter translation
    const clearChapterBtn = UI.$('#epubClearChapterTranslationBtn');
    if (clearChapterBtn) {
      clearChapterBtn.addEventListener('click', () => this.clearActiveChapterTranslation());
    }

    // Reset all translations for book
    const resetAllBtn = UI.$('#resetAllTranslationsBtn');
    if (resetAllBtn) {
      resetAllBtn.addEventListener('click', () => this.resetAllTranslations());
    }

    // Global Dropdown Toggles & Dismissal
    document.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('[data-dropdown-toggle]');
      if (toggleBtn) {
        e.stopPropagation();
        const menuId = toggleBtn.dataset.dropdownToggle;
        const targetMenu = UI.$(`#${menuId}`);
        const isCurrentlyOpen = targetMenu && !targetMenu.classList.contains('hidden');
        
        // Hide all dropdowns & context menus
        document.querySelectorAll('.dropdown-menu, .context-menu').forEach(m => m.classList.add('hidden'));

        // Toggle target menu
        if (targetMenu && !isCurrentlyOpen) {
          targetMenu.classList.remove('hidden');
        }
        return;
      }

      // Close if clicking inside dropdown item or outside dropdown
      if (e.target.closest('.dropdown-item') || !e.target.closest('.dropdown-menu')) {
        document.querySelectorAll('.dropdown-menu, .context-menu').forEach(m => m.classList.add('hidden'));
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.dropdown-menu, .context-menu').forEach(m => m.classList.add('hidden'));
      }
    });
    window.addEventListener('resize', () => {
      document.querySelectorAll('.dropdown-menu, .context-menu').forEach(m => m.classList.add('hidden'));
    });

    // Chapter Context Menu (Right Click on Chapter list)
    const chapterList = UI.$('#chapterList');
    const ctxMenu = UI.$('#chapterContextMenu');
    let contextChapterId = null;

    if (chapterList && ctxMenu) {
      chapterList.addEventListener('contextmenu', (e) => {
        const item = e.target.closest('.chapter-item');
        if (!item) return;
        e.preventDefault();

        contextChapterId = parseInt(item.dataset.id, 10);
        this.selectChapter(contextChapterId);

        ctxMenu.classList.remove('hidden');
        const menuWidth = 200;
        const menuHeight = 270;
        let x = e.clientX;
        let y = e.clientY;
        if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
        if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;
        ctxMenu.style.left = `${Math.max(10, x)}px`;
        ctxMenu.style.top = `${Math.max(10, y)}px`;
      });

      const bindCtx = (id, handler) => {
        const btn = UI.$(id);
        if (btn) {
          btn.addEventListener('click', () => {
            ctxMenu.classList.add('hidden');
            handler();
          });
        }
      };

      bindCtx('#ctxRetranslateChapter', () => this.retranslateActiveChapter());
      bindCtx('#ctxEditChapter', () => this.toggleEditMode(true));
      bindCtx('#ctxRenameChapter', () => this.renameActiveChapter());
      bindCtx('#ctxTranslateTitle', () => this.translateActiveTitle());
      bindCtx('#ctxSplitChapter', () => this.splitActiveChapter());
      bindCtx('#ctxCopyChapter', () => this.copyActiveContent());
      bindCtx('#ctxClearTranslation', () => this.clearActiveChapterTranslation());
      bindCtx('#ctxDeleteChapter', () => {
        if (contextChapterId === null || isNaN(contextChapterId)) return;
        const ch = State.chapters && State.chapters.find(c => c.id === contextChapterId);
        const name = ch ? ch.title : `Chương #${contextChapterId + 1}`;
        if (confirm(`Bạn có chắc muốn xóa vĩnh viễn "${name}" khỏi danh sách truyện?`)) {
          State.chapters = State.chapters.filter(c => c.id !== contextChapterId);
          State.finishedChapters = State.finishedChapters.filter(fc => fc.sourceChapterId !== contextChapterId);
          if (typeof window.saveChapters === 'function') window.saveChapters();
          if (State.currentBook) {
            State.currentBook.chapters = State.chapters;
            State.saveBooks();
          }
          State.saveTranslationProgress(State.finishedChapters.length);
          this.render();
          if (window.Bookshelf && typeof Bookshelf.renderChapterList === 'function') {
            Bookshelf.renderChapterList();
          }
          Utils.showToast(`Đã xóa: ${name}`, 'info');
        }
      });
    }
  },

  // --- FACADE DELEGATION: THANH ĐIỀU HƯỚNG BÊN TRÁI (WorkspaceSidebar) ---
  toggleChapterSidebar(...args) { return (window.WorkspaceSidebar || WorkspaceSidebar).toggleChapterSidebar(...args); },
  updateTranslateButtonState(...args) { return (window.WorkspaceSidebar || WorkspaceSidebar).updateTranslateButtonState(...args); },
  isChapterDone(...args) { return (window.WorkspaceSidebar || WorkspaceSidebar).isChapterDone(...args); },
  updateFilterCounts(...args) { return (window.WorkspaceSidebar || WorkspaceSidebar).updateFilterCounts(...args); },
  getFilteredChapters(...args) { return (window.WorkspaceSidebar || WorkspaceSidebar).getFilteredChapters(...args); },
  renderListOnly(...args) { return (window.WorkspaceSidebar || WorkspaceSidebar).renderListOnly(...args); },

  render() {
    if (!State.chapters || State.chapters.length === 0) {
      UI.$('#chapterListSection').classList.add('hidden');
      return;
    }

    UI.$('#chapterListSection').classList.remove('hidden');

    this.updateFilterCounts();

    if (this.activeChapterId === null || !State.chapters.some(c => c.id === this.activeChapterId)) {
      this.activeChapterId = State.chapters[0].id;
    }

    this.renderListOnly();
    this.renderActiveContent();
    this.updateTranslateButtonState();
  },

  selectChapter(id) {
    if (this.isEditing) {
      this.toggleEditMode(false);
    }
    this.activeChapterId = id;
    
    // Default mode: if chapter is already translated, prefer translated view
    const isFinished = State.finishedChapters.some(fc => fc.sourceChapterId === id);
    this.activeMode = isFinished ? 'translated' : 'source';

    // Update active class in list without full re-render for maximum speed
    const list = UI.$('#chapterList');
    if (list) {
      list.querySelectorAll('.chapter-item').forEach(el => {
        const elId = parseInt(el.dataset.id);
        el.classList.toggle('active', elId === id);
      });
    }

    this.renderActiveContent();
  },

  updateLiveChunk(chapterId, currentDisplayTitle, liveContent, chunkIndex, totalChunks) {
    // Cache live translated progress on chapter object
    const ch = State.chapters && State.chapters.find(c => c.id === chapterId);
    if (ch) {
      ch._liveTranslatedContent = liveContent;
      ch._liveDisplayTitle = currentDisplayTitle;
      ch._liveChunkIndex = chunkIndex;
      ch._liveTotalChunks = totalChunks;
    }

    // Nếu người dùng KHÔNG đang xem chương này, tuyệt đối không tự ý chuyển màn hình!
    if (this.activeChapterId !== chapterId) {
      return;
    }

    if (this.isEditing) return;

    this.activeMode = 'translated';
    const showTranslatedBtn = UI.$('#epubShowTranslatedBtn');
    const showSourceBtn = UI.$('#epubShowSourceBtn');
    if (showTranslatedBtn) {
      showTranslatedBtn.classList.remove('hidden');
      showTranslatedBtn.classList.add('active');
    }
    if (showSourceBtn) {
      showSourceBtn.classList.remove('active');
    }

    const titleEl = UI.$('#epubViewerTitle');
    if (titleEl) titleEl.textContent = currentDisplayTitle || 'Đang dịch...';

    const statusBadge = UI.$('#epubViewerStatusBadge');
    if (statusBadge) {
      const isComplete = (chunkIndex + 1) >= totalChunks;
      if (isComplete) {
        statusBadge.innerHTML = '<span class="lang-ratio-badge done">Đã dịch xong</span>';
      } else {
        statusBadge.innerHTML = `<span class="badge" style="background: var(--accent-primary, #6366f1); color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;">Đang dịch đoạn ${chunkIndex + 1}/${totalChunks}</span>`;
      }
    }

    const charCountEl = UI.$('#epubViewerCharCount');
    if (charCountEl) {
      charCountEl.textContent = Utils.formatWordCount(Utils.countWords(liveContent));
    }

    const bodyEl = UI.$('#epubViewerBody');
    if (bodyEl) {
      let html = this.formatContentHtml(liveContent, false, currentDisplayTitle);
      if (chunkIndex + 1 < totalChunks) {
        html += `<div class="live-translating-indicator" style="margin-top: 24px; padding: 12px 16px; border-radius: 8px; background: var(--bg-secondary, rgba(99,102,241,0.08)); border-left: 3px solid var(--accent-primary, #6366f1); color: var(--text-muted); font-size: 13px; display: flex; align-items: center; gap: 8px;">
          <div class="ai-loading-spinner" style="width: 14px; height: 14px; border-width: 2px;"></div>
          <span>Đang dịch tiếp đoạn ${chunkIndex + 2}/${totalChunks}...</span>
        </div>`;
      }
      bodyEl.innerHTML = html;
      bodyEl.scrollTop = bodyEl.scrollHeight;
    }
  },

  // --- FACADE DELEGATION: KHUNG BIÊN TẬP & XỬ LÝ NỘI DUNG (WorkspaceEditor) ---
  toggleEditMode(...args) { return (window.WorkspaceEditor || WorkspaceEditor).toggleEditMode(...args); },
  saveEditedContent(...args) { return (window.WorkspaceEditor || WorkspaceEditor).saveEditedContent(...args); },
  renameActiveChapter(...args) { return (window.WorkspaceEditor || WorkspaceEditor).renameActiveChapter(...args); },
  getRawSourceTitle(...args) { return (window.WorkspaceEditor || WorkspaceEditor).getRawSourceTitle(...args); },
  translateActiveTitle(...args) { return (window.WorkspaceEditor || WorkspaceEditor).translateActiveTitle(...args); },
  bulkTranslateTitles(...args) { return (window.WorkspaceEditor || WorkspaceEditor).bulkTranslateTitles(...args); },
  splitActiveChapter(...args) { return (window.WorkspaceEditor || WorkspaceEditor).splitActiveChapter(...args); },
  mergeSelectedChapters(...args) { return (window.WorkspaceEditor || WorkspaceEditor).mergeSelectedChapters(...args); },
  deduplicateLeadingTitles(...args) { return (window.WorkspaceEditor || WorkspaceEditor).deduplicateLeadingTitles(...args); },
  formatContentHtml(...args) { return (window.WorkspaceEditor || WorkspaceEditor).formatContentHtml(...args); },
  renderActiveContent(...args) { return (window.WorkspaceEditor || WorkspaceEditor).renderActiveContent(...args); },


  nextChapter() {
    const currentIndex = State.chapters.findIndex(c => c.id === this.activeChapterId);
    if (currentIndex >= 0 && currentIndex < State.chapters.length - 1) {
      const nextCh = State.chapters[currentIndex + 1];
      this.selectChapter(nextCh.id);
      this.scrollActiveIntoView();
    }
  },

  prevChapter() {
    const currentIndex = State.chapters.findIndex(c => c.id === this.activeChapterId);
    if (currentIndex > 0) {
      const prevCh = State.chapters[currentIndex - 1];
      this.selectChapter(prevCh.id);
      this.scrollActiveIntoView();
    }
  },

  scrollActiveIntoView() {
    const activeEl = UI.$(`.chapter-item[data-id="${this.activeChapterId}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  },

  copyActiveContent() {
    const ch = State.chapters.find(c => c.id === this.activeChapterId);
    if (!ch) return;

    const fc = State.finishedChapters.find(f => f.sourceChapterId === ch.id);
    const content = (this.activeMode === 'translated' && fc) ? fc.content : ch.content;

    if (!content) {
      Utils.showToast('Không có nội dung để sao chép', 'warning');
      return;
    }

    navigator.clipboard.writeText(content).then(() => {
      Utils.showToast('Đã sao chép nội dung chương vào clipboard!', 'success');
    }).catch(err => {
      console.error('Failed to copy text:', err);
      Utils.showToast('Không thể sao chép văn bản', 'error');
    });
  },

  async autoFixActiveChapter() {
    const ch = State.chapters.find(c => c.id === this.activeChapterId);
    if (!ch) return;

    const fcIndex = State.finishedChapters.findIndex(f => f.sourceChapterId === ch.id);
    if (fcIndex === -1) {
      Utils.showToast('Chương này chưa được dịch!', 'warning');
      return;
    }

    const autoFixBtn = UI.$('#epubAutoFixBtn');
    if (autoFixBtn) {
      autoFixBtn.disabled = true;
      autoFixBtn.textContent = 'Đang sửa...';
    }

    try {
      await Translation.autoFixChapter(fcIndex);
      this.render();
    } finally {
      if (autoFixBtn) {
        autoFixBtn.disabled = false;
        autoFixBtn.textContent = 'Sửa AI';
      }
    }
  },

  async retranslateActiveChapter() {
    if (State.isTranslating) {
      Utils.showToast('Đang có tiến trình dịch đang chạy, vui lòng chờ hoàn thành hoặc bấm Hủy trước.', 'warning');
      return;
    }
    const ch = State.chapters && State.chapters.find(c => c.id === this.activeChapterId);
    if (!ch) {
      Utils.showToast('Vui lòng chọn một chương để dịch lại!', 'warning');
      return;
    }

    const fc = State.finishedChapters.find(f => f.sourceChapterId === ch.id || f.id === ch.id);
    const chapterName = (fc && fc.title) || ch.title || `Chương ${ch.id + 1}`;
    const confirmMsg = fc 
      ? `Bạn có chắc muốn dịch lại "${chapterName}"?\nBản dịch cũ của chương này sẽ được xóa và AI sẽ tiến hành dịch mới.`
      : `Bắt đầu dịch chương "${chapterName}" bằng AI?`;

    if (!confirm(confirmMsg)) {
      return;
    }

    // 1. Remove from State.finishedChapters & currentBook.finishedChapters
    State.finishedChapters = State.finishedChapters.filter(f => f.sourceChapterId !== ch.id && f.id !== ch.id);
    if (State.currentBook && State.currentBook.finishedChapters) {
      State.currentBook.finishedChapters = State.currentBook.finishedChapters.filter(f => f.sourceChapterId !== ch.id && f.id !== ch.id);
    }

    // 2. Restore title and clear live state
    if (ch.originalTitle) {
      ch.title = ch.originalTitle;
    }
    delete ch._liveTranslatedContent;
    delete ch._liveDisplayTitle;
    delete ch._liveChunkIndex;
    delete ch._liveTotalChunks;
    delete ch._langEvaluation;
    ch._bypassCache = true;

    // 3. Select ONLY this chapter for translation
    State.chapters.forEach(c => {
      c.selected = (c.id === ch.id);
    });

    // 4. Update translatedContent stitch & save
    State.translatedContent = State.finishedChapters.map(f => f.content).join('\n\n---CHAPTER_BREAK---\n\n');
    if (State.currentBook) {
      State.currentBook.translatedContent = State.translatedContent;
      State.currentBook.chapters = State.chapters.map(c => ({
        id: c.id,
        title: c.title,
        content: c.content,
        charCount: c.content ? c.content.length : 0,
        wordCount: c.content ? Utils.countWords(c.content) : 0,
        selected: c.selected,
        shouldNumber: c.shouldNumber
      }));
      State.saveBooks();
    }
    if (typeof window.saveChapters === 'function') {
      window.saveChapters();
    }

    State.saveTranslationProgress(State.finishedChapters.length, State.chapters.length);

    this.activeMode = 'translated';
    if (this.isEditing) this.toggleEditMode(false);
    this.render();
    Bookshelf.renderChapterList();

    // 5. Trigger translation directly!
    if (window.Translation && typeof window.Translation.startFileTranslation === 'function') {
      Utils.showToast(`Bắt đầu dịch lại: ${chapterName}`, 'info');
      Translation.startFileTranslation();
    }
  },


  clearActiveChapterTranslation() {
    return (window.WorkspaceEditor || WorkspaceEditor).clearActiveChapterTranslation();
  },

  resetAllTranslations() {
    return (window.WorkspaceEditor || WorkspaceEditor).resetAllTranslations();
  }
};

window.ChapterWorkspace = ChapterWorkspace;

