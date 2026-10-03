/**
 * FILE TRANSLATION CONTROLLER (SRP)
 * Manages file translation execution, chapter management, batch replacement, and file exports
 */

const FileController = {
  init() {
    window.saveChapters = this.saveChapters.bind(this);
    this.setupTranslationActions();
    this.setupExportModal();
    this.setupChapterListActions();
    this.setupCompletedChapterActions();
    this.setupBulkReplace();
  },

  saveChapters() {
    if (State.currentBook) {
      State.currentBook.chapters = State.chapters.map(ch => ({
        id: ch.id,
        title: ch.title,
        content: ch.content,
        charCount: ch.content ? ch.content.length : 0,
        wordCount: ch.content ? Utils.countWords(ch.content) : 0,
        selected: ch.selected,
        shouldNumber: ch.shouldNumber
      }));
      State.currentBook.totalChunks = State.chapters.length;
      State.saveBooks();
    }
  },

  setupTranslationActions() {
    if (UI.elements.translateFileBtn) {
      UI.elements.translateFileBtn.addEventListener('click', () => Translation.startFileTranslation());
    }
    
    if (UI.elements.cancelTranslation) {
      UI.elements.cancelTranslation.addEventListener('click', () => {
        State.cancelRequested = true;
        if (window.electronAPI && typeof window.electronAPI.cancelTranslation === 'function') {
          window.electronAPI.cancelTranslation();
        }
        UI.$('#progressLabel').textContent = 'Đang dừng...';
      });
    }
  },

  setupExportModal() {
    if (UI.elements.saveFileBtn) {
      UI.elements.saveFileBtn.addEventListener('click', () => {
        if (State.finishedChapters.length === 0 || !State.currentFile) {
          Utils.showToast('Vui lòng đợi dịch xong ít nhất 1 chương', 'info');
          return;
        }
        UI.elements.exportModal.classList.remove('hidden');
        // Set default active state
        UI.$$('.export-option').forEach(card => {
          const radio = card.querySelector('input');
          if (radio.checked) card.classList.add('active');
          else card.classList.remove('active');
        });
      });
    }

    const closeBtn = UI.$('#closeExportModal');
    if (closeBtn) closeBtn.addEventListener('click', () => UI.elements.exportModal.classList.add('hidden'));

    const cancelBtn = UI.$('#cancelExportBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => UI.elements.exportModal.classList.add('hidden'));

    // Export Format Selection (Visual)
    UI.$$('.export-option').forEach(card => {
      card.addEventListener('click', () => {
        UI.$$('.export-option').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        card.querySelector('input').checked = true;
      });
    });

    if (UI.elements.confirmExportBtn) {
      UI.elements.confirmExportBtn.addEventListener('click', async () => {
        const format = UI.$('input[name="exportFormat"]:checked').value;
        UI.elements.exportModal.classList.add('hidden');
        
        try {
          UI.updateButtonLoading(UI.elements.saveFileBtn, true);
          
          if (format === 'txt-multi') {
            const result = await window.electronAPI.saveMultiTxt({
              chapters: State.finishedChapters,
              originalFileName: State.currentFile.fileName
            });
            if (result) Utils.showToast('Đã xuất thành công nhiều file TXT vào thư mục!', 'success');
          } else {
            const bookMeta = State.currentBook ? {
              title: State.currentBook.title,
              author: State.currentBook.author,
              publisher: State.currentBook.publisher,
              language: State.currentBook.language,
              description: State.currentBook.description,
              subjects: State.currentBook.subjects
            } : (State.currentFile?.metadata || null);

            const savedPath = await window.electronAPI.saveFile({
              originalPath: State.currentFile.filePath,
              ext: State.currentFile.ext,
              translatedContent: State.translatedContent,
              originalFileName: State.currentFile.fileName,
              forceExt: format === 'epub' ? '.epub' : '.txt',
              chapters: State.finishedChapters,
              metadata: bookMeta,
              cover: State.currentBook?.cover || State.currentFile?.cover || null
            });
            if (savedPath) Utils.showToast(`Đã lưu file: ${savedPath.split(/[\\/]/).pop()}`, 'success');
          }
        } catch (e) {
          Utils.showToast(`Lỗi xuất file: ${e.message}`, 'error');
        } finally {
          UI.updateButtonLoading(UI.elements.saveFileBtn, false);
        }
      });
    }
  },

  setupChapterListActions() {
    const selectAllBtn = UI.$('#selectAllChapters');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        State.chapters.forEach(ch => ch.selected = true);
        Bookshelf.renderChapterList();
        this.saveChapters();
        if (window.Translation && typeof window.Translation.resetFileUI === 'function') {
          Translation.resetFileUI();
        }
      });
    }

    const deselectAllBtn = UI.$('#deselectAllChapters');
    if (deselectAllBtn) {
      deselectAllBtn.addEventListener('click', () => {
        State.chapters.forEach(ch => ch.selected = false);
        Bookshelf.renderChapterList();
        this.saveChapters();
        if (window.Translation && typeof window.Translation.resetFileUI === 'function') {
          Translation.resetFileUI();
        }
      });
    }

    const findFaultyBtn = UI.$('#findFaultyChapters');
    if (findFaultyBtn) {
      findFaultyBtn.addEventListener('click', () => {
        Translation.findAndScrollToFaultyChapter();
      });
    }

    const compareBtn = UI.$('#compareContentSegments');
    if (compareBtn) {
      compareBtn.addEventListener('click', () => {
        Translation.compareAndReportCompleteness();
      });
    }

    const deleteSourceBtn = UI.$('#deleteSelectedSourceChapters');
    if (deleteSourceBtn) {
      deleteSourceBtn.addEventListener('click', () => {
        const selected = State.chapters.filter(ch => ch.selected);
        if (selected.length === 0) {
          Utils.showToast('Vui lòng chọn ít nhất một chương để xóa', 'info');
          return;
        }

        if (confirm(`Bạn có chắc muốn xóa vĩnh viễn ${selected.length} chương đã chọn khỏi danh sách gốc? (Dữ liệu bản dịch liên quan cũng sẽ bị xóa)`)) {
          const selectedIds = new Set(selected.map(ch => ch.id));
          
          State.chapters = State.chapters.filter(ch => !selectedIds.has(ch.id));
          State.finishedChapters = State.finishedChapters.filter(fc => !selectedIds.has(fc.sourceChapterId));
          
          this.saveChapters();
          State.saveTranslationProgress(State.finishedChapters.length);
          Bookshelf.recalculateTitles();
          Bookshelf.renderChapterList();
          Translation.renderCompletedChapters();
          
          Utils.showToast(`Đã xóa ${selected.length} chương`, 'success');
        }
      });
    }

    const clearFinishedBtn = UI.$('#clearAllFinishedBtn');
    if (clearFinishedBtn) {
      clearFinishedBtn.addEventListener('click', () => {
        if (State.finishedChapters.length === 0) return;
        if (confirm('Bạn có chắc muốn xóa TOÀN BỘ bản dịch của truyện này để làm lại từ đầu?')) {
          State.finishedChapters = [];
          State.saveTranslationProgress(0);
          Translation.renderCompletedChapters();
          Bookshelf.renderChapterList();
          Utils.showToast('Đã xóa toàn bộ bản dịch', 'success');
        }
      });
    }

    const bulkDeleteBtn = UI.$('#bulkDeleteFinishedBtn');
    if (bulkDeleteBtn) {
      bulkDeleteBtn.addEventListener('click', () => {
        const checkboxes = UI.$$('.finished-chapter-checkbox:checked');
        if (checkboxes.length === 0) {
          Utils.showToast('Vui lòng chọn các chương đã hoàn thành để xóa', 'info');
          return;
        }

        if (confirm(`Xóa ${checkboxes.length} chương đã chọn khỏi bản dịch?`)) {
          const indicesToDelete = Array.from(checkboxes).map(cb => parseInt(cb.dataset.idx)).sort((a, b) => b - a);
          
          indicesToDelete.forEach(idx => {
            State.finishedChapters.splice(idx, 1);
          });

          State.saveTranslationProgress(State.finishedChapters.length);
          Translation.renderCompletedChapters();
          Bookshelf.renderChapterList();
          Utils.showToast(`Đã xóa ${checkboxes.length} chương`, 'success');
        }
      });
    }

    // Chapter list events (EPUB-Forge Style)
    const chapterList = UI.$('#chapterList');
    if (chapterList) {
      chapterList.addEventListener('click', (e) => {
        const item = e.target.closest('.chapter-item');
        if (!item) return;
        const id = parseInt(item.dataset.id);
        const ch = State.chapters.find(c => c.id === id);
        if (!ch) return;

        if (e.target.closest('.numbering-toggle')) {
          ch.shouldNumber = !ch.shouldNumber;
          Bookshelf.recalculateTitles();
          Bookshelf.renderChapterList();
          this.saveChapters();
          Translation.resetFileUI();
        } else if (e.target.matches('input[type="checkbox"]') || e.target.closest('.chapter-checkbox')) {
          ch.selected = e.target.checked;
          item.classList.toggle('selected', ch.selected);
          this.saveChapters();
          Translation.resetFileUI();
        } else {
          if (window.ChapterWorkspace) {
            ChapterWorkspace.selectChapter(id);
          }
        }
      });
    }
  },

  setupCompletedChapterActions() {
    if (!UI.elements.previewContent) return;

    // Completed Chapter Button Events
    UI.elements.previewContent.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const idx = parseInt(btn.dataset.idx);
      const chapter = State.finishedChapters[idx];

      if (btn.classList.contains('view-chapter-btn')) {
        if (window.ModalController) {
          ModalController.showChapterModal(chapter);
        } else if (window.showChapterModal) {
          window.showChapterModal(chapter);
        }
      } else if (btn.classList.contains('auto-fix-btn')) {
        Translation.autoFixChapter(idx);
      } else if (btn.classList.contains('re-translate-btn')) {
        if (confirm(`Dịch lại chương "${chapter.title}"? Dữ liệu bản dịch cũ của chương này sẽ bị ghi đè.`)) {
          State.finishedChapters.splice(idx, 1);
          
          const ch = State.chapters.find(c => c.id === chapter.sourceChapterId);
          if (ch) ch.selected = true;
          
          State.saveTranslationProgress(State.finishedChapters.length);
          Translation.renderCompletedChapters();
          Bookshelf.renderChapterList();
          
          Translation.startFileTranslation();
        }
      } else if (btn.classList.contains('delete-chapter-btn')) {
        if (confirm(`Xóa chương "${chapter.title}" khỏi bản dịch?`)) {
          State.finishedChapters.splice(idx, 1);
          State.saveTranslationProgress(State.finishedChapters.length);
          Translation.renderCompletedChapters();
          Bookshelf.renderChapterList();
        }
      }
    });

    // Handle finished chapter card click (to toggle checkbox)
    UI.elements.previewContent.addEventListener('click', (e) => {
      const card = e.target.closest('.finished-chapter-card');
      if (!card) return;
      
      if (e.target.closest('.finished-chapter-actions')) return;
      
      const cb = card.querySelector('.finished-chapter-checkbox');
      if (cb && e.target !== cb) {
        cb.checked = !cb.checked;
      }
      if (cb) {
        card.classList.toggle('selected', cb.checked);
      }
    });
  },

  setupBulkReplace() {
    const showReplaceModal = (defaultScope = 'finished') => {
      const scopeEl = UI.$('#replaceScope');
      if (scopeEl) scopeEl.value = defaultScope;
      const modal = UI.$('#bulkReplaceModal');
      if (modal) modal.classList.remove('hidden');
      const findInput = UI.$('#findInput');
      if (findInput) findInput.focus();
    };

    const hideReplaceModal = () => {
      const modal = UI.$('#bulkReplaceModal');
      if (modal) modal.classList.add('hidden');
    };

    const bulkReplaceBtn = UI.$('#bulkReplaceBtn');
    if (bulkReplaceBtn) bulkReplaceBtn.addEventListener('click', () => showReplaceModal('finished'));

    const bulkReplaceSourceBtn = UI.$('#bulkReplaceSourceBtn');
    if (bulkReplaceSourceBtn) bulkReplaceSourceBtn.addEventListener('click', () => showReplaceModal('source'));

    const closeBtn = UI.$('#closeReplaceModal');
    if (closeBtn) closeBtn.addEventListener('click', hideReplaceModal);

    const cancelBtn = UI.$('#cancelReplaceBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', hideReplaceModal);

    const confirmBtn = UI.$('#confirmReplaceBtn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        const findText = UI.$('#findInput').value;
        const replaceText = UI.$('#replaceInput').value;
        const scope = UI.$('#replaceScope').value;
        const caseSensitive = UI.$('#replaceCaseSensitive').checked;
        const useRegex = UI.$('#replaceUseRegex').checked;

        if (!findText) {
          Utils.showToast('Vui lòng nhập từ khóa tìm kiếm', 'info');
          return;
        }

        try {
          const result = Translation.batchReplace(findText, replaceText, { scope, caseSensitive, useRegex });
          if (result.occurrences > 0) {
            Utils.showToast(`Đã thay thế ${result.occurrences} lần tại ${result.chapters} chương.`, 'success');
            hideReplaceModal();
            UI.$('#findInput').value = '';
            UI.$('#replaceInput').value = '';
          } else {
            Utils.showToast('Không tìm thấy từ khóa yêu cầu trong các chương.', 'info');
          }
        } catch (e) {
          Utils.showToast(`Lỗi: ${e.message}`, 'error');
        }
      });
    }
  }
};

window.FileController = FileController;
