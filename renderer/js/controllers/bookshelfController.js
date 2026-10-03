/**
 * BOOKSHELF CONTROLLER (SRP)
 * Manages book interactions, opening files, bookshelf grid/table events, and shelf state
 */

const BookshelfController = {
  init() {
    window.openBookFromShelf = this.openBook.bind(this);
    window.loadFile = this.loadFile.bind(this);
    window.resetFileState = this.resetFileState.bind(this);

    if (UI.elements.fileDropZone) {
      UI.elements.fileDropZone.addEventListener('click', async () => {
        if (State.currentFile) return;
        this.loadFile();
      });
    }

    const addBookBtn = UI.$('#addBookBtn');
    if (addBookBtn) addBookBtn.addEventListener('click', () => this.loadFile(true));

    const backBtn = UI.$('#backToBookshelf');
    if (backBtn) backBtn.addEventListener('click', () => Bookshelf.showList());

    const removeFileBtn = UI.$('#removeFile');
    if (removeFileBtn) {
      removeFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Bạn có chắc muốn xóa truyện này khỏi tủ sách?')) {
          State.deleteBook(State.currentBook ? State.currentBook.filePath : null);
          this.resetFileState();
          Bookshelf.showList();
        }
      });
    }

    // Delegated shelf click for Grid View
    if (UI.elements.bookshelfGrid) {
      UI.elements.bookshelfGrid.addEventListener('click', async (e) => {
        const card = e.target.closest('.book-card');
        if (!card) return;

        const path = card.dataset.path;
        const book = State.books.find(b => b.filePath === path);
        if (!book) return;

        if (e.target.closest('.detail-btn')) {
          e.stopPropagation();
          Bookshelf.openInspector(book);
          return;
        }

        if (e.target.closest('.delete-btn')) {
          e.stopPropagation();
          if (confirm(`Bạn có chắc muốn xóa "${book.title}" khỏi tủ sách?`)) {
            State.deleteBook(path);
            Bookshelf.render();
          }
          return;
        }

        this.openBook(book);
      });
    }

    // Delegated shelf click for Table/List View
    const listContainer = UI.$('#bookshelfList');
    if (listContainer) {
      listContainer.addEventListener('click', async (e) => {
        const row = e.target.closest('tr');
        if (!row) return;

        const path = row.dataset.path;
        const book = State.books.find(b => b.filePath === path);
        if (!book) return;

        if (e.target.closest('.detail-btn')) {
          e.stopPropagation();
          Bookshelf.openInspector(book);
          return;
        }

        if (e.target.closest('.delete-btn')) {
          e.stopPropagation();
          if (confirm(`Bạn có chắc muốn xóa "${book.title}" khỏi tủ sách?`)) {
            State.deleteBook(path);
            Bookshelf.render();
          }
          return;
        }

        this.openBook(book);
      });
    }
  },

  async loadFile(isNew = false) {
    try {
      const result = await window.electronAPI.openFile();
      if (!result) return;
      
      const existingBook = State.books.find(b => b.filePath === result.filePath);
      if (existingBook) {
        Utils.showToast('Truyện này đã có trong tủ sách!', 'info');
        this.openBook(existingBook);
        return;
      }

      // CRITICAL: Cleanly reset all previous translation session state before loading new book
      State.currentBook = null;
      State.finishedChapters = [];
      State.translatedContent = '';
      State.updateFinishedChapters();
      if (window.Translation && typeof window.Translation.renderCompletedChapters === 'function') {
        Translation.renderCompletedChapters();
      }
      if (UI.elements.previewSection) UI.toggleHidden(UI.elements.previewSection, true);
      if (UI.elements.saveFileBtn) UI.toggleHidden(UI.elements.saveFileBtn, true);
      if (UI.elements.progressSection) UI.toggleHidden(UI.elements.progressSection, true);
      if (UI.elements.progressBar) UI.elements.progressBar.style.width = '0%';
      if (window.ChapterWorkspace) {
        ChapterWorkspace.activeChapterId = null;
        ChapterWorkspace.activeMode = 'source';
        if (ChapterWorkspace.isEditing) ChapterWorkspace.toggleEditMode(false);
      }

      State.currentFile = result;
      if (UI.elements.dropContent) UI.toggleHidden(UI.elements.dropContent, true);
      if (UI.elements.fileInfo) UI.toggleHidden(UI.elements.fileInfo, false);
      UI.elements.fileName.textContent = result.fileName;
      UI.elements.fileType.textContent = result.ext;
      UI.elements.fileCharCount.textContent = Utils.formatWordCount(result.wordCount || Utils.countWords(result.content));
      
      if (result.chapters && Array.isArray(result.chapters) && result.chapters.length > 0) {
        ChapterParser.setChapters(result.chapters);
      } else {
        Bookshelf.processChapters(result.content);
      }
      UI.elements.translateFileBtn.disabled = State.chapters.filter(c => c.selected).length === 0;

      const newBook = {
        title: result.metadata?.title && result.metadata.title !== 'Unknown' ? result.metadata.title : result.fileName,
        author: result.metadata?.author && result.metadata.author !== 'Unknown' ? result.metadata.author : 'Chưa rõ tác giả',
        publisher: result.metadata?.publisher || '',
        description: result.metadata?.description || '',
        language: result.metadata?.language || 'vi',
        subjects: result.metadata?.subjects || [],
        cover: result.cover || null,
        filePath: result.filePath,
        fileName: result.fileName,
        ext: result.ext,
        charCount: result.charCount,
        wordCount: result.wordCount || Utils.countWords(result.content),
        size: result.size || 0,
        processedChunks: 0,
        totalChunks: State.chapters.length || 0,
        translatedContent: '',
        lastAccessed: Date.now(),
        chapters: State.chapters.map(c => ({ id: c.id, title: c.title, selected: c.selected, charCount: c.content.length, wordCount: Utils.countWords(c.content) })),
        finishedChapters: [],
        memory: '',
        glossary: [],
        characterProfiles: []
      };
      State.books.push(newBook);
      State.currentBook = newBook;
      State.saveBooks();
      Bookshelf.render();

      if (window.BookGlossary) BookGlossary.render();
      if (window.CharacterProfile) CharacterProfile.render();

      Bookshelf.showDetail();
      Utils.showToast(`Đã tải: ${result.metadata?.title || result.fileName}`, 'success');
    } catch (err) {
      Utils.showToast(`Lỗi đọc file: ${err.message}`, 'error');
    }
  },

  async openBook(book) {
    State.currentBook = book;
    if (!Array.isArray(book.glossary)) book.glossary = [];
    if (!Array.isArray(book.characterProfiles)) book.characterProfiles = [];
    book.lastAccessed = Date.now();

    // Auto-heal contaminated finishedChapters if book was 0% progress but inherited stale finishedChapters
    if (book.processedChunks === 0 && (!book.translatedContent || book.translatedContent === '') && Array.isArray(book.finishedChapters) && book.finishedChapters.length > 0) {
      book.finishedChapters = [];
    }

    State.saveBooks();
    if (window.BookGlossary) BookGlossary.render();
    if (window.CharacterProfile) CharacterProfile.render();
    
    try {
      const result = await window.electronAPI.openFileByPath(book.filePath);
      if (!result) {
        Utils.showToast('Không tìm thấy file gốc. Vui lòng kiểm tra lại đường dẫn file.', 'error');
        return;
      }

      if (result.cover && !book.cover) {
        book.cover = result.cover;
      }
      if (result.metadata?.author && (!book.author || book.author === 'Chưa rõ tác giả')) {
        book.author = result.metadata.author;
      }
      if (result.metadata?.description && !book.description) {
        book.description = result.metadata.description;
      }
      if (result.metadata?.publisher && !book.publisher) {
        book.publisher = result.metadata.publisher;
      }
      
      State.currentFile = result;
      State.translatedContent = book.translatedContent || '';
      State.finishedChapters = Array.isArray(book.finishedChapters) ? [...book.finishedChapters] : [];
      State.updateFinishedChapters();
      
      UI.elements.fileName.textContent = result.fileName;
      UI.elements.fileType.textContent = result.ext;
      UI.elements.fileCharCount.textContent = Utils.formatWordCount(result.wordCount || Utils.countWords(result.content));
      if (UI.elements.fileInfo) UI.toggleHidden(UI.elements.fileInfo, false);
      if (UI.elements.progressSection) UI.toggleHidden(UI.elements.progressSection, true);
      if (UI.elements.progressBar) UI.elements.progressBar.style.width = '0%';
      
      if (window.ChapterWorkspace) {
        ChapterWorkspace.activeChapterId = null;
        ChapterWorkspace.activeMode = State.finishedChapters.length > 0 ? 'translated' : 'source';
        if (ChapterWorkspace.isEditing) ChapterWorkspace.toggleEditMode(false);
      }

      if (result.chapters && Array.isArray(result.chapters) && result.chapters.length > 0) {
        ChapterParser.setChapters(result.chapters);
      } else {
        Bookshelf.processChapters(result.content);
      }

      // Auto-heal previously corrupted or 0-word book records
      if (!book.wordCount || book.wordCount === 0 || !book.totalChunks || (book.totalChunks <= 1 && State.chapters.length > 1)) {
        book.wordCount = result.wordCount || Utils.countWords(result.content);
        book.charCount = result.charCount;
        book.totalChunks = State.chapters.length;
        book.language = result.metadata?.language || book.language;
        book.chapters = State.chapters.map(c => ({ id: c.id, title: c.title, selected: c.selected, charCount: c.content.length, wordCount: Utils.countWords(c.content) }));
      }
      State.saveBooks();

      Translation.renderCompletedChapters();
      
      if (State.finishedChapters.length > 0) {
        UI.toggleHidden(UI.elements.previewSection, false);
        UI.toggleHidden(UI.elements.saveFileBtn, false);
      } else {
        UI.toggleHidden(UI.elements.previewSection, true);
        UI.toggleHidden(UI.elements.saveFileBtn, true);
      }

      Bookshelf.showDetail();
      if (window.Translation && typeof window.Translation.resetFileUI === 'function') {
        Translation.resetFileUI();
      }
    } catch (err) {
      Utils.showToast(`Lỗi: ${err.message}`, 'error');
    }
  },

  resetFileState() {
    State.currentFile = null;
    State.currentBook = null;
    if (window.BookGlossary) BookGlossary.close();
    if (window.CharacterProfile) CharacterProfile.close();
    State.translatedContent = '';
    State.chapters = [];
    State.finishedChapters = [];
    
    if (UI.elements.dropContent) UI.toggleHidden(UI.elements.dropContent, false);
    if (UI.elements.fileInfo) UI.toggleHidden(UI.elements.fileInfo, true);
    UI.toggleHidden(UI.elements.progressSection, true);
    UI.toggleHidden(UI.$('#chapterListSection'), true);
    UI.toggleHidden(UI.elements.previewSection, true);
    UI.toggleHidden(UI.elements.saveFileBtn, true);
    
    UI.elements.translateFileBtn.disabled = true;
    UI.elements.progressBar.style.width = '0%';
  }
};

window.BookshelfController = BookshelfController;
