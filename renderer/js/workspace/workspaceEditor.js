/**
 * ZumiTranslator - Workspace Editor Service
 * Quản lý khung đọc, biên tập nội dung chương, dịch tiêu đề, tách/gộp chương và xử lý bản dịch theo SRP.
 */

const WorkspaceEditor = {
  toggleEditMode(editing) {
    const ws = window.ChapterWorkspace || {};
    ws.isEditing = editing;
    const bodyEl = UI.$('#epubViewerBody');
    const editorEl = UI.$('#epubViewerEditor');
    const editBtn = UI.$('#epubEditContentBtn');
    const saveBtn = UI.$('#epubSaveContentBtn');
    const cancelBtn = UI.$('#epubCancelEditBtn');

    if (!bodyEl || !editorEl) return;

    if (editing) {
      const ch = State.chapters.find(c => c.id === ws.activeChapterId);
      if (!ch) return;
      const fc = State.finishedChapters.find(f => f.sourceChapterId === ch.id);
      const isFinished = !!fc;
      const content = (ws.activeMode === 'translated' && isFinished) ? (fc.content || '') : (ch.content || '');

      editorEl.value = content;
      UI.toggleHidden(bodyEl, true);
      UI.toggleHidden(editorEl, false);
      UI.toggleHidden(editBtn, true);
      UI.toggleHidden(saveBtn, false);
      UI.toggleHidden(cancelBtn, false);
      editorEl.focus();
    } else {
      UI.toggleHidden(bodyEl, false);
      UI.toggleHidden(editorEl, true);
      UI.toggleHidden(editBtn, false);
      UI.toggleHidden(saveBtn, true);
      UI.toggleHidden(cancelBtn, true);
    }
  },

  saveEditedContent() {
    const ws = window.ChapterWorkspace || {};
    const editorEl = UI.$('#epubViewerEditor');
    if (!editorEl) return;
    const newContent = editorEl.value;

    const ch = State.chapters.find(c => c.id === ws.activeChapterId);
    if (!ch) return;

    const fc = State.finishedChapters.find(f => f.sourceChapterId === ch.id);
    const isFinished = !!fc;

    if (ws.activeMode === 'translated' && isFinished) {
      fc.content = newContent;
      State.translatedContent = State.finishedChapters.map(f => f.content).join('\n\n---CHAPTER_BREAK---\n\n');
    } else {
      ch.content = newContent;
      ch.charCount = newContent.length;
      ch.wordCount = Utils.countWords(newContent);
    }

    if (typeof window.saveChapters === 'function') {
      window.saveChapters();
    } else if (State.currentBook) {
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

    this.toggleEditMode(false);
    if (ws.render) ws.render();
    Utils.showToast('Đã lưu nội dung chương thành công!', 'success');
  },

  renameActiveChapter() {
    const ws = window.ChapterWorkspace || {};
    const ch = State.chapters.find(c => c.id === ws.activeChapterId);
    if (!ch) return;

    const fc = State.finishedChapters.find(f => f.sourceChapterId === ch.id);
    const currentTitle = (ws.activeMode === 'translated' && fc) ? (fc.title || ch.title) : ch.title;

    const newTitle = prompt('Nhập tên chương mới:', currentTitle);
    if (newTitle === null || !newTitle.trim()) return;

    const trimmed = newTitle.trim();
    ch.title = trimmed;
    ch.originalTitle = trimmed;
    if (fc) {
      fc.title = trimmed;
    }

    if (typeof window.saveChapters === 'function') {
      window.saveChapters();
    } else if (State.currentBook) {
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

    if (ws.render) ws.render();
    Utils.showToast('Đã đổi tên chương!', 'success');
  },

  getRawSourceTitle(ch) {
    if (!ch) return '';
    let title = ch.originalTitle || ch.title || '';
    if (/^(?:Chào bạn|Tôi thấy|Tôi nhận thấy|Dưới đây là)/i.test(title)) {
      const quoted = title.match(/["“]([^\n"”]{2,80})["”]/);
      if (quoted) {
        return quoted[1].trim();
      }
      const paren = title.match(/\(((?:Chương|Hồi|Tiết|Phần|Chapter)\s*\d+[^)]*)\)/i);
      if (paren) {
        return paren[1].trim();
      }
    }
    return title.trim();
  },

  async translateActiveTitle() {
    const ws = window.ChapterWorkspace || {};
    const ch = State.chapters && State.chapters.find(c => c.id === ws.activeChapterId);
    if (!ch) {
      Utils.showToast('Vui lòng chọn một chương để dịch tiêu đề!', 'warning');
      return;
    }

    const rawSource = this.getRawSourceTitle(ch);
    if (!rawSource) {
      Utils.showToast('Chương này không có tiêu đề để dịch!', 'warning');
      return;
    }

    const s = State.settings || {};
    const mode = s.titleTranslationMode || 'ai';
    const modeName = mode === 'google' ? 'Google Translate' : 'AI';

    const btn = UI.$('#epubTranslateTitleBtn');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="ai-loading-spinner" style="width: 11px; height: 11px; display: inline-block; vertical-align: middle; margin-right: 4px;"></span> Đang dịch...';
    }

    try {
      if (!window.Translation || typeof window.Translation.translateTitle !== 'function') {
        throw new Error('Module Translation chưa sẵn sàng');
      }

      const translated = await Translation.translateTitle(rawSource);
      if (translated) {
        if (!ch.originalTitle) {
          ch.originalTitle = rawSource;
        }
        ch.title = translated;

        const fc = State.finishedChapters.find(f => f.sourceChapterId === ch.id || f.id === ch.id);
        if (fc) {
          fc.title = translated;
        }

        const titleEl = UI.$('#epubViewerTitle');
        if (titleEl) titleEl.textContent = translated;

        if (typeof window.saveChapters === 'function') {
          window.saveChapters();
        } else if (State.currentBook) {
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

        if (ws.render) ws.render();
        if (window.Bookshelf) Bookshelf.renderChapterList();
        Utils.showToast(`Đã dịch tiêu đề: "${translated}" (${modeName})`, 'success');
      } else {
        Utils.showToast('Không thể dịch tiêu đề!', 'warning');
      }
    } catch (err) {
      Utils.showToast(`Lỗi dịch tiêu đề: ${err.message}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  },

  async bulkTranslateTitles() {
    const ws = window.ChapterWorkspace || {};
    if (!State.chapters || State.chapters.length === 0) {
      Utils.showToast('Không có chương nào để dịch tiêu đề!', 'warning');
      return;
    }

    if (State.isTranslating) {
      Utils.showToast('Hệ thống đang dịch truyện, vui lòng chờ hoàn tất hoặc hủy trước!', 'warning');
      return;
    }

    let targetChapters = State.chapters.filter(ch => ch.selected);

    const s = State.settings || {};
    const mode = s.titleTranslationMode || 'ai';
    const modeName = mode === 'google' ? 'Google Translate' : 'AI';

    if (targetChapters.length === 0) {
      const confirmAll = confirm(`Bạn chưa chọn chương nào.\nBạn có muốn dịch tiêu đề cho TOÀN BỘ ${State.chapters.length} chương trong truyện bằng ${modeName} không?`);
      if (!confirmAll) return;
      targetChapters = [...State.chapters];
    } else {
      const confirmSelected = confirm(`Dịch tiêu đề cho ${targetChapters.length} chương đã chọn bằng ${modeName}?`);
      if (!confirmSelected) return;
    }

    const btn = UI.$('#bulkTranslateTitlesBtn');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="ai-loading-spinner" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 4px;"></span> Đang dịch (0/${targetChapters.length})...`;
    }

    const progressSection = UI.$('#progressSection');
    const progressLabel = UI.$('#progressLabel');
    const progressBar = UI.$('#progressBar');
    const progressPercent = UI.$('#progressPercent');
    if (progressSection) UI.toggleHidden(progressSection, false);

    let count = 0;

    try {
      for (let i = 0; i < targetChapters.length; i++) {
        if (State.cancelRequested) break;
        const ch = targetChapters[i];
        const rawSource = this.getRawSourceTitle(ch);

        const percent = Math.round(((i + 1) / targetChapters.length) * 100);
        if (btn) btn.innerHTML = `<span class="ai-loading-spinner" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 4px;"></span> Đang dịch (${i + 1}/${targetChapters.length})...`;
        if (progressLabel) progressLabel.textContent = `Đang dịch tiêu đề (${i + 1}/${targetChapters.length}): ${rawSource.substring(0, 30)}...`;
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressPercent) progressPercent.textContent = `${percent}%`;

        if (/^\s*\d+\s*$/.test(rawSource)) {
          ch.title = rawSource.trim();
          count++;
          continue;
        }

        try {
          const translated = await Translation.translateTitle(rawSource);
          if (translated) {
            if (!ch.originalTitle) {
              ch.originalTitle = rawSource;
            }
            ch.title = translated;

            const fc = State.finishedChapters.find(f => f.sourceChapterId === ch.id || f.id === ch.id);
            if (fc) {
              fc.title = translated;
            }
            count++;
          }
        } catch (err) {
          console.warn(`Lỗi dịch tiêu đề chương ${ch.id}:`, err);
        }

        if (mode !== 'google' && i < targetChapters.length - 1) {
          await new Promise(r => setTimeout(r, 350));
        } else if (mode === 'google' && i < targetChapters.length - 1) {
          await new Promise(r => setTimeout(r, 80));
        }

        if (i % 5 === 0 || i === targetChapters.length - 1) {
          if (ws.renderListOnly) ws.renderListOnly();
        }
      }

      if (typeof window.saveChapters === 'function') {
        window.saveChapters();
      } else if (State.currentBook) {
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

      Utils.showToast(`Đã dịch xong ${count} tiêu đề chương bằng ${modeName}!`, 'success');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
      if (progressSection) UI.toggleHidden(progressSection, true);
      if (ws.render) ws.render();
      if (window.Bookshelf) Bookshelf.renderChapterList();
    }
  },

  splitActiveChapter() {
    const ws = window.ChapterWorkspace || {};
    const ch = State.chapters.find(c => c.id === ws.activeChapterId);
    if (!ch) return;

    const content = ch.content || '';
    if (!content.trim()) {
      Utils.showToast('Chương không có nội dung để tách!', 'warning');
      return;
    }

    const marker = prompt(
      'Tách chương:\n- Nhập đoạn chữ hoặc ký hiệu để tách tại vị trí đó\n- HOẶC để trống để tự động chia đôi số dòng:',
      ''
    );
    if (marker === null) return;

    let part1 = '', part2 = '';
    if (marker.trim() !== '') {
      const idx = content.indexOf(marker.trim());
      if (idx === -1) {
        Utils.showToast('Không tìm thấy đoạn chữ cần tách trong chương!', 'error');
        return;
      }
      part1 = content.slice(0, idx).trim();
      part2 = content.slice(idx).trim();
    } else {
      const lines = content.split('\n');
      const mid = Math.floor(lines.length / 2);
      part1 = lines.slice(0, mid).join('\n').trim();
      part2 = lines.slice(mid).join('\n').trim();
    }

    if (!part1 || !part2) {
      Utils.showToast('Không thể chia chương thành 2 phần hợp lệ!', 'warning');
      return;
    }

    const currentIndex = State.chapters.findIndex(c => c.id === ch.id);
    ch.content = part1;
    ch.charCount = part1.length;
    ch.wordCount = Utils.countWords(part1);
    ch.title = `${ch.title} (Phần 1)`;
    ch.originalTitle = ch.title;

    const newId = Date.now();
    const newChapter = {
      id: newId,
      title: `${ch.title.replace(' (Phần 1)', '')} (Phần 2)`,
      originalTitle: `${ch.title.replace(' (Phần 1)', '')} (Phần 2)`,
      content: part2,
      charCount: part2.length,
      wordCount: Utils.countWords(part2),
      selected: ch.selected,
      shouldNumber: ch.shouldNumber,
      num: ch.num !== null ? ch.num + 0.5 : null
    };

    State.chapters.splice(currentIndex + 1, 0, newChapter);

    State.chapters.forEach((c, idx) => {
      c.id = idx;
    });
    ws.activeChapterId = ch.id;

    if (typeof window.saveChapters === 'function') {
      window.saveChapters();
    } else if (State.currentBook) {
      State.currentBook.chapters = State.chapters.map(c => ({
        id: c.id,
        title: c.title,
        content: c.content,
        charCount: c.content ? c.content.length : 0,
        wordCount: c.content ? Utils.countWords(c.content) : 0,
        selected: c.selected,
        shouldNumber: c.shouldNumber
      }));
      State.currentBook.totalChunks = State.chapters.length;
      State.saveBooks();
    }

    if (ws.render) ws.render();
    Utils.showToast('Đã tách chương thành 2 phần thành công!', 'success');
  },

  mergeSelectedChapters() {
    const ws = window.ChapterWorkspace || {};
    const selected = State.chapters.filter(c => c.selected);
    if (selected.length < 2) {
      Utils.showToast('Vui lòng tích chọn ít nhất 2 chương để gộp!', 'warning');
      return;
    }

    const defaultTitle = selected[0].title + ' (Gộp)';
    const newTitle = prompt(`Gộp ${selected.length} chương đã chọn thành 1 chương.\nNhập tên chương gộp:`, defaultTitle);
    if (newTitle === null || !newTitle.trim()) return;

    const mergedContent = selected.map(c => c.content).join('\n\n');
    const firstSelectedId = selected[0].id;
    const firstIndex = State.chapters.findIndex(c => c.id === firstSelectedId);

    State.chapters[firstIndex].title = newTitle.trim();
    State.chapters[firstIndex].originalTitle = newTitle.trim();
    State.chapters[firstIndex].content = mergedContent;
    State.chapters[firstIndex].charCount = mergedContent.length;
    State.chapters[firstIndex].wordCount = Utils.countWords(mergedContent);

    const toRemoveIds = new Set(selected.slice(1).map(c => c.id));
    State.chapters = State.chapters.filter(c => !toRemoveIds.has(c.id));
    State.finishedChapters = State.finishedChapters.filter(f => !toRemoveIds.has(f.sourceChapterId));

    State.chapters.forEach((c, idx) => {
      c.id = idx;
    });

    ws.activeChapterId = State.chapters[firstIndex] ? State.chapters[firstIndex].id : State.chapters[0].id;

    if (typeof window.saveChapters === 'function') {
      window.saveChapters();
    } else if (State.currentBook) {
      State.currentBook.chapters = State.chapters.map(c => ({
        id: c.id,
        title: c.title,
        content: c.content,
        charCount: c.content ? c.content.length : 0,
        wordCount: c.content ? Utils.countWords(c.content) : 0,
        selected: c.selected,
        shouldNumber: c.shouldNumber
      }));
      State.currentBook.totalChunks = State.chapters.length;
      State.saveBooks();
    }

    if (ws.render) ws.render();
    Utils.showToast(`Đã gộp ${selected.length} chương thành công!`, 'success');
  },

  deduplicateLeadingTitles(text, title = '') {
    if (!text) return '';
    const paras = text.split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);
    if (paras.length <= 1) return text;

    const norm = s => s.toLowerCase().replace(/\s+/g, ' ');
    const normTitle = norm(title || '');

    const result = [];
    for (let i = 0; i < paras.length; i++) {
      const p = paras[i];
      const pNorm = norm(p);
      if (result.length > 0 && result.length <= 3) {
        const prevNorm = norm(result[result.length - 1]);
        if (pNorm === prevNorm || (normTitle && pNorm === normTitle && prevNorm === normTitle)) {
          continue;
        }
      }
      result.push(p);
    }
    return result.join('\n\n');
  },

  formatContentHtml(content, highlightForeign = false, chapterTitle = '') {
    if (!content) return '';

    const cleanContent = this.deduplicateLeadingTitles(content, chapterTitle);

    let safeHtml = cleanContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    if (highlightForeign && window.ForeignDetector) {
      safeHtml = ForeignDetector.highlightHtml(safeHtml);
    }

    safeHtml = safeHtml.replace(/\[IMG:(.*?)\]/g, (match, rawUrl) => {
      const cleanUrl = rawUrl.replace(/&amp;/g, '&');
      return `<div class="reader-image-wrap"><img src="${cleanUrl}" alt="Hình minh họa" class="reader-image" loading="lazy" onerror="this.parentElement.style.display='none'" /></div>`;
    });

    return safeHtml;
  },

  renderActiveContent() {
    const ws = window.ChapterWorkspace || {};
    const emptyView = UI.$('#epubContentEmpty');
    const viewer = UI.$('#epubContentViewer');
    if (!emptyView || !viewer) return;

    const ch = State.chapters && State.chapters.find(c => c.id === ws.activeChapterId);
    if (!ch) {
      emptyView.classList.remove('hidden');
      viewer.classList.add('hidden');
      return;
    }

    emptyView.classList.add('hidden');
    viewer.classList.remove('hidden');
    const fc = State.finishedChapters && State.finishedChapters.find(f => f.sourceChapterId === ch.id);
    const hasLiveProgress = !fc && !!ch._liveTranslatedContent;
    const hasTranslatedSession = !!fc || hasLiveProgress;
    const isFinished = (window.WorkspaceSidebar || WorkspaceSidebar).isChapterDone(ch);

    const titleEl = UI.$('#epubViewerTitle');
    const statusBadge = UI.$('#epubViewerStatusBadge');
    const charCountEl = UI.$('#epubViewerCharCount');
    const warningBadge = UI.$('#epubViewerWarningBadge');
    const autoFixBtn = UI.$('#epubAutoFixBtn');

    const showTranslatedBtn = UI.$('#epubShowTranslatedBtn');
    const showSourceBtn = UI.$('#epubShowSourceBtn');

    if (hasTranslatedSession) {
      if (showTranslatedBtn) {
        showTranslatedBtn.classList.remove('hidden');
        showTranslatedBtn.classList.toggle('active', ws.activeMode === 'translated');
      }
      if (showSourceBtn) {
        showSourceBtn.classList.toggle('active', ws.activeMode === 'source');
      }
    } else {
      ws.activeMode = 'source';
      if (showTranslatedBtn) {
        showTranslatedBtn.classList.add('hidden');
      }
      if (showSourceBtn) {
        showSourceBtn.classList.add('active');
      }
    }

    const retranslateBtn = UI.$('#epubRetranslateChapterBtn');
    const clearChapterBtn = UI.$('#epubClearChapterTranslationBtn');
    if (clearChapterBtn) {
      UI.toggleHidden(clearChapterBtn, !hasTranslatedSession && !isFinished);
    }
    if (retranslateBtn) {
      if (hasTranslatedSession || isFinished) {
        retranslateBtn.textContent = 'Dịch lại chương';
        retranslateBtn.title = 'Xóa bản dịch cũ và dịch lại riêng chương này bằng AI';
      } else {
        retranslateBtn.textContent = 'Dịch chương này';
        retranslateBtn.title = 'Chỉ dịch riêng chương này bằng AI';
      }
    }

    let displayTitle = ch.title;
    let displayContent = ch.content;
    let foreignInfo = null;

    if (ws.activeMode === 'translated' && hasTranslatedSession) {
      displayTitle = fc ? (fc.title || ch.title) : (ch._liveDisplayTitle || ch.title);
      displayContent = fc ? (fc.content || '') : (ch._liveTranslatedContent || '');
      if (window.ForeignDetector && fc) {
        foreignInfo = ForeignDetector.detect(displayContent);
      }
    }

    if (displayTitle === 'Bìa & Minh họa') {
      displayTitle = 'Cover';
      ch.title = 'Cover';
      if (ch.originalTitle === 'Bìa & Minh họa') ch.originalTitle = 'Cover';
    }

    if (titleEl) titleEl.textContent = displayTitle;
    if (charCountEl) charCountEl.textContent = Utils.formatWordCount(Utils.countWords(displayContent));

    const chLangBar = UI.$('#epubViewerLanguageBar');
    if (chLangBar) chLangBar.innerHTML = '';
    if (statusBadge) {
      if (window.ProgressDetector && typeof window.ProgressDetector.getLanguageBreakdown === 'function') {
        const targetLang = (State.settings && State.settings.targetLang) || 'vi';
        const bd = ProgressDetector.getLanguageBreakdown(displayContent, targetLang);
        statusBadge.innerHTML = bd.badgeHtml;
        statusBadge.className = 'format-badge-transparent';
      } else {
        statusBadge.innerHTML = isFinished ? '<span class="lang-ratio-badge done">vi 100%</span>' : '';
        statusBadge.className = 'format-badge-transparent';
      }
    }

    if (foreignInfo && foreignInfo.hasForeign) {
      if (warningBadge) {
        warningBadge.textContent = `⚠️ Sót ${foreignInfo.totalCount} chữ (${foreignInfo.samples.slice(0, 5).join(' ')})`;
        warningBadge.classList.remove('hidden');
      }
      if (autoFixBtn) autoFixBtn.classList.remove('hidden');
    } else {
      if (warningBadge) warningBadge.classList.add('hidden');
      if (autoFixBtn) autoFixBtn.classList.add('hidden');
    }

    // Toggle R18 badge in viewer header
    const r18BadgeEl = UI.$('#epubViewerR18Badge');
    if (r18BadgeEl) {
      if (ch) {
        let isR18 = false;
        if (window.R18Detector) {
          const sourceLang = (State.settings && State.settings.sourceLang) || 'auto';
          isR18 = R18Detector.isChapterR18(ch, { title: ch.title, content: displayContent }, sourceLang);
        }
        UI.toggleHidden(r18BadgeEl, !isR18);
      } else {
        UI.toggleHidden(r18BadgeEl, true);
      }
    }

    // Toggle Image badge in viewer header
    const imgBadgeEl = UI.$('#epubViewerImageBadge');
    if (imgBadgeEl) {
      if (ch) {
        const count = (window.Utils && typeof Utils.countImages === 'function')
          ? (Utils.countImages(displayContent) || Utils.countImages(ch.content) || 0)
          : 0;
        if (count > 0) {
          const countSpan = UI.$('#epubViewerImageCount');
          if (countSpan) countSpan.textContent = count > 1 ? count : '';
          imgBadgeEl.title = count > 1 ? `Chương có ${count} hình ảnh minh họa` : 'Chương có hình ảnh minh họa';
          UI.toggleHidden(imgBadgeEl, false);
        } else {
          UI.toggleHidden(imgBadgeEl, true);
        }
      } else {
        UI.toggleHidden(imgBadgeEl, true);
      }
    }

    const bodyEl = UI.$('#epubViewerBody');
    if (bodyEl) {
      const needHighlight = ws.activeMode === 'translated' && foreignInfo && foreignInfo.hasForeign;
      bodyEl.innerHTML = this.formatContentHtml(displayContent, needHighlight, ch ? ch.title : '');
      bodyEl.scrollTop = 0;
    }
  },

  clearActiveChapterTranslation() {
    const ws = window.ChapterWorkspace || {};
    if (State.isTranslating) {
      Utils.showToast('Đang có tiến trình dịch đang chạy, vui lòng Hủy trước.', 'warning');
      return;
    }
    const ch = State.chapters && State.chapters.find(c => c.id === ws.activeChapterId);
    if (!ch) return;

    const fc = State.finishedChapters && State.finishedChapters.find(f => f.sourceChapterId === ch.id || f.id === ch.id);
    if (!fc && !ch._liveTranslatedContent) {
      Utils.showToast('Chương này chưa có bản dịch để xóa!', 'info');
      return;
    }

    const chapterName = (fc && fc.title) || ch.title || `Chương ${ch.id + 1}`;
    if (!confirm(`Bạn có chắc muốn XÓA BẢN DỊCH của "${chapterName}"?`)) {
      return;
    }

    State.finishedChapters = State.finishedChapters.filter(f => f.sourceChapterId !== ch.id && f.id !== ch.id);
    if (State.currentBook && State.currentBook.finishedChapters) {
      State.currentBook.finishedChapters = State.currentBook.finishedChapters.filter(f => f.sourceChapterId !== ch.id && f.id !== ch.id);
    }

    if (ch.originalTitle) {
      ch.title = ch.originalTitle;
    }
    delete ch._liveTranslatedContent;
    delete ch._liveDisplayTitle;
    delete ch._liveChunkIndex;
    delete ch._liveTotalChunks;
    delete ch._langEvaluation;

    ch.selected = true;

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

    ws.activeMode = 'source';
    if (ws.isEditing) this.toggleEditMode(false);
    if (ws.render) ws.render();
    if (window.Bookshelf) Bookshelf.renderChapterList();
    if (window.TranslationWorkflow) TranslationWorkflow.update();

    Utils.showToast(`Đã xóa bản dịch của "${chapterName}"!`, 'success');
  },

  resetAllTranslations() {
    const ws = window.ChapterWorkspace || {};
    if (State.isTranslating) {
      Utils.showToast('Đang có tiến trình dịch đang chạy, vui lòng Hủy trước.', 'warning');
      return;
    }
    if (!State.chapters || State.chapters.length === 0) {
      Utils.showToast('Không có chương nào để đặt lại!', 'info');
      return;
    }
    const finishedCount = (State.finishedChapters && State.finishedChapters.length) || 0;
    if (finishedCount === 0) {
      Utils.showToast('Truyện chưa có chương dịch nào được lưu!', 'info');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn XÓA TOÀN BỘ ${finishedCount} chương đã dịch để dịch lại từ đầu?\n\nTiến trình dịch sẽ được đưa về 0% và tất cả chương sẽ được chọn sẵn để bạn có thể bấm "Bắt đầu dịch".`)) {
      return;
    }

    State.finishedChapters = [];
    if (State.currentBook) {
      State.currentBook.finishedChapters = [];
      State.currentBook.translatedContent = '';
      State.currentBook.processedChunks = 0;
      State.currentBook.progressPercent = 0;
      State.currentBook.lastTranslated = null;
    }
    State.translatedContent = '';

    State.chapters.forEach(ch => {
      if (ch.originalTitle) {
        ch.title = ch.originalTitle;
      }
      ch.selected = true;
      delete ch._liveTranslatedContent;
      delete ch._liveDisplayTitle;
      delete ch._liveChunkIndex;
      delete ch._liveTotalChunks;
      delete ch._langEvaluation;
    });

    if (typeof window.saveChapters === 'function') {
      window.saveChapters();
    } else if (State.currentBook) {
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

    State.saveTranslationProgress(0, State.chapters.length);

    ws.activeMode = 'source';
    if (ws.isEditing) this.toggleEditMode(false);
    if (ws.render) ws.render();
    if (window.Bookshelf) Bookshelf.renderChapterList();
    if (window.Translation && typeof window.Translation.resetFileUI === 'function') {
      Translation.resetFileUI();
    }
    if (window.TranslationWorkflow) TranslationWorkflow.update();

    Utils.showToast('Đã xóa toàn bộ bản dịch! Bạn có thể bấm "Bắt đầu dịch" để dịch lại từ đầu.', 'success');
  }
};

if (typeof window !== 'undefined') {
  window.WorkspaceEditor = WorkspaceEditor;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WorkspaceEditor;
}
