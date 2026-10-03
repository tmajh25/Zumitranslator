/**
 * ZumiTranslator - Book-Specific Glossary Controller
 * Manages glossary table and AI-driven terminology extraction from chapters
 */

const BookGlossary = {
  isScanning: false,

  init() {
    const toggleBtn = document.getElementById('toggleBookGlossaryBtn');
    const sectionBtn = document.getElementById('sectionBookGlossaryBtn');
    const closeBtn = document.getElementById('closeBookGlossaryBtn');
    const addBtn = document.getElementById('addBookGlossaryItem');
    const inheritBtn = document.getElementById('inheritGlobalGlossaryBtn');
    const clearBtn = document.getElementById('clearBookGlossaryBtn');
    const scanBtn = document.getElementById('aiScanGlossaryBtn');
    const masterToggle = document.getElementById('toggleBookGlossaryActive');
    const scanProviderSelect = document.getElementById('glossaryScanProviderSelect');
    const scanModelSelect = document.getElementById('glossaryScanModelSelect');
    const tableBody = document.getElementById('bookGlossaryTableBody');
    const toggleAll = document.getElementById('toggleAllGlossaryRows');

    if (toggleAll) {
      toggleAll.addEventListener('change', (e) => {
        const book = State.currentBook;
        if (!book || !Array.isArray(book.glossary)) return;
        const isChecked = e.target.checked;
        book.glossary.forEach(item => { item.enabled = isChecked; });
        State.saveBooks();
        this.render();
        this.updateBadges();
      });
    }

    if (scanProviderSelect) {
      scanProviderSelect.addEventListener('change', (e) => {
        State.saveSettings({ profilerProvider: e.target.value });
        const charSelect = document.getElementById('characterScanProviderSelect');
        if (charSelect) charSelect.value = e.target.value;
        const settingSelect = document.getElementById('profilerProviderSetting');
        if (settingSelect) settingSelect.value = e.target.value;
        if (window.CharacterProfile && CharacterProfile.updateProfilerModelDropdowns) {
          CharacterProfile.updateProfilerModelDropdowns(e.target.value);
        }
        Utils.showToast(`Đã chọn AI quét: ${e.target.options[e.target.selectedIndex].text}`, 'info');
      });
    }

    if (scanModelSelect) {
      scanModelSelect.addEventListener('change', (e) => {
        if (window.CharacterProfile && CharacterProfile.onProfilerModelChange) {
          CharacterProfile.onProfilerModelChange(e.target.value);
        } else {
          State.saveSettings({ profilerModel: e.target.value });
        }
      });
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleDrawer());
    }
    if (sectionBtn) {
      sectionBtn.addEventListener('click', () => this.toggleDrawer());
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }
    if (addBtn) {
      addBtn.addEventListener('click', () => this.addItem());
    }
    if (inheritBtn) {
      inheritBtn.addEventListener('click', () => this.inheritGlobal());
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearAll());
    }
    if (scanBtn) {
      scanBtn.addEventListener('click', () => this.aiScanAndFill());
    }

    if (masterToggle) {
      masterToggle.addEventListener('change', (e) => {
        if (!State.currentBook) return;
        State.currentBook.glossaryEnabled = e.target.checked;
        State.saveBooks();
        this.updateBadges();
        const msg = e.target.checked ? 'Đã bật áp dụng Glossary khi dịch.' : 'Đã tắt áp dụng Glossary khi dịch.';
        Utils.showToast(msg, 'info');
      });
    }

    const searchInput = document.getElementById('glossarySearchInput');
    const clearSearchBtn = document.getElementById('clearGlossarySearch');
    const exportBtn = document.getElementById('exportBookGlossaryBtn');
    const importBtn = document.getElementById('importBookGlossaryBtn');
    const importInput = document.getElementById('importBookGlossaryInput');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.filterTable(e.target.value));
    }
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        this.filterTable('');
      });
    }
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportJson());
    }
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => {
        importInput.value = '';
        importInput.click();
      });
      importInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.importFile(e.target.files[0]);
        }
      });
    }

    if (tableBody) {
      // Ghi nhớ giá trị Dịch nghĩa trước khi chỉnh sửa
      tableBody.addEventListener('focusin', (e) => {
        if (e.target.classList.contains('book-glossary-value')) {
          e.target.dataset.prevValue = e.target.value.trim();
        }
      });

      // Nhấn Enter để kết thúc chỉnh sửa và kích hoạt kiểm tra thay thế
      tableBody.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.classList.contains('book-glossary-value')) {
          e.target.blur();
        }
      });

      // Event delegation for table input edits
      tableBody.addEventListener('input', (e) => {
        const row = e.target.closest('tr');
        if (!row) return;
        const index = parseInt(row.dataset.index, 10);
        if (isNaN(index)) return;

        const book = State.currentBook;
        if (!book || !Array.isArray(book.glossary) || !book.glossary[index]) return;

        if (e.target.classList.contains('book-glossary-key')) {
          book.glossary[index].key = e.target.value;
        } else if (e.target.classList.contains('book-glossary-value')) {
          book.glossary[index].value = e.target.value;
        }

        State.saveBooks();
        this.updateBadges();
      });

      // Event delegation for checkbox changes (row enable) & value changes
      tableBody.addEventListener('change', (e) => {
        const row = e.target.closest('tr');
        if (!row) return;
        const index = parseInt(row.dataset.index, 10);
        if (isNaN(index)) return;

        const book = State.currentBook;
        if (!book || !Array.isArray(book.glossary) || !book.glossary[index]) return;

        if (e.target.classList.contains('glossary-enable-chk')) {
          book.glossary[index].enabled = e.target.checked;
          row.classList.toggle('row-disabled', !e.target.checked);
          State.saveBooks();
          this.updateBadges();
        } else if (e.target.classList.contains('book-glossary-value')) {
          const oldVal = (e.target.dataset.prevValue || '').trim();
          const newVal = e.target.value.trim();
          e.target.dataset.prevValue = newVal;
          if (oldVal && newVal && oldVal !== newVal) {
            this.promptAndReplaceStoryText(oldVal, newVal);
          }
        }
      });

      // Event delegation for delete row
      tableBody.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-glossary-btn');
        if (!removeBtn) return;
        const row = removeBtn.closest('tr');
        if (!row) return;
        const index = parseInt(row.dataset.index, 10);
        if (isNaN(index)) return;
        this.removeItem(index);
      });
    }
  },

  cleanGlossaryValue(val, key = '') {
    if (!val || typeof val !== 'string') return '';
    let clean = val.trim();

    // 1. Check if outside is purely foreign (Hangul, Hanzi, Kana) and inside parentheses is Vietnamese/Latin translation
    // e.g. "아카데미 독식 최강이 되었다 (Trở thành kẻ mạnh độc chiếm học viện / Tên viết tắt...)"
    const parenMatch = clean.match(/^([^(（]+)\s*[（(]([^)）]+)[)）]\s*$/);
    if (parenMatch) {
      const outside = parenMatch[1].trim();
      const inside = parenMatch[2].trim();

      const outsideHasLatin = /[a-zA-ZÀ-ỹ]/.test(outside);
      const outsideHasForeign = /[\uac00-\ud7af\u4e00-\u9fa5\u3040-\u30ff]/.test(outside);
      const insideHasLatin = /[a-zA-ZÀ-ỹ]/.test(inside);
      const insideHasForeign = /[\uac00-\ud7af\u4e00-\u9fa5\u3040-\u30ff]/.test(inside);

      if (!outsideHasLatin && outsideHasForeign && insideHasLatin && !insideHasForeign) {
        // Outside is PURELY foreign, true translation is inside parentheses!
        const parts = inside.split(/\s*[/;]\s*/);
        const candidate = parts.find(p => !/^(?:tên viết tắt|thuật ngữ|nghĩa là|chú thích|kỹ năng|ma vật|cấp)/i.test(p.trim()));
        clean = (candidate || parts[0]).trim();
      } else {
        // Outside already has Latin/Vietnamese translation. Strip the explanatory parenthesis!
        clean = outside;
      }
    }

    // 2. Remove any remaining explanatory parentheses: (...), [...], （...）, 【...】
    clean = clean.replace(/\s*[\(\[（【][^)\]）】]*(?:ma vật|kỹ năng|thuật ngữ|tên viết tắt|quê hương|nghĩa là|chú thích|tước hiệu|chức nghiệp|cấp [A-Z0-9]|rank|tier|level|giải thích)[^)\]）】]*[\)\]）】]/gi, '');
    
    // 3. Remove any parenthesis containing foreign script
    clean = clean.replace(/\s*[\(\[（【][^)\]）】]*[\uac00-\ud7af\u4e00-\u9fa5\u3040-\u30ff][^)\]）】]*[\)\]）】]/g, '');

    // 4. Strip any foreign characters (Hangul, Hanzi, Kana) and surrounding quotes or slashes
    // e.g. "Người chồng bị lợi dụng / '퐁퐁남'" -> "Người chồng bị lợi dụng"
    clean = clean.replace(/\s*[/|\-]?\s*['"‘“「]?[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\u4e00-\u9fa5\u3040-\u30ff]+['"’”」]?/g, '');

    // 5. Clean up multiple slashes or alternative choices: e.g. "Priest / Thầy tu / Linh mục" -> pick first clean term
    if (clean.includes('/') && !clean.includes('http')) {
      const parts = clean.split(/\s*\/\s*/).map(p => p.trim()).filter(Boolean);
      if (parts.length > 1) {
        const viPart = parts.find(p => /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(p));
        clean = viPart || parts[0];
      }
    }

    // Clean trailing punctuation, quotes, slashes, spaces
    clean = clean.replace(/^[\s/\\|'":;-]+|[\s/\\|'":;-]+$/g, '').trim();

    // If starts with lowercase letter in Vietnamese, capitalize nicely
    if (clean && clean.length > 1 && /^[a-zà-ỹ]/.test(clean)) {
      clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    }

    return clean;
  },

  getGlossary() {
    if (!State.currentBook) return [];
    if (!Array.isArray(State.currentBook.glossary)) {
      State.currentBook.glossary = [];
    }
    // Auto-clean any contaminated values (containing foreign characters or explanatory notes)
    let hasCleaned = false;
    State.currentBook.glossary.forEach(item => {
      if (!item) return;
      const rawVal = item.value || item.translated || '';
      const cleaned = this.cleanGlossaryValue(rawVal, item.key || item.original || '');
      if (cleaned && cleaned !== rawVal) {
        item.value = cleaned;
        hasCleaned = true;
      }
    });
    if (hasCleaned) {
      State.saveBooks();
    }
    return State.currentBook.glossary;
  },

  exportJson() {
    if (!State.currentBook) {
      Utils.showToast('Vui lòng chọn một cuốn sách trước khi xuất dữ liệu', 'warning');
      return;
    }
    const glossary = this.getGlossary();
    if (!glossary || glossary.length === 0) {
      Utils.showToast('Bảng từ điển hiện đang trống, không có gì để xuất', 'info');
      return;
    }

    const payload = {
      version: 1,
      type: 'zumi_book_glossary',
      bookTitle: State.currentBook.title || 'Truyện',
      exportedAt: new Date().toISOString(),
      glossary: glossary
    };

    const cleanTitle = (State.currentBook.title || 'glossary').replace(/[/\\?%*:|"<>]/g, '_').substring(0, 40);
    const fileName = `Zumi_Glossary_${cleanTitle}_${Date.now()}.json`;

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    Utils.showToast(`Đã xuất ${glossary.length} từ điển thành công!`, 'success');
  },

  importFile(file) {
    if (!file) return;
    if (!State.currentBook) {
      Utils.showToast('Vui lòng mở một cuốn sách trước khi nhập dữ liệu', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        let incoming = [];

        if (file.name.endsWith('.json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            incoming = data;
          } else if (data && Array.isArray(data.glossary)) {
            incoming = data.glossary;
          } else if (data && typeof data === 'object') {
            // Convert object key: value map
            incoming = Object.entries(data).map(([k, v]) => ({ key: k, value: String(v) }));
          }
        } else {
          // Parse plain text (line by line: key = value or key => value or key \t value)
          const lines = text.split(/[\r\n]+/);
          lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return;
            const sepMatch = trimmed.match(/^(.+?)(?:\s*=>\s*|\s*=\s*|\t+)(.+)$/);
            if (sepMatch) {
              incoming.push({ key: sepMatch[1].trim(), value: sepMatch[2].trim() });
            }
          });
        }

        if (incoming.length === 0) {
          Utils.showToast('Tệp không chứa từ điển hợp lệ!', 'warning');
          return;
        }

        const currentList = this.getGlossary();
        let addedCount = 0;
        let updatedCount = 0;

        incoming.forEach(inItem => {
          const k = (inItem.key || inItem.original || '').trim();
          const v = (inItem.value || inItem.translation || '').trim();
          if (!k || !v) return;

          const existing = currentList.find(item => (item.key || item.original || '').toLowerCase().trim() === k.toLowerCase());
          if (existing) {
            existing.value = v;
            if (inItem.enabled !== undefined) existing.enabled = inItem.enabled !== false;
            updatedCount++;
          } else {
            currentList.push({
              key: k,
              value: v,
              enabled: inItem.enabled !== false
            });
            addedCount++;
          }
        });

        State.saveBooks();
        this.render();
        Utils.showToast(`Nhập thành công: Thêm mới ${addedCount}, cập nhật ${updatedCount} từ điển!`, 'success');
      } catch (err) {
        console.error('Import error:', err);
        Utils.showToast('Lỗi khi đọc tệp từ điển: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  },

  filterTable(query) {
    const q = (query || '').toLowerCase().trim();
    const rows = document.querySelectorAll('#bookGlossaryTableBody tr[data-index]');
    const clearBtn = document.getElementById('clearGlossarySearch');
    if (clearBtn) {
      UI.toggleHidden(clearBtn, !q);
    }

    if (!q) {
      rows.forEach(r => { r.style.display = ''; });
      return;
    }

    rows.forEach(row => {
      const idx = parseInt(row.dataset.index, 10);
      const list = this.getGlossary();
      const item = list[idx];
      if (!item) {
        row.style.display = '';
        return;
      }
      const matchKey = (item.key || item.original || '').toLowerCase().includes(q);
      const matchVal = (item.value || item.translation || '').toLowerCase().includes(q);

      if (matchKey || matchVal) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  },

  updateBadges() {
    const list = this.getGlossary();
    const isMasterEnabled = !State.currentBook || State.currentBook.glossaryEnabled !== false;
    const totalCount = list.filter(item => item && (item.key || item.original)).length;
    const activeCount = isMasterEnabled ? list.filter(item => item && (item.key || item.original) && item.enabled !== false).length : 0;

    const countEl = document.getElementById('bookGlossaryCount');
    if (countEl) countEl.textContent = isMasterEnabled ? `${activeCount}` : 'Tắt';

    const sectionCountEl = document.getElementById('sectionBookGlossaryCount');
    if (sectionCountEl) sectionCountEl.textContent = isMasterEnabled ? `${activeCount}` : 'Tắt';

    const badgeEl = document.getElementById('bookGlossaryBadge');
    if (badgeEl) {
      badgeEl.textContent = isMasterEnabled ? `${activeCount}/${totalCount} bật` : 'Đang tắt';
    }
    if (window.TranslationWorkflow) TranslationWorkflow.update();
  },

  render() {
    const list = this.getGlossary();
    const tableBody = document.getElementById('bookGlossaryTableBody');
    const tableWrap = document.getElementById('bookGlossaryTableWrap');
    const emptyEl = document.getElementById('bookGlossaryEmpty');
    const masterToggle = document.getElementById('toggleBookGlossaryActive');
    const toggleAll = document.getElementById('toggleAllGlossaryRows');
    const scanProviderSelect = document.getElementById('glossaryScanProviderSelect');

    if (scanProviderSelect) {
      scanProviderSelect.value = State.settings.profilerProvider || 'auto';
    }

    if (masterToggle && State.currentBook) {
      masterToggle.checked = State.currentBook.glossaryEnabled !== false;
    }

    this.updateBadges();

    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (list.length === 0) {
      if (emptyEl) emptyEl.classList.remove('hidden');
      if (tableWrap) tableWrap.classList.add('hidden');
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');
    if (tableWrap) tableWrap.classList.remove('hidden');

    const allChecked = list.length > 0 && list.every(item => item.enabled !== false);
    if (toggleAll) toggleAll.checked = allChecked;

    list.forEach((item, index) => {
      const isEnabled = item.enabled !== false;
      const row = document.createElement('tr');
      row.dataset.index = index;
      if (!isEnabled) row.className = 'row-disabled';

      const k = item.key || item.original || '';
      const v = item.value || item.translated || '';
      row.innerHTML = `
        <td style="text-align: center;">
          <input type="checkbox" class="glossary-enable-chk" ${isEnabled ? 'checked' : ''} title="Bật/Tắt áp dụng từ này">
        </td>
        <td>
          <input type="text" class="char-input book-glossary-key" value="${Utils.escapeHtml(k)}" placeholder="Thuật ngữ, địa danh, tên gốc (VD: 丹田, 青云门, 相良...)">
        </td>
        <td>
          <input type="text" class="char-input book-glossary-value" value="${Utils.escapeHtml(v)}" data-prev-value="${Utils.escapeHtml(v)}" placeholder="Dịch nghĩa chuẩn (VD: đan điền, Thanh Vân Môn, Sagara...)">
        </td>
        <td style="text-align: center;">
          <button type="button" class="remove-character-btn remove-glossary-btn" title="Xóa từ này">✕</button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  },

  toggleDrawer(force) {
    const drawer = document.getElementById('bookGlossaryDrawer');
    if (!drawer) return;
    const isHidden = drawer.classList.contains('hidden');
    const shouldOpen = force !== undefined ? force : isHidden;

    if (shouldOpen) {
      drawer.classList.remove('hidden');
      this.render();
      if (window.CharacterProfile) CharacterProfile.close();
    } else {
      drawer.classList.add('hidden');
    }
  },

  close() {
    const drawer = document.getElementById('bookGlossaryDrawer');
    if (drawer) drawer.classList.add('hidden');
  },

  addItem() {
    const book = State.currentBook;
    if (!book) {
      Utils.showToast('Chưa mở truyện nào!', 'warning');
      return;
    }
    if (!Array.isArray(book.glossary)) book.glossary = [];

    book.glossary.unshift({ key: '', value: '' });
    State.saveBooks();

    this.toggleDrawer(true);
    this.render();

    setTimeout(() => {
      const firstInput = document.querySelector('#bookGlossaryTableBody .book-glossary-key');
      if (firstInput) firstInput.focus();
    }, 50);
  },

  removeItem(index) {
    const book = State.currentBook;
    if (!book || !Array.isArray(book.glossary)) return;
    book.glossary.splice(index, 1);
    State.saveBooks();
    this.render();
  },

  inheritGlobal() {
    const book = State.currentBook;
    if (!book) return;
    const globalGlossary = State.settings.glossary || [];
    if (globalGlossary.length === 0) {
      Utils.showToast('Cài đặt chung chưa có từ điển nào để kế thừa!', 'info');
      return;
    }

    if (!Array.isArray(book.glossary)) book.glossary = [];

    const existingKeys = new Set(book.glossary.map(i => (i.key || i.original || '').trim().toLowerCase()));
    let addedCount = 0;

    globalGlossary.forEach(item => {
      const k = (item.key || item.original || '').trim().toLowerCase();
      if (k && !existingKeys.has(k)) {
        book.glossary.push({ key: (item.key || item.original).trim(), value: item.value || item.translated || '' });
        existingKeys.add(k);
        addedCount++;
      }
    });

    State.saveBooks();
    this.render();

    if (addedCount > 0) {
      Utils.showToast(`Đã kế thừa ${addedCount} từ vào Glossary của truyện!`, 'success');
    } else {
      Utils.showToast('Tất cả từ điển chung đã có trong truyện này.', 'info');
    }
  },

  clearAll() {
    const book = State.currentBook;
    if (!book || !Array.isArray(book.glossary) || book.glossary.length === 0) return;

    if (confirm('Xóa toàn bộ từ điển riêng của truyện này?')) {
      book.glossary = [];
      State.saveBooks();
      this.render();
      Utils.showToast('Đã làm trống Glossary của truyện.', 'info');
    }
  },

  /**
   * Đếm số lần xuất hiện của từ trong các chương đã dịch của truyện
   */
  countStoryOccurrences(findText, options = {}) {
    if (!findText) return { occurrences: 0, chapters: 0 };
    const finishedChapters = State.finishedChapters || [];
    if (finishedChapters.length === 0) return { occurrences: 0, chapters: 0 };

    const caseSensitive = options.caseSensitive || false;
    const wholeWord = options.wholeWord !== false;

    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let regex;
    if (wholeWord) {
      const letterClass = '[a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]';
      regex = new RegExp(`(?<!${letterClass})${escaped}(?!${letterClass})`, caseSensitive ? 'g' : 'gi');
    } else {
      regex = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
    }

    let occurrences = 0;
    let chapters = 0;

    finishedChapters.forEach(fc => {
      let count = 0;
      if (fc.content) {
        const m = fc.content.match(regex);
        if (m) count += m.length;
      }
      if (fc.title) {
        const m = fc.title.match(regex);
        if (m) count += m.length;
      }
      if (count > 0) {
        occurrences += count;
        chapters++;
      }
    });

    return { occurrences, chapters };
  },

  /**
   * Hỏi người dùng và tự động thay thế toàn bộ từ cũ bằng từ mới trong các chương đã dịch của truyện
   */
  promptAndReplaceStoryText(oldVal, newVal) {
    if (!oldVal || !newVal) return;
    const cleanOld = oldVal.trim();
    const cleanNew = newVal.trim();
    if (!cleanOld || !cleanNew || cleanOld === cleanNew) return;

    // Nếu từ cũ là danh từ riêng viết hoa (VD: "Minh", "Lâm"): bật caseSensitive để tránh thay thế nhầm từ thường ("thông minh", "sơn lâm")
    const isCapitalized = /^[A-ZÀ-Ỹ]/.test(cleanOld);
    const replaceOptions = {
      scope: 'finished',
      caseSensitive: isCapitalized,
      wholeWord: true
    };

    const stats = this.countStoryOccurrences(cleanOld, replaceOptions);
    if (stats.occurrences === 0) {
      return;
    }

    const confirmMsg = `Bạn vừa đổi Dịch nghĩa từ điển từ "${cleanOld}" thành "${cleanNew}".\n\n` +
      `Tìm thấy ${stats.occurrences} lần xuất hiện của từ cũ trong ${stats.chapters} chương đã dịch (đã bật ranh giới từ để chống nuốt chữ).\n\n` +
      `Bạn có muốn tự động thay thế toàn bộ từ "${cleanOld}" bằng "${cleanNew}" trong truyện không?`;

    if (confirm(confirmMsg)) {
      if (typeof Translation !== 'undefined' && Translation.batchReplace) {
        const result = Translation.batchReplace(cleanOld, cleanNew, replaceOptions);
        
        // Cập nhật bộ đệm dịch trực tiếp nếu có
        if (Array.isArray(State.chapters)) {
          const escaped = cleanOld.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const letterClass = '[a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]';
          const regex = new RegExp(`(?<!${letterClass})${escaped}(?!${letterClass})`, isCapitalized ? 'g' : 'gi');
          State.chapters.forEach(ch => {
            if (ch._liveTranslatedContent) {
              ch._liveTranslatedContent = ch._liveTranslatedContent.replace(regex, () => cleanNew);
            }
            if (ch._liveDisplayTitle) {
              ch._liveDisplayTitle = ch._liveDisplayTitle.replace(regex, () => cleanNew);
            }
          });
        }

        // Cập nhật giao diện Chapter Workspace nếu đang mở
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

        Utils.showToast(`Đã thay thế toàn bộ: ${result.occurrences} từ tại ${result.chapters} chương thành "${cleanNew}"!`, 'success');
      }
    }
  },

  /**
   * AI-Driven Terminology, Locations, Character Names Extraction
   */
  async aiScanAndFill(customChapters = null) {
    return (window.GlossaryScanner || GlossaryScanner).scanAndFill(customChapters, this);
  }
};

if (typeof window !== 'undefined') {
  window.BookGlossary = BookGlossary;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BookGlossary;
}
