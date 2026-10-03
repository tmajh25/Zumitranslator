/**
 * ZumiTranslator - Character Profile Controller (Facade & UI Table View)
 * Đảm nhiệm giao diện Bảng hồ sơ nhân vật, xử lý tương tác người dùng,
 * ủy quyền xử lý dữ liệu cho CharacterData và quét AI cho CharacterScanner.
 */

const CharacterProfile = {
  // --- FACADE DELEGATION: DỮ LIỆU & QUY TẮC XƯNG HÔ (CharacterData) ---
  splitTerms(...args) { return (window.CharacterData || CharacterData).splitTerms(...args); },
  cleanSingleToken(...args) { return (window.CharacterData || CharacterData).cleanSingleToken(...args); },
  cleanToTargetLanguage(...args) { return (window.CharacterData || CharacterData).cleanToTargetLanguage(...args); },
  dedupeTerms(...args) { return (window.CharacterData || CharacterData).dedupeTerms(...args); },
  extractTargetKeywords(...args) { return (window.CharacterData || CharacterData).extractTargetKeywords(...args); },
  areTargetsEquivalent(...args) { return (window.CharacterData || CharacterData).areTargetsEquivalent(...args); },
  cleanTargetName(...args) { return (window.CharacterData || CharacterData).cleanTargetName(...args); },
  consolidatePronounRules(...args) { return (window.CharacterData || CharacterData).consolidatePronounRules(...args); },
  getCharacterCanonicalName(...args) { return (window.CharacterData || CharacterData).getCharacterCanonicalName(...args); },
  findPartnerCharacter(...args) { return (window.CharacterData || CharacterData).findPartnerCharacter(...args); },
  syncTwoWayPronounRule(...args) { return (window.CharacterData || CharacterData).syncTwoWayPronounRule(...args); },
  updatePartnerRowSubtableDOM(...args) { return (window.CharacterData || CharacterData).updatePartnerRowSubtableDOM(...args); },
  getPronounRules(...args) { return (window.CharacterData || CharacterData).getPronounRules(...args); },
  syncPronounsString(...args) { return (window.CharacterData || CharacterData).syncPronounsString(...args); },
  parsePronounsPair(...args) { return (window.CharacterData || CharacterData).parsePronounsPair(...args); },
  formatPronounsPair(...args) { return (window.CharacterData || CharacterData).formatPronounsPair(...args); },
  cleanAndConsolidatePronouns(...args) { return (window.CharacterData || CharacterData).cleanAndConsolidatePronouns(...args); },
  cleanAndConsolidateRelationship(...args) { return (window.CharacterData || CharacterData).cleanAndConsolidateRelationship(...args); },
  sanitizeAllProfiles(...args) { return (window.CharacterData || CharacterData).sanitizeAllProfiles(...args); },

  // --- FACADE DELEGATION: AI SCANNER & ENGINE (CharacterScanner) ---
  get isScanning() { return (window.CharacterScanner || CharacterScanner).isScanning; },
  set isScanning(v) { (window.CharacterScanner || CharacterScanner).isScanning = v; },
  acquireScanLock(...args) { return (window.CharacterScanner || CharacterScanner).acquireScanLock(...args); },
  updateProfilerModelDropdowns(...args) { return (window.CharacterScanner || CharacterScanner).updateProfilerModelDropdowns(...args); },
  onProfilerModelChange(...args) { return (window.CharacterScanner || CharacterScanner).onProfilerModelChange(...args); },
  extractCleanKey(...args) { return (window.CharacterScanner || CharacterScanner).extractCleanKey(...args); },
  getProfilerConfig(...args) { return (window.CharacterScanner || CharacterScanner).getProfilerConfig(...args); },
  canScan(...args) { return (window.CharacterScanner || CharacterScanner).canScan(...args); },
  cleanGlossaryValue(...args) { return (window.CharacterScanner || CharacterScanner).cleanGlossaryValue(...args); },
  aiScanAndFill(...args) { return (window.CharacterScanner || CharacterScanner).aiScanAndFill(...args); },

  // --- UI VIEW & STATE ---
  currentView: localStorage.getItem('zumi_char_view') || 'table',

  init() {
    const toggleBtn = document.getElementById('toggleCharacterProfileBtn');
    const sectionBtn = document.getElementById('sectionCharacterProfileBtn');
    const closeBtn = document.getElementById('closeCharacterProfileBtn');
    const addBtn = document.getElementById('addCharacterProfileBtn');
    const clearBtn = document.getElementById('clearCharacterProfileBtn');
    const scanBtn = document.getElementById('aiScanCharactersBtn');
    const masterToggle = document.getElementById('toggleCharacterProfileActive');
    const toggleAll = document.getElementById('toggleAllCharacterRows');
    const scanProviderSelect = document.getElementById('characterScanProviderSelect');
    const scanModelSelect = document.getElementById('characterScanModelSelect');
    const tableBody = document.getElementById('characterTableBody');

    if (toggleAll) {
      toggleAll.addEventListener('change', (e) => {
        const list = this.getCharacterProfiles();
        const isChecked = e.target.checked;
        list.forEach(c => { c.enabled = isChecked; });
        State.saveBooks();
        this.render();
        this.updateBadges();
      });
    }

    if (scanProviderSelect) {
      scanProviderSelect.addEventListener('change', (e) => {
        State.saveSettings({ profilerProvider: e.target.value });
        const glossarySelect = document.getElementById('glossaryScanProviderSelect');
        if (glossarySelect) glossarySelect.value = e.target.value;
        const settingSelect = document.getElementById('profilerProviderSetting');
        if (settingSelect) settingSelect.value = e.target.value;
        this.updateProfilerModelDropdowns(e.target.value);
        Utils.showToast(`Đã chọn AI quét: ${e.target.options[e.target.selectedIndex].text}`, 'info');
      });
    }

    if (scanModelSelect) {
      scanModelSelect.addEventListener('change', (e) => {
        this.onProfilerModelChange(e.target.value);
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
      addBtn.addEventListener('click', () => this.addCharacter());
    }
    const consolidateBtn = document.getElementById('consolidateCharacterProfileBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearAll());
    }
    if (scanBtn) {
      scanBtn.addEventListener('click', () => this.aiScanAndFill());
    }
    if (consolidateBtn) {
      consolidateBtn.addEventListener('click', () => {
        if (!State.currentBook) return;
        const changed = this.sanitizeAllProfiles(State.currentBook);
        this.render();
        Utils.showToast(changed ? 'Đã tinh gọn và loại bỏ các xưng hô trùng lặp!' : 'Hồ sơ nhân vật đã gọn gàng, chuẩn hóa.', 'success');
      });
    }

    if (masterToggle) {
      masterToggle.addEventListener('change', (e) => {
        if (!State.currentBook) return;
        State.currentBook.characterProfilesEnabled = e.target.checked;
        State.saveBooks();
        this.updateBadges();
        const msg = e.target.checked ? 'Đã bật áp dụng Hồ sơ nhân vật khi dịch.' : 'Đã tắt áp dụng Hồ sơ nhân vật khi dịch.';
        Utils.showToast(msg, 'info');
      });
    }

    const searchInput = document.getElementById('characterSearchInput');
    const clearSearchBtn = document.getElementById('clearCharacterSearch');
    const exportBtn = document.getElementById('exportCharacterProfileBtn');
    const importBtn = document.getElementById('importCharacterProfileBtn');
    const importInput = document.getElementById('importCharacterProfileInput');

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
          this.importJson(e.target.files[0]);
        }
      });
    }

    if (tableBody) {
      tableBody.addEventListener('input', (e) => {
        const row = e.target.closest('tr[data-index]');
        if (!row) return;
        const index = parseInt(row.dataset.index, 10);
        if (isNaN(index)) return;

        const char = this.getCharacter(index);
        if (!char) return;

        if (e.target.classList.contains('sub-input')) {
          const subRow = e.target.closest('tr[data-sub-index]');
          if (!subRow) return;
          const subIndex = parseInt(subRow.dataset.subIndex, 10);
          const rules = this.getPronounRules(char);
          if (rules[subIndex]) {
            if (e.target.classList.contains('sub-target')) rules[subIndex].target = e.target.value;
            else if (e.target.classList.contains('sub-self')) rules[subIndex].self = e.target.value;
            else if (e.target.classList.contains('sub-others')) rules[subIndex].others = e.target.value;
            this.syncPronounsString(char);
          }
        } else if (e.target.classList.contains('char-original') || e.target.classList.contains('char-speaker')) {
          char.originalName = e.target.value;
          char.speaker = e.target.value;
        } else if (e.target.classList.contains('char-translated') || e.target.classList.contains('char-listener')) {
          char.translatedName = e.target.value;
          char.listener = e.target.value;
        } else if (e.target.classList.contains('char-pronouns')) {
          char.pronouns = e.target.value;
        } else if (e.target.classList.contains('char-relationship')) {
          char.relationship = e.target.value;
        } else if (e.target.classList.contains('char-notes')) {
          char.note = e.target.value;
        }

        State.saveBooks();
        this.updateBadges();
      });

      tableBody.addEventListener('change', (e) => {
        const row = e.target.closest('tr[data-index]');
        if (!row) return;
        const index = parseInt(row.dataset.index, 10);
        if (isNaN(index)) return;

        const char = this.getCharacter(index);
        if (!char) return;

        if (e.target.classList.contains('char-gender')) {
          char.gender = e.target.value;
          State.saveBooks();
        } else if (e.target.classList.contains('char-enable-chk')) {
          char.enabled = e.target.checked;
          row.classList.toggle('row-disabled', !e.target.checked);
          State.saveBooks();
          this.updateBadges();
        } else if (e.target.classList.contains('sub-target')) {
          const subRow = e.target.closest('tr[data-sub-index]');
          if (subRow) {
            const subIndex = parseInt(subRow.dataset.subIndex, 10);
            const rules = this.getPronounRules(char);
            if (rules[subIndex]) {
              const cleaned = this.cleanTargetName(e.target.value);
              if (cleaned !== e.target.value) {
                e.target.value = cleaned;
                rules[subIndex].target = cleaned;
                this.syncPronounsString(char);
                State.saveBooks();
              }
            }
          }
        } else if (e.target.classList.contains('sub-self') || e.target.classList.contains('sub-others')) {
          const subRow = e.target.closest('tr[data-sub-index]');
          if (subRow) {
            const subIndex = parseInt(subRow.dataset.subIndex, 10);
            const rules = this.getPronounRules(char);
            if (rules[subIndex]) {
              const cleaned = this.cleanToTargetLanguage(e.target.value);
              if (cleaned !== e.target.value) {
                e.target.value = cleaned;
                if (e.target.classList.contains('sub-self')) rules[subIndex].self = cleaned;
                else rules[subIndex].others = cleaned;
                this.syncPronounsString(char);
                State.saveBooks();
              }
            }
          }
        }
      });

      tableBody.addEventListener('click', (e) => {
        const addRuleBtn = e.target.closest('.sub-add-btn');
        if (addRuleBtn) {
          const row = addRuleBtn.closest('tr[data-index]');
          if (!row) return;
          const index = parseInt(row.dataset.index, 10);
          const char = this.getCharacter(index);
          if (!char) return;
          const rules = this.getPronounRules(char);
          rules.push({ target: '', self: '', others: '' });
          this.syncPronounsString(char);
          State.saveBooks();
          this.render();
          return;
        }

        const delRuleBtn = e.target.closest('.sub-del-btn');
        if (delRuleBtn) {
          const row = delRuleBtn.closest('tr[data-index]');
          const subRow = delRuleBtn.closest('tr[data-sub-index]');
          if (!row || !subRow) return;
          const index = parseInt(row.dataset.index, 10);
          const subIndex = parseInt(subRow.dataset.subIndex, 10);
          const char = this.getCharacter(index);
          if (!char) return;
          const rules = this.getPronounRules(char);
          if (rules.length > 1) {
            rules.splice(subIndex, 1);
          } else {
            rules[0] = { target: '', self: '', others: '' };
          }
          this.syncPronounsString(char);
          State.saveBooks();
          this.render();
          return;
        }

        const removeBtn = e.target.closest('.remove-character-btn');
        if (!removeBtn) return;
        const row = removeBtn.closest('tr[data-index]');
        if (!row) return;
        const index = parseInt(row.dataset.index, 10);
        if (isNaN(index)) return;
        this.removeCharacter(index);
      });
    }

    this.updateProfilerModelDropdowns();
  },

  switchView(view) {
    this.currentView = view;
    try { localStorage.setItem('zumi_char_view', view); } catch (e) {}
    this.render();
  },

  getCharacterProfiles() {
    if (!State.currentBook) return [];
    if (!Array.isArray(State.currentBook.characterProfiles)) {
      State.currentBook.characterProfiles = [];
    }
    return State.currentBook.characterProfiles;
  },

  getCharacter(index) {
    const list = this.getCharacterProfiles();
    return list[index] || null;
  },

  exportJson() {
    if (!State.currentBook) {
      Utils.showToast('Vui lòng chọn một cuốn sách trước khi xuất dữ liệu', 'warning');
      return;
    }
    const profiles = this.getCharacterProfiles();
    if (!profiles || profiles.length === 0) {
      Utils.showToast('Bảng hồ sơ nhân vật hiện đang trống, không có gì để xuất', 'info');
      return;
    }

    const payload = {
      version: 1,
      type: 'zumi_character_profiles',
      bookTitle: State.currentBook.title || 'Truyện',
      exportedAt: new Date().toISOString(),
      characterProfiles: profiles
    };

    const cleanTitle = (State.currentBook.title || 'characters').replace(/[/\\?%*:|"<>]/g, '_').substring(0, 40);
    const fileName = `Zumi_Characters_${cleanTitle}_${Date.now()}.json`;

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    Utils.showToast(`Đã xuất ${profiles.length} nhân vật thành công!`, 'success');
  },

  importJson(file) {
    if (!file) return;
    if (!State.currentBook) {
      Utils.showToast('Vui lòng mở một cuốn sách trước khi nhập dữ liệu', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        let incoming = [];
        if (Array.isArray(data)) {
          incoming = data;
        } else if (data && Array.isArray(data.characterProfiles)) {
          incoming = data.characterProfiles;
        } else {
          throw new Error('Định dạng tệp JSON không hợp lệ (không tìm thấy danh sách nhân vật).');
        }

        if (incoming.length === 0) {
          Utils.showToast('Tệp không chứa nhân vật nào!', 'warning');
          return;
        }

        const currentList = this.getCharacterProfiles();
        let addedCount = 0;
        let updatedCount = 0;

        incoming.forEach(inChar => {
          if (!inChar || (!inChar.originalName && !inChar.translatedName)) return;

          const origKey = (inChar.originalName || '').toLowerCase().trim();
          const transKey = (inChar.translatedName || '').toLowerCase().trim();

          const existing = currentList.find(c => {
            const cOrig = (c.originalName || '').toLowerCase().trim();
            const cTrans = (c.translatedName || '').toLowerCase().trim();
            return (origKey && cOrig === origKey) || (transKey && cTrans === transKey);
          });

          if (existing) {
            if (inChar.relationship && !existing.relationship) existing.relationship = inChar.relationship;
            if (inChar.gender && (!existing.gender || existing.gender === 'other')) existing.gender = inChar.gender;
            if (inChar.note && !existing.note) existing.note = inChar.note;
            
            const existingRules = this.getPronounRules(existing);
            const inRules = this.getPronounRules(inChar);
            inRules.forEach(ir => {
              if (!ir || (!ir.target && !ir.self && !ir.others)) return;
              const hasRule = existingRules.some(er => er.target === ir.target && er.self === ir.self && er.others === ir.others);
              if (!hasRule) existingRules.push(ir);
            });
            this.syncPronounsString(existing);
            updatedCount++;
          } else {
            currentList.push({
              enabled: inChar.enabled !== false,
              originalName: inChar.originalName || '',
              translatedName: inChar.translatedName || '',
              gender: inChar.gender || 'other',
              relationship: inChar.relationship || '',
              pronounRules: this.getPronounRules(inChar),
              note: inChar.note || ''
            });
            addedCount++;
          }
        });

        this.sanitizeAllProfiles(State.currentBook);
        State.saveBooks();
        this.render();
        Utils.showToast(`Nhập thành công: Thêm mới ${addedCount}, cập nhật ${updatedCount} nhân vật!`, 'success');
      } catch (err) {
        console.error('Import error:', err);
        Utils.showToast('Lỗi khi đọc tệp JSON: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  },

  filterTable(query) {
    const q = (query || '').toLowerCase().trim();
    const rows = document.querySelectorAll('#characterTableBody tr[data-index]');
    const clearBtn = document.getElementById('clearCharacterSearch');
    if (clearBtn) {
      UI.toggleHidden(clearBtn, !q);
    }

    if (!q) {
      rows.forEach(r => { r.style.display = ''; });
      return;
    }

    rows.forEach(row => {
      const idx = parseInt(row.dataset.index, 10);
      const char = this.getCharacter(idx);
      if (!char) {
        row.style.display = '';
        return;
      }
      const matchOrig = (char.originalName || '').toLowerCase().includes(q);
      const matchTrans = (char.translatedName || '').toLowerCase().includes(q);
      const matchRel = (char.relationship || '').toLowerCase().includes(q);
      const matchNote = (char.note || '').toLowerCase().includes(q);
      const matchPronouns = (char.pronouns || '').toLowerCase().includes(q);
      const rules = this.getPronounRules(char);
      const matchRules = rules.some(r => 
        (r.target || '').toLowerCase().includes(q) ||
        (r.self || '').toLowerCase().includes(q) ||
        (r.others || '').toLowerCase().includes(q)
      );

      if (matchOrig || matchTrans || matchRel || matchNote || matchPronouns || matchRules) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  },

  updateBadges() {
    const list = this.getCharacterProfiles();
    const isMasterEnabled = !State.currentBook || State.currentBook.characterProfilesEnabled !== false;
    const totalCount = list.filter(c => c && (c.originalName || c.translatedName)).length;
    const activeCount = isMasterEnabled ? list.filter(c => c && (c.originalName || c.translatedName) && c.enabled !== false).length : 0;

    const countEl = document.getElementById('bookCharacterCount');
    if (countEl) countEl.textContent = isMasterEnabled ? `${activeCount}` : 'Tắt';

    const sectionCountEl = document.getElementById('sectionCharacterCount');
    if (sectionCountEl) sectionCountEl.textContent = isMasterEnabled ? `${activeCount}` : 'Tắt';

    const badgeEl = document.getElementById('characterProfileBadge');
    if (badgeEl) {
      badgeEl.textContent = isMasterEnabled ? `${activeCount}/${totalCount} bật` : 'Đang tắt';
    }
    if (window.TranslationWorkflow) TranslationWorkflow.update();
  },

  render() {
    if (State.currentBook) {
      this.sanitizeAllProfiles(State.currentBook);
    }
    const list = this.getCharacterProfiles();
    const tableBody = document.getElementById('characterTableBody');
    const tableWrap = document.getElementById('characterProfileTableWrap');
    const emptyEl = document.getElementById('characterProfileEmpty');
    const masterToggle = document.getElementById('toggleCharacterProfileActive');
    const toggleAll = document.getElementById('toggleAllCharacterRows');
    const scanProviderSelect = document.getElementById('characterScanProviderSelect');

    if (scanProviderSelect) {
      scanProviderSelect.value = State.settings.profilerProvider || 'auto';
    }

    if (masterToggle && State.currentBook) {
      masterToggle.checked = State.currentBook.characterProfilesEnabled !== false;
    }

    this.updateBadges();

    if (list.length === 0) {
      if (emptyEl) emptyEl.classList.remove('hidden');
      if (tableWrap) tableWrap.classList.add('hidden');
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');
    if (tableWrap) tableWrap.classList.remove('hidden');

    const allChecked = list.length > 0 && list.every(c => c.enabled !== false);
    if (toggleAll) toggleAll.checked = allChecked;

    if (tableBody) {
      tableBody.innerHTML = '';
      list.forEach((p, index) => {
        const isEnabled = p.enabled !== false;
        const originalName = p.originalName || p.speaker || '';
        const translatedName = p.translatedName || p.listener || '';
        const rules = this.getPronounRules(p);

        const row = document.createElement('tr');
        row.dataset.index = index;
        if (!isEnabled) row.className = 'row-disabled';

        const partnerOptions = list
          .filter((_, idx) => idx !== index)
          .map(other => {
            const canon = this.getCharacterCanonicalName(other);
            return canon ? `<option value="${Utils.escapeHtml(canon)}">${Utils.escapeHtml(canon)}</option>` : '';
          }).filter(Boolean);

        const commonOptions = [
          '<option value="Mọi người (Chung)">Mọi người (Chung)</option>',
          '<option value="Người lạ / Khách qua đường">Người lạ / Khách qua đường</option>',
          '<option value="Kẻ địch / Đối thủ">Kẻ địch / Đối thủ</option>'
        ];

        const datalistId = `partnerDatalist_${index}`;
        const datalistHtml = `<datalist id="${datalistId}">${partnerOptions.join('')}${commonOptions.join('')}</datalist>`;

        const subRowsHtml = rules.map((r, rIdx) => `
          <tr data-sub-index="${rIdx}">
            <td style="width: 31%;">
              <input type="text" list="${datalistId}" class="sub-input sub-target" value="${Utils.escapeHtml(r.target || '')}" placeholder="Chọn nhân vật hoặc nhập...">
            </td>
            <td style="width: 31%;">
              <input type="text" class="sub-input sub-self" value="${Utils.escapeHtml(r.self || '')}" placeholder="VD: tôi / đệ">
            </td>
            <td style="width: 32%;">
              <input type="text" class="sub-input sub-others" value="${Utils.escapeHtml(r.others || '')}" placeholder="VD: y sư / huynh">
            </td>
            <td style="width: 6%; text-align: center;">
              <button type="button" class="sub-del-btn" title="Xóa dòng xưng hô này">✕</button>
            </td>
          </tr>
        `).join('');

        row.innerHTML = `
          <td style="text-align: center; vertical-align: top; padding-top: 10px;">
            <input type="checkbox" class="char-enable-chk" ${isEnabled ? 'checked' : ''} title="Bật/Tắt áp dụng nhân vật này">
          </td>
          <td>
            <input type="text" class="char-input char-original" value="${Utils.escapeHtml(originalName)}" placeholder="Tên gốc (VD: Seol Yuwol)">
          </td>
          <td>
            <input type="text" class="char-input char-translated" value="${Utils.escapeHtml(translatedName)}" placeholder="Tên dịch (VD: Tiết Du Nguyệt)">
          </td>
          <td>
            <select class="char-select char-gender">
              <option value="Nam" ${p.gender === 'Nam' || p.gender === 'male' ? 'selected' : ''}>Nam</option>
              <option value="Nữ" ${p.gender === 'Nữ' || p.gender === 'female' ? 'selected' : ''}>Nữ</option>
              <option value="Phi giới tính" ${p.gender === 'Phi giới tính' ? 'selected' : ''}>Phi giới tính</option>
              <option value="Khác" ${p.gender === 'Khác' || p.gender === 'other' || p.gender === 'Phi giới tính / Khác' || (!p.gender && p.gender !== 'Nam' && p.gender !== 'Nữ' && p.gender !== 'Phi giới tính') ? 'selected' : ''}>Khác</option>
            </select>
          </td>
          <td>
            <textarea class="char-input char-relationship" rows="2" placeholder="Mqh & Vai trò (VD:\n- Nhân vật chính\n- Bạn bè)">${Utils.escapeHtml(p.relationship || '')}</textarea>
          </td>
          <td>
            <div class="pronoun-subtable-wrap">
              ${datalistHtml}
              <table class="pronoun-subtable">
                <thead>
                  <tr>
                    <th>Với ai</th>
                    <th>Tự xưng</th>
                    <th>Gọi đối phương</th>
                    <th style="text-align: center;">✕</th>
                  </tr>
                </thead>
                <tbody class="pronoun-subtable-body">
                  ${subRowsHtml}
                </tbody>
              </table>
              <button type="button" class="sub-add-btn">+ Thêm xưng hô</button>
            </div>
          </td>
          <td>
            <textarea class="char-input char-notes" rows="2" placeholder="Ghi chú khi dịch...">${Utils.escapeHtml(p.note || '')}</textarea>
          </td>
          <td style="text-align: center; vertical-align: top; padding-top: 8px;">
            <button type="button" class="remove-character-btn" title="Xóa nhân vật này">✕</button>
          </td>
        `;
        tableBody.appendChild(row);
      });
    }
  },

  toggleDrawer(force) {
    const drawer = document.getElementById('characterProfileDrawer');
    if (!drawer) return;
    const isHidden = drawer.classList.contains('hidden');
    const shouldOpen = force !== undefined ? force : isHidden;

    if (shouldOpen) {
      drawer.classList.remove('hidden');
      this.render();
      if (window.BookGlossary) BookGlossary.close();
    } else {
      drawer.classList.add('hidden');
    }
  },

  close() {
    const drawer = document.getElementById('characterProfileDrawer');
    if (drawer) drawer.classList.add('hidden');
  },

  addCharacter(data = {}) {
    const book = State.currentBook;
    if (!book) {
      Utils.showToast('Chưa mở truyện nào!', 'warning');
      return;
    }
    if (!Array.isArray(book.characterProfiles)) book.characterProfiles = [];

    const originalName = data.originalName || data.speaker || '';
    const translatedName = data.translatedName || data.listener || '';
    const pronounRules = (Array.isArray(data.pronounRules) && data.pronounRules.length > 0)
      ? data.pronounRules
      : [{ target: '', self: 'tôi', others: '' }];

    const newChar = {
      id: Date.now().toString(),
      originalName: originalName,
      translatedName: translatedName,
      speaker: originalName,
      listener: translatedName,
      gender: data.gender || 'Nam',
      pronounRules: pronounRules,
      relationship: data.relationship || '',
      note: data.note || '',
      lastUpdatedChapter: data.lastUpdatedChapter || '1'
    };
    this.syncPronounsString(newChar);

    book.characterProfiles.unshift(newChar);
    State.saveBooks();

    this.toggleDrawer(true);
    this.render();

    setTimeout(() => {
      const firstInput = document.querySelector('#characterTableBody .char-original');
      if (firstInput) firstInput.focus();
    }, 50);
  },

  removeCharacter(index) {
    const book = State.currentBook;
    if (!book || !Array.isArray(book.characterProfiles)) return;
    book.characterProfiles.splice(index, 1);
    State.saveBooks();
    this.render();
  },

  clearAll() {
    const book = State.currentBook;
    if (!book || !Array.isArray(book.characterProfiles) || book.characterProfiles.length === 0) return;

    if (confirm('Xóa toàn bộ hồ sơ nhân vật trong bảng?')) {
      book.characterProfiles = [];
      State.saveBooks();
      this.render();
      Utils.showToast('Đã làm trống Bảng hồ sơ nhân vật.', 'info');
    }
  }
};

if (typeof window !== 'undefined') {
  window.CharacterProfile = CharacterProfile;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CharacterProfile;
}
