/**
 * BOOKSHELF & EPUB WORKSPACE MODULE (Inspired by EPUB-Forge)
 * Handles book management, real cover extraction display, metadata inspector,
 * filtering, search, sorting, and chapter processing
 */

const Bookshelf = {
  searchQuery: '',
  activeFilter: 'all', // 'all' | 'in-progress' | 'completed'
  sortBy: 'recent',    // 'recent' | 'title' | 'progress' | 'chapters'
  viewMode: localStorage.getItem('zumi_bookshelf_view') || 'grid', // 'grid' | 'list'
  inspectorBook: null,
  activeInspectorTab: 'overview',
  initialized: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.setupEventListeners();
    if (window.BookInspector) window.BookInspector.init();
  },

  setupEventListeners() {
    // Search input
    const searchInput = UI.$('#bookshelfSearchInput');
    const clearBtn = UI.$('#clearBookshelfSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        if (clearBtn) UI.toggleHidden(clearBtn, !this.searchQuery);
        this.render();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        this.searchQuery = '';
        UI.toggleHidden(clearBtn, true);
        this.render();
      });
    }

    // Filter pills
    const filterPills = UI.$$('.filter-pill');
    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.activeFilter = pill.dataset.filter || 'all';
        this.render();
      });
    });

    // Sort select
    const sortSelect = UI.$('#bookshelfSortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.sortBy = e.target.value;
        this.render();
      });
    }

    // View mode buttons
    const gridBtn = UI.$('#viewGridBtn');
    const listBtn = UI.$('#viewListBtn');
    if (gridBtn && listBtn) {
      gridBtn.addEventListener('click', () => {
        this.setViewMode('grid');
      });
      listBtn.addEventListener('click', () => {
        this.setViewMode('list');
      });
    }
  },

  setViewMode(mode) {
    this.viewMode = mode;
    localStorage.setItem('zumi_bookshelf_view', mode);
    
    const gridBtn = UI.$('#viewGridBtn');
    const listBtn = UI.$('#viewListBtn');
    if (gridBtn && listBtn) {
      gridBtn.classList.toggle('active', mode === 'grid');
      listBtn.classList.toggle('active', mode === 'list');
    }
    
    this.render();
  },

  getBookProgress(book) {
    if (!book) return 0;
    if (typeof book.progressPercent === 'number') {
      return book.progressPercent;
    }
    const targetLang = (State.settings && State.settings.targetLang) || 'vi';
    const normTarget = targetLang.toLowerCase().split('-')[0];
    const chapters = book.chapters || [];
    const finishedLen = (book.finishedChapters || []).length;

    // Fast memoization: Avoid re-scanning regex and language detection on every keystroke
    if (
      book._cachedProgress !== undefined &&
      book._cachedTarget === normTarget &&
      book._cachedFinishedLen === finishedLen &&
      book._cachedTotalChapters === chapters.length
    ) {
      return book._cachedProgress;
    }

    let progress = 0;
    if (chapters.length > 0 && window.ProgressDetector && typeof window.ProgressDetector.matchesTargetLanguage === 'function') {
      let doneCount = 0;
      const finishedSet = new Set((book.finishedChapters || []).map(fc => fc.sourceChapterId !== undefined ? fc.sourceChapterId : fc.id));
      chapters.forEach(ch => {
        const text = ch.content || ch.title || '';
        const clean = text.replace(/\[IMG:[^\]]+\]/g, '').replace(/<[^>]+>/g, '').trim();
        const isPureImg = !clean && text.includes('[IMG:');
        const evalDone = ch._langEvaluation && ((ch._langEvaluation.detectedLang || '').toLowerCase().split('-')[0] === normTarget);
        if (finishedSet.has(ch.id) || isPureImg || evalDone || ProgressDetector.matchesTargetLanguage(text, targetLang)) {
          doneCount++;
        }
      });
      progress = Math.round((doneCount / chapters.length) * 100);
    } else {
      const total = book.totalChunks || chapters.length || 0;
      const processed = book.processedChunks || (book.finishedChapters || []).length;
      progress = total > 0 ? Math.round((processed / total) * 100) : 0;
    }

    book._cachedProgress = progress;
    book._cachedTarget = normTarget;
    book._cachedFinishedLen = finishedLen;
    book._cachedTotalChapters = chapters.length;

    return progress;
  },

  getProcessedBooks() {
    let books = State.books || [];

    // Filter by search query
    if (this.searchQuery) {
      books = books.filter(b => {
        const title = (b.title || '').toLowerCase();
        const author = (b.author || '').toLowerCase();
        const subjects = Array.isArray(b.subjects) ? b.subjects.join(' ').toLowerCase() : '';
        return title.includes(this.searchQuery) || author.includes(this.searchQuery) || subjects.includes(this.searchQuery);
      });
    }

    // Filter by status
    if (this.activeFilter === 'in-progress') {
      books = books.filter(b => {
        const progress = this.getBookProgress(b);
        return progress > 0 && progress < 100;
      });
    } else if (this.activeFilter === 'completed') {
      books = books.filter(b => {
        const progress = this.getBookProgress(b);
        return progress === 100;
      });
    }

    // Sort
    books = [...books].sort((a, b) => {
      const progressA = this.getBookProgress(a);
      const progressB = this.getBookProgress(b);

      switch (this.sortBy) {
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'progress':
          return progressB - progressA;
        case 'chapters':
          return (b.totalChunks || 0) - (a.totalChunks || 0);
        case 'recent':
        default:
          return (b.lastAccessed || 0) - (a.lastAccessed || 0);
      }
    });

    return books;
  },

  updateStats() {
    const allBooks = State.books || [];
    let totalChapters = 0;
    let inProgress = 0;
    let completed = 0;

    allBooks.forEach(b => {
      totalChapters += (b.totalChunks || b.chapters?.length || 0);
      const progress = this.getBookProgress(b);
      if (progress === 100) completed++;
      else if (progress > 0) inProgress++;
    });

    const elTotalBooks = UI.$('#statTotalBooks');
    const elTotalChapters = UI.$('#statTotalChapters');
    const elInProgress = UI.$('#statInProgress');
    const elCompleted = UI.$('#statCompleted');

    if (elTotalBooks) elTotalBooks.textContent = allBooks.length;
    if (elTotalChapters) elTotalChapters.textContent = totalChapters.toLocaleString();
    if (elInProgress) elInProgress.textContent = inProgress;
    if (elCompleted) elCompleted.textContent = completed;
  },

  render() {
    this.init();
    this.updateStats();

    const grid = UI.$('#bookshelfGrid');
    const list = UI.$('#bookshelfList');
    const books = this.getProcessedBooks();

    if (this.viewMode === 'list') {
      UI.toggleHidden(grid, true);
      UI.toggleHidden(list, false);
      this.renderList(list, books);
    } else {
      UI.toggleHidden(grid, false);
      UI.toggleHidden(list, true);
      this.renderGrid(grid, books);
    }
  },

  renderGrid(grid, books) {
    if (books.length === 0) {
      grid.innerHTML = `
        <div class="empty-bookshelf-box">
          <h3>${State.books.length === 0 ? 'Tủ sách chưa có tác phẩm nào' : 'Không tìm thấy sách phù hợp'}</h3>
          <p>${State.books.length === 0 ? 'Hãy thêm một file sách (.epub, .txt, .docx) để bắt đầu dịch và đọc.' : 'Thử tìm kiếm với từ khóa khác hoặc thay đổi bộ lọc.'}</p>
          ${State.books.length === 0 ? '<button class="btn btn-primary btn-sm" id="emptyAddBookBtn">Thêm sách mới</button>' : ''}
        </div>
      `;
      const emptyBtn = UI.$('#emptyAddBookBtn');
      if (emptyBtn) emptyBtn.addEventListener('click', () => UI.$('#addBookBtn').click());
      return;
    }

    grid.innerHTML = books.map(book => {
      const author = book.author || 'Chưa rõ tác giả';
      const ext = (book.ext || '.epub').replace('.', '').toUpperCase();

      let coverHtml = '';
      if (book.cover) {
        coverHtml = `<img src="${book.cover}" alt="${book.title}" loading="lazy" />`;
      } else {
        coverHtml = `
          <div class="book-fallback-cover">
            <div class="book-fallback-title">${book.title}</div>
            <div class="book-fallback-author">${author}</div>
          </div>
        `;
      }

      return `
        <div class="book-card" data-path="${book.filePath}">
          <div class="book-cover">
            ${coverHtml}
            <span class="book-format-tag">${ext}</span>
            <div class="book-card-actions">
              <button class="book-action-pill detail-btn" title="Xem chi tiết & Metadata" data-path="${book.filePath}">Chi tiết</button>
              <button class="book-action-pill delete-btn" title="Xóa khỏi tủ sách" data-path="${book.filePath}">Xóa</button>
            </div>
          </div>
          <div class="book-card-info">
            <h3 class="book-card-title" title="${book.title}">${book.title}</h3>
            <p class="book-card-author">${author}</p>
            <div class="book-card-meta">
              <span>${Utils.formatWordCount(book.wordCount || 0)}</span>
              <span>${book.totalChunks || 0} chương</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  renderList(list, books) {
    if (books.length === 0) {
      list.innerHTML = `
        <div class="empty-bookshelf-box">
          <h3>${State.books.length === 0 ? 'Tủ sách chưa có tác phẩm nào' : 'Không tìm thấy sách phù hợp'}</h3>
          <p>${State.books.length === 0 ? 'Hãy thêm một file sách (.epub, .txt, .docx) để bắt đầu dịch và đọc.' : 'Thử tìm kiếm với từ khóa khác hoặc thay đổi bộ lọc.'}</p>
        </div>
      `;
      return;
    }

    list.innerHTML = `
      <table class="books-table">
        <thead>
          <tr>
            <th style="width: 45%">Bìa & Tên sách</th>
            <th>Định dạng</th>
            <th>Số chương</th>
            <th>Dung lượng / Ký tự</th>
            <th style="text-align: right">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${books.map(book => {
            const author = book.author || 'Chưa rõ tác giả';
            const ext = (book.ext || '.epub').toUpperCase();

            let thumbHtml = '';
            if (book.cover) {
              thumbHtml = `<img src="${book.cover}" alt="" />`;
            } else {
              thumbHtml = `<span style="font-size: 11px; font-weight: 700; color: var(--accent-primary)">${ext.replace('.', '')}</span>`;
            }

            return `
              <tr data-path="${book.filePath}">
                <td>
                  <div class="table-title-cell">
                    <div class="table-cover-thumb">${thumbHtml}</div>
                    <div>
                      <div class="table-book-name">${book.title}</div>
                      <div class="table-book-author">${author}</div>
                    </div>
                  </div>
                </td>
                <td><span class="format-badge">${ext}</span></td>
                <td>${book.totalChunks || 0} chương</td>
                <td>${Utils.formatWordCount(book.wordCount || 0)}</td>
                <td>
                  <div class="table-actions">
                    <button class="table-action-btn detail-btn" data-path="${book.filePath}">Chi tiết</button>
                    <button class="table-action-btn open-btn" data-path="${book.filePath}">Mở</button>
                    <button class="table-action-btn danger delete-btn" data-path="${book.filePath}">Xóa</button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  openInspector(book) {
    if (window.BookInspector) {
      window.BookInspector.open(book);
    }
  },

  closeInspector() {
    if (window.BookInspector) {
      window.BookInspector.close();
    }
  },

  showDetail() {
    UI.$('.bookshelf-header').classList.add('hidden');
    const stats = UI.$('#bookshelfStats');
    if (stats) stats.classList.add('hidden');
    const toolbar = UI.$('#bookshelfToolbar');
    if (toolbar) toolbar.classList.add('hidden');
    const grid = UI.$('#bookshelfGrid');
    if (grid) grid.classList.add('hidden');
    const list = UI.$('#bookshelfList');
    if (list) list.classList.add('hidden');

    UI.$('#bookDetailView').classList.remove('hidden');
    
    if (State.currentBook) {
      if (!Array.isArray(State.currentBook.glossary)) State.currentBook.glossary = [];
      if (!Array.isArray(State.currentBook.characterProfiles)) State.currentBook.characterProfiles = [];
      if (window.BookGlossary) BookGlossary.render();
      if (window.CharacterProfile) CharacterProfile.render();
      if (window.TranslationWorkflow) TranslationWorkflow.update();
      if (window.Translation && typeof window.Translation.resetFileUI === 'function') {
        Translation.resetFileUI();
      }
    }
  },

  showList() {
    UI.$('.bookshelf-header').classList.remove('hidden');
    const stats = UI.$('#bookshelfStats');
    if (stats) stats.classList.remove('hidden');
    const toolbar = UI.$('#bookshelfToolbar');
    if (toolbar) toolbar.classList.remove('hidden');
    if (window.BookGlossary) BookGlossary.close();
    if (window.CharacterProfile) CharacterProfile.close();
    UI.$('#bookDetailView').classList.add('hidden');
    this.render();
  },

  // --- Chapter Processing (Delegated to ChapterParser) ---
  processChapters(content) {
    ChapterParser.processChapters(content);
  },

  checkMissingChapters() {
    ChapterParser.checkMissingChapters();
  },

  recalculateTitles() {
    ChapterParser.recalculateTitles();
  },

  renderChapterList() {
    ChapterParser.renderChapterList();
  }
};

window.Bookshelf = Bookshelf;
