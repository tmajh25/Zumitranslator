/**
 * BOOK INSPECTOR MODULE
 * Dedicated controller for the Book Inspector modal dialog (overview, metadata editor, TOC preview).
 */

const BookInspector = {
  book: null,
  activeTab: 'overview',
  chapters: [],
  activeTocChapter: null,
  initialized: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.setupEventListeners();
  },

  setupEventListeners() {
    // Inspector Tabs
    const inspectorTabs = UI.$$('.inspector-tab');
    inspectorTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        inspectorTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.switchTab(tab.dataset.tab);
      });
    });

    // Inspector Close
    const closeBtn = UI.$('#closeBookInspectorBtn');
    const backdrop = UI.$('#bookInspectorBackdrop');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
    if (backdrop) backdrop.addEventListener('click', () => this.close());

    // Change Cover Button
    const changeCoverBtn = UI.$('#changeCoverBtn');
    if (changeCoverBtn) {
      changeCoverBtn.addEventListener('click', async () => {
        if (!this.book) return;
        try {
          const result = await window.electronAPI.selectCoverImage();
          if (result && result.dataUrl) {
            this.book.cover = result.dataUrl;
            const coverBox = UI.$('#inspectorCoverBox');
            if (coverBox) {
              coverBox.innerHTML = `<img src="${result.dataUrl}" alt="${this.book.title}" />`;
            }
            State.saveBooks();
            if (window.Bookshelf) window.Bookshelf.render();
            Utils.showToast('Đã chọn ảnh bìa mới. Bấm "Ghi đè vào File EPUB" để lưu vào file!', 'success');
          }
        } catch (err) {
          Utils.showToast('Lỗi chọn ảnh bìa: ' + err.message, 'error');
        }
      });
    }

    // Remove Cover Button
    const removeCoverBtn = UI.$('#removeCoverBtn');
    if (removeCoverBtn) {
      removeCoverBtn.addEventListener('click', () => {
        if (!this.book) return;
        if (confirm('Bạn có chắc muốn gỡ ảnh bìa của sách này?')) {
          this.book.cover = null;
          const coverBox = UI.$('#inspectorCoverBox');
          if (coverBox) {
            coverBox.innerHTML = `
              <div class="book-fallback-cover" style="padding: 30px 16px;">
                <div class="book-fallback-title">${this.book.title}</div>
                <div class="book-fallback-author">${this.book.author || 'Chưa rõ tác giả'}</div>
              </div>
            `;
          }
          State.saveBooks();
          if (window.Bookshelf) window.Bookshelf.render();
          Utils.showToast('Đã gỡ ảnh bìa.', 'info');
        }
      });
    }

    // Save Meta to DB Button
    const saveMetaDbBtn = UI.$('#saveMetaDbBtn');
    if (saveMetaDbBtn) {
      saveMetaDbBtn.addEventListener('click', () => this.saveMetadata(false));
    }

    // Save Metadata Changes (and write to disk EPUB) button
    const saveMetaBtn = UI.$('#saveMetaChangesBtn');
    if (saveMetaBtn) {
      saveMetaBtn.addEventListener('click', () => this.saveMetadata(true));
    }

    // Inspector Continue Button
    const continueBtn = UI.$('#inspectorContinueBtn');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        if (this.book) {
          const b = this.book;
          this.close();
          if (typeof window.openBookFromShelf === 'function') {
            window.openBookFromShelf(b);
          }
        }
      });
    }

    // Inspector Delete Button
    const deleteBtn = UI.$('#inspectorDeleteBtn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        if (this.book) {
          const path = this.book.filePath;
          if (confirm(`Bạn có chắc muốn xóa "${this.book.title}" khỏi tủ sách?`)) {
            State.deleteBook(path);
            this.close();
            if (window.Bookshelf) window.Bookshelf.render();
            Utils.showToast('Đã xóa sách khỏi thư viện.', 'info');
          }
        }
      });
    }

    // Inspector Open Folder Button
    const openFolderBtn = UI.$('#inspectorOpenFolderBtn');
    if (openFolderBtn) {
      openFolderBtn.addEventListener('click', () => {
        if (this.book && this.book.filePath) {
          window.electronAPI.openFolder(this.book.filePath);
        }
      });
    }

    // Inspector Copy Path Button
    const copyPathBtn = UI.$('#inspectorCopyPathBtn');
    if (copyPathBtn) {
      copyPathBtn.addEventListener('click', () => {
        if (this.book && this.book.filePath) {
          navigator.clipboard.writeText(this.book.filePath).then(() => {
            Utils.showToast('Đã sao chép đường dẫn file!', 'info');
          }).catch(() => {
            Utils.showToast('Không thể sao chép đường dẫn.', 'error');
          });
        }
      });
    }

    // Inspector Export Button
    const exportBtn = UI.$('#inspectorExportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        if (!this.book) return;
        const b = this.book;
        const finished = b.finishedChapters || [];
        if (finished.length === 0) {
          Utils.showToast('Chưa có chương nào đã dịch để xuất!', 'warning');
          return;
        }

        const content = finished.map(fc => `${fc.title}\n\n${fc.content}`).join('\n\n---\n\n');
        
        try {
          const result = await window.electronAPI.saveFile({
            content,
            fileName: `${b.title || 'translated'}_vi.txt`,
            ext: '.txt'
          });
          if (result) {
            Utils.showToast(`Đã xuất ${finished.length} chương đã dịch thành công!`, 'success');
          }
        } catch (err) {
          Utils.showToast('Lỗi xuất file: ' + err.message, 'error');
        }
      });
    }

    // Inspector Optimize EPUB Button & Modal
    const optimizeBtn = UI.$('#inspectorOptimizeBtn');
    const optModal = UI.$('#epubOptimizeModal');
    const closeOptModalBtn = UI.$('#closeEpubOptimizeModal');
    const cancelOptBtn = UI.$('#cancelEpubOptimizeBtn');
    const confirmOptBtn = UI.$('#confirmEpubOptimizeBtn');

    const closeOptDialog = () => {
      if (optModal) UI.toggleHidden(optModal, true);
    };

    if (closeOptModalBtn) closeOptModalBtn.addEventListener('click', closeOptDialog);
    if (cancelOptBtn) cancelOptBtn.addEventListener('click', closeOptDialog);

    if (optimizeBtn) {
      optimizeBtn.addEventListener('click', () => {
        if (!this.book || !this.book.filePath) return;
        const filePath = this.book.filePath;
        const ext = (this.book.ext || '').toLowerCase();
        if (ext !== '.epub' && !filePath.toLowerCase().endsWith('.epub')) {
          Utils.showToast('Tính năng tối ưu hóa tệp chỉ hỗ trợ định dạng EPUB.', 'warning');
          return;
        }
        if (optModal) {
          UI.toggleHidden(optModal, false);
        }
      });
    }

    if (confirmOptBtn) {
      confirmOptBtn.addEventListener('click', async () => {
        if (!this.book || !this.book.filePath) return;
        const filePath = this.book.filePath;
        const purgeOrphans = !!UI.$('#optPurgeOrphans')?.checked;
        const cleanHtml = !!UI.$('#optCleanHtml')?.checked;
        const recompress = !!UI.$('#optRecompress')?.checked;

        if (!purgeOrphans && !cleanHtml && !recompress) {
          Utils.showToast('Vui lòng chọn ít nhất một tùy chọn tối ưu!', 'warning');
          return;
        }

        closeOptDialog();

        const origHtml = optimizeBtn ? optimizeBtn.innerHTML : '';
        if (optimizeBtn) {
          optimizeBtn.disabled = true;
          optimizeBtn.innerHTML = `<span>⏳ Đang tối ưu...</span>`;
        }

        try {
          const res = await window.electronAPI.optimizeEpub(filePath, { purgeOrphans, cleanHtml, recompress });
          if (res && res.success) {
            const savedMb = (res.savedBytes / (1024 * 1024)).toFixed(2);
            const savedKb = (res.savedBytes / 1024).toFixed(1);
            const savedStr = res.savedBytes > 1024 * 1024 ? `${savedMb} MB` : `${savedKb} KB`;

            // Update book size
            this.book.size = res.newSize;
            const sizeEl = UI.$('#inspectorBookSize');
            if (sizeEl) sizeEl.textContent = Utils.formatFileSize(res.newSize);

            State.saveBooks();
            if (window.Bookshelf) window.Bookshelf.render();

            let msg = `Tối ưu EPUB thành công!\n- Tiết kiệm: ${savedStr} (${res.savedPercent}%)`;
            if (purgeOrphans) {
              msg += `\n- Đã xóa: ${res.removedImagesCount} ảnh mồ côi`;
            }
            if (cleanHtml && res.optimizedChaptersCount > 0) {
              msg += `\n- Đã dọn sạch rác HTML cho ${res.optimizedChaptersCount} chương`;
            }
            if (res.removedImagesCount > 0 && res.orphanFiles && res.orphanFiles.length > 0) {
              msg += `\n(Ảnh đã xóa: ${res.orphanFiles.slice(0, 5).join(', ')}${res.orphanFiles.length > 5 ? '...' : ''})`;
            }
            alert(msg);
            Utils.showToast(`Đã tối ưu: giảm ${savedStr}!`, 'success');
          } else {
            Utils.showToast(`Lỗi tối ưu EPUB: ${res?.error || 'Thao tác thất bại'}`, 'error');
          }
        } catch (err) {
          console.error('[Inspector] Lỗi tối ưu hóa EPUB:', err);
          Utils.showToast(`Lỗi: ${err.message}`, 'error');
        } finally {
          if (optimizeBtn) {
            optimizeBtn.disabled = false;
            optimizeBtn.innerHTML = origHtml;
          }
        }
      });
    }

    // Inspector TOC Search
    const tocSearchInput = UI.$('#inspectorTocSearch');
    const tocSearchClear = UI.$('#inspectorTocSearchClear');
    if (tocSearchInput) {
      tocSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (tocSearchClear) UI.toggleHidden(tocSearchClear, !query);
        this.filterToc(query);
      });
    }
    if (tocSearchClear) {
      tocSearchClear.addEventListener('click', () => {
        if (tocSearchInput) {
          tocSearchInput.value = '';
          UI.toggleHidden(tocSearchClear, true);
          this.filterToc('');
          tocSearchInput.focus();
        }
      });
    }

    // Inspector Read Chapter in TOC Preview
    const readChBtn = UI.$('#inspectorReadChapterBtn');
    if (readChBtn) {
      readChBtn.addEventListener('click', () => {
        if (this.book) {
          const b = this.book;
          const ch = this.activeTocChapter;
          this.close();
          if (typeof window.openBookFromShelf === 'function') {
            window.openBookFromShelf(b);
            if (ch && window.ChapterWorkspace) {
              setTimeout(() => {
                if (ChapterWorkspace.selectChapter) ChapterWorkspace.selectChapter(ch.id);
              }, 300);
            }
          }
        }
      });
    }
  },

  open(book) {
    if (!this.initialized) this.init();
    this.book = book;
    const modal = UI.$('#bookInspectorModal');
    if (!modal) return;

    // Set badge
    const ext = (book.ext || '.epub').replace('.', '').toUpperCase();
    const badge = UI.$('#inspectorExtBadge');
    if (badge) badge.textContent = ext;

    // Title
    const titleEl = UI.$('#inspectorTitle');
    if (titleEl) titleEl.textContent = book.title;

    // Overview Tab fields
    const author = book.author || 'Chưa rõ tác giả';
    const progress = window.Bookshelf ? window.Bookshelf.getBookProgress(book) : 0;
    
    const coverBox = UI.$('#inspectorCoverBox');
    if (coverBox) {
      if (book.cover) {
        coverBox.innerHTML = `<img src="${book.cover}" alt="${book.title}" />`;
      } else {
        coverBox.innerHTML = `
          <div class="book-fallback-cover" style="padding: 30px 16px;">
            <div class="book-fallback-title">${book.title}</div>
            <div class="book-fallback-author">${author}</div>
          </div>
        `;
      }
    }

    const bookTitleEl = UI.$('#inspectorBookTitle');
    if (bookTitleEl) bookTitleEl.textContent = book.title;

    const authorEl = UI.$('#inspectorBookAuthor');
    if (authorEl) authorEl.textContent = author;

    const formatEl = UI.$('#inspectorBookFormat');
    if (formatEl) formatEl.textContent = book.ext || '.epub';

    const sizeEl = UI.$('#inspectorBookSize');
    if (sizeEl) {
      sizeEl.textContent = book.size ? Utils.formatFileSize(book.size) : `${Math.round((book.charCount || 0) / 1024 * 2)} KB (ước tính)`;
    }

    const optimizeBtn = UI.$('#inspectorOptimizeBtn');
    if (optimizeBtn) {
      const isEpub = (book.ext || '').toLowerCase() === '.epub' || (book.filePath || '').toLowerCase().endsWith('.epub');
      UI.toggleHidden(optimizeBtn, !isEpub);
    }

    const charsEl = UI.$('#inspectorBookChars');
    if (charsEl) charsEl.textContent = (book.wordCount || 0).toLocaleString();

    const chaptersEl = UI.$('#inspectorBookChapters');
    if (chaptersEl) chaptersEl.textContent = (book.totalChunks || book.chapters?.length || 0);
    
    // Language Breakdown for whole book
    if (window.ProgressDetector && typeof window.ProgressDetector.getBookLanguageBreakdown === 'function') {
      const bookBreakdown = ProgressDetector.getBookLanguageBreakdown(book);
      const multiContainer = UI.$('#inspectorMultiLangContainer');
      if (multiContainer) {
        multiContainer.innerHTML = bookBreakdown.barWithTitleHtml || bookBreakdown.barHtml;
      }
      const percentEl = UI.$('#inspectorProgressPercent');
      if (percentEl) {
        percentEl.textContent = `${bookBreakdown.targetPercent}% Tiếng Việt`;
      }
    } else {
      const percentEl = UI.$('#inspectorProgressPercent');
      if (percentEl) percentEl.textContent = `${progress}%`;
      const pBar = UI.$('#inspectorProgressBar');
      if (pBar) pBar.style.width = `${progress}%`;
    }
    const descEl = UI.$('#inspectorBookDesc');
    if (descEl) descEl.textContent = book.description || 'Chưa có mô tả tóm tắt cho cuốn sách này.';

    // Translation stats
    const finishedCount = (book.finishedChapters || []).length;
    const totalChapters = book.totalChunks || book.chapters?.length || 0;
    const translatedEl = UI.$('#inspectorTranslatedChapters');
    const totalAltEl = UI.$('#inspectorTotalChaptersAlt');
    if (translatedEl) translatedEl.textContent = finishedCount;
    if (totalAltEl) totalAltEl.textContent = totalChapters;

    // Last accessed
    const lastAccessedEl = UI.$('#inspectorLastAccessed');
    if (lastAccessedEl) {
      if (book.lastAccessed) {
        const d = new Date(book.lastAccessed);
        lastAccessedEl.textContent = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      } else {
        lastAccessedEl.textContent = 'Chưa mở';
      }
    }

    // File path
    const filePathEl = UI.$('#inspectorFilePath');
    if (filePathEl) {
      const fp = book.filePath || 'Chưa xác định';
      const parts = fp.replace(/\\/g, '/').split('/');
      const shortPath = parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : fp;
      filePathEl.textContent = shortPath;
      filePathEl.title = fp;
    }

    // Metadata Tab form
    const metaTitle = UI.$('#editMetaTitle');
    if (metaTitle) metaTitle.value = book.title || '';
    const metaAuthor = UI.$('#editMetaAuthor');
    if (metaAuthor) metaAuthor.value = book.author || '';
    const metaPub = UI.$('#editMetaPublisher');
    if (metaPub) metaPub.value = book.publisher || '';
    const metaLang = UI.$('#editMetaLanguage');
    if (metaLang) metaLang.value = book.language || 'vi';
    const metaSub = UI.$('#editMetaSubjects');
    if (metaSub) metaSub.value = Array.isArray(book.subjects) ? book.subjects.join(', ') : (book.subjects || '');
    const descTextarea = UI.$('#editMetaDescription');
    if (descTextarea) descTextarea.value = book.description || '';

    // Reset TOC preview & search state
    const emptyBox = UI.$('#inspectorTocEmpty');
    const contentBox = UI.$('#inspectorTocContent');
    if (emptyBox) UI.toggleHidden(emptyBox, false);
    if (contentBox) UI.toggleHidden(contentBox, true);
    
    const tocSearchInput = UI.$('#inspectorTocSearch');
    if (tocSearchInput) tocSearchInput.value = '';
    const tocSearchClear = UI.$('#inspectorTocSearchClear');
    if (tocSearchClear) UI.toggleHidden(tocSearchClear, true);
    this.activeTocChapter = null;

    // TOC Tab
    this.renderToc(book);

    // Reset to overview tab
    this.switchTab('overview');
    
    // Show/hide export button
    const exportBtn = UI.$('#inspectorExportBtn');
    if (exportBtn) {
      UI.toggleHidden(exportBtn, finishedCount === 0);
    }
    
    UI.toggleHidden(modal, false);
  },

  switchTab(tabKey) {
    this.activeTab = tabKey;
    const tabs = UI.$$('.inspector-tab');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabKey));

    UI.toggleHidden(UI.$('#inspectorTabOverview'), tabKey !== 'overview');
    UI.toggleHidden(UI.$('#inspectorTabMetadata'), tabKey !== 'metadata');
    UI.toggleHidden(UI.$('#inspectorTabToc'), tabKey !== 'toc');
  },

  async renderToc(book) {
    const tocList = UI.$('#inspectorTocList');
    const tocCount = UI.$('#inspectorTocCount');
    if (!tocList) return;

    let chapters = book.chapters || [];
    
    // If book doesn't have cached chapters, try to load them from file
    if (chapters.length === 0 && book.filePath) {
      try {
        const fileData = await window.electronAPI.openFileByPath(book.filePath);
        if (fileData) {
          if (fileData.chapters && fileData.chapters.length > 0) {
            if (window.ChapterParser) ChapterParser.setChapters(fileData.chapters);
            chapters = State.chapters;
          } else if (fileData.content) {
            if (window.Bookshelf) window.Bookshelf.processChapters(fileData.content);
            chapters = State.chapters;
          }
          book.chapters = chapters.map(c => ({
            id: c.id,
            title: c.title,
            selected: c.selected,
            charCount: c.content ? c.content.length : 0,
            wordCount: c.content ? Utils.countWords(c.content) : 0,
            content: c.content || ''
          }));
          book.totalChunks = chapters.length;
          State.saveBooks();
        }
      } catch (e) {
        console.warn('Could not read chapters for TOC:', e);
      }
    }

    this.chapters = chapters;
    if (tocCount) tocCount.textContent = chapters.length;

    this.renderTocList(chapters);
  },

  filterToc(query) {
    if (!this.chapters) return;
    if (!query) {
      this.renderTocList(this.chapters);
      return;
    }
    const q = query.toLowerCase();
    const filtered = this.chapters.filter((ch) => {
      const originalIndex = this.chapters.indexOf(ch) + 1;
      const titleMatch = (ch.title || '').toLowerCase().includes(q);
      const indexMatch = originalIndex.toString() === q || `chương ${originalIndex}`.includes(q);
      return titleMatch || indexMatch;
    });
    this.renderTocList(filtered, true);
  },

  renderTocList(chaptersToRender, isFiltered = false) {
    const tocList = UI.$('#inspectorTocList');
    if (!tocList) return;

    if (!chaptersToRender || chaptersToRender.length === 0) {
      if (isFiltered) {
        tocList.innerHTML = `
          <div style="padding: 30px 16px; text-align: center; color: var(--text-tertiary); font-size: 12.5px;">
            <p>Không tìm thấy chương nào khớp với từ khóa.</p>
          </div>
        `;
      } else {
        tocList.innerHTML = `
          <div style="padding: 30px 16px; text-align: center; color: var(--text-tertiary); font-size: 12.5px;">
            <p>Chưa có mục lục chương.</p>
            <p style="margin-top: 6px; font-size: 11.5px;">Bấm "Mở dịch / Đọc truyện" để tải dữ liệu.</p>
          </div>
        `;
      }
      return;
    }

    const book = this.book;
    const finishedIds = new Set((book?.finishedChapters || []).map(fc => fc.sourceChapterId !== undefined ? fc.sourceChapterId : fc.id));

    tocList.innerHTML = chaptersToRender.map((ch, idx) => {
      const originalIndex = this.chapters ? this.chapters.indexOf(ch) : idx;
      const displayIndex = originalIndex >= 0 ? originalIndex + 1 : idx + 1;
      const targetLang = (State.settings && State.settings.targetLang) || 'vi';
      const isFinished = finishedIds.has(ch.id) ||
                         (window.ProgressDetector && typeof window.ProgressDetector.matchesTargetLanguage === 'function' && window.ProgressDetector.matchesTargetLanguage(ch.content || ch.title, targetLang));
      const isActive = this.activeTocChapter && this.activeTocChapter.id === ch.id;

      let statusBadge = '';
      if (window.ProgressDetector && typeof window.ProgressDetector.getLanguageBreakdown === 'function') {
        const text = ch.content || ch.title || '';
        const bd = ProgressDetector.getLanguageBreakdown(text, targetLang);
        statusBadge = bd.badgeHtml;
      } else {
        statusBadge = isFinished ? '<span class="lang-ratio-badge done">vi 100%</span>' : '';
      }

      return `
        <div class="toc-row ${isActive ? 'active' : ''}" data-id="${ch.id}">
          <div class="toc-row-left">
            <span class="toc-index">${displayIndex}.</span>
            <span class="toc-title" title="${ch.title}">${ch.title}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            <span class="toc-chars">${ch.wordCount ? ch.wordCount.toLocaleString() + ' từ' : ''}</span>
            ${statusBadge}
          </div>
        </div>
      `;
    }).join('');

    // Row click: preview chapter content in split right column
    const rows = tocList.querySelectorAll('.toc-row');
    rows.forEach(row => {
      row.addEventListener('click', () => {
        rows.forEach(r => r.classList.remove('active'));
        row.classList.add('active');
        const chId = parseInt(row.dataset.id);
        const ch = (this.chapters || []).find(c => c.id === chId);
        if (ch) {
          this.activeTocChapter = ch;
          const emptyBox = UI.$('#inspectorTocEmpty');
          const contentBox = UI.$('#inspectorTocContent');
          const titleBox = UI.$('#inspectorTocTitle');
          const charBox = UI.$('#inspectorTocCharCount');
          const bodyBox = UI.$('#inspectorTocBody');

          if (emptyBox) UI.toggleHidden(emptyBox, true);
          if (contentBox) UI.toggleHidden(contentBox, false);
          if (titleBox) {
            titleBox.textContent = ch.title;
            titleBox.title = ch.title;
          }
          if (charBox) charBox.textContent = Utils.formatWordCount(ch.wordCount || Utils.countWords(ch.content || ''));
          if (bodyBox) {
            const stateCh = State.chapters.find(c => c.id === ch.id);
            const content = ch.content || (stateCh ? stateCh.content : '');
            if (content && content.trim().length > 0) {
              if (window.ChapterWorkspace && ChapterWorkspace.formatContentHtml) {
                bodyBox.innerHTML = ChapterWorkspace.formatContentHtml(content, false, ch ? ch.title : '');
              } else {
                bodyBox.innerText = content;
              }
            } else {
              bodyBox.innerHTML = `
                <div style="padding: 40px 20px; text-align: center; color: var(--text-tertiary);">
                  <p style="font-size: 13.5px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">Nội dung chương chưa nạp</p>
                  <p style="font-size: 12px; margin-bottom: 16px;">Nội dung chi tiết sẽ được nạp khi bạn mở truyện.</p>
                  <button class="btn btn-primary btn-sm" id="quickOpenThisChapterBtn">
                    <span>Mở đọc truyện</span>
                  </button>
                </div>
              `;
              const quickBtn = bodyBox.querySelector('#quickOpenThisChapterBtn');
              if (quickBtn) {
                quickBtn.addEventListener('click', () => {
                  const continueBtn = UI.$('#inspectorContinueBtn');
                  if (continueBtn) continueBtn.click();
                });
              }
            }
            bodyBox.scrollTop = 0;
          }
        }
      });
    });
  },

  async saveMetadata(writeToDisk = false) {
    if (!this.book) return;
    const b = this.book;

    b.title = UI.$('#editMetaTitle').value.trim() || b.title;
    b.author = UI.$('#editMetaAuthor').value.trim() || b.author;
    b.publisher = UI.$('#editMetaPublisher').value.trim();
    b.language = UI.$('#editMetaLanguage').value.trim() || 'vi';
    b.description = UI.$('#editMetaDescription').value.trim();

    const subjectsStr = UI.$('#editMetaSubjects').value.trim();
    b.subjects = subjectsStr ? subjectsStr.split(',').map(s => s.trim()).filter(Boolean) : [];

    State.saveBooks();
    this.open(b);
    if (window.Bookshelf) window.Bookshelf.render();

    if (writeToDisk) {
      if (!b.filePath || !b.filePath.toLowerCase().endsWith('.epub')) {
        Utils.showToast('Chỉ hỗ trợ ghi đè metadata trực tiếp vào file .epub!', 'warning');
        return;
      }

      const saveBtn = UI.$('#saveMetaChangesBtn');
      const originalText = saveBtn ? saveBtn.textContent : '';
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Đang ghi đè...';
      }

      try {
        const metadata = {
          title: b.title,
          author: b.author,
          publisher: b.publisher,
          language: b.language,
          description: b.description,
          subjects: b.subjects
        };

        const res = await window.electronAPI.updateEpubMetadata({
          filePath: b.filePath,
          metadata,
          coverBase64: b.cover
        });

        if (res && res.success) {
          Utils.showToast('Đã ghi đè Metadata & Ảnh bìa trực tiếp vào file EPUB thành công!', 'success');
        } else {
          Utils.showToast('Lỗi ghi file EPUB: ' + (res?.error || 'Lỗi không xác định'), 'error');
        }
      } catch (err) {
        Utils.showToast('Lỗi ghi file EPUB: ' + err.message, 'error');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = originalText;
        }
      }
    } else {
      Utils.showToast('Đã lưu thông tin vào Tủ sách thành công!', 'success');
    }
  },

  close() {
    const modal = UI.$('#bookInspectorModal');
    if (modal) UI.toggleHidden(modal, true);
    this.book = null;
  }
};

window.BookInspector = BookInspector;
