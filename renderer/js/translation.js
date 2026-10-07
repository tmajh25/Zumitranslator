/**
 * TRANSLATION MODULE
 * Core logic for text and file translation
 */

const Translation = {
  // --- FACADE DELEGATION: NGỮ CẢNH & LỌC DỮ LIỆU (TranslationContext) ---
  textContainsTerm(...args) { return (window.TranslationContext || TranslationContext).textContainsTerm(...args); },
  isMainCharacter(...args) { return (window.TranslationContext || TranslationContext).isMainCharacter(...args); },
  filterRelevantCharacterProfiles(...args) { return (window.TranslationContext || TranslationContext).filterRelevantCharacterProfiles(...args); },
  filterRelevantGlossary(...args) { return (window.TranslationContext || TranslationContext).filterRelevantGlossary(...args); },
  getActiveCharacterProfiles(...args) { return (window.TranslationContext || TranslationContext).getActiveCharacterProfiles(...args); },
  getActiveGlossary(...args) { return (window.TranslationContext || TranslationContext).getActiveGlossary(...args); },
  getContext(...args) { return (window.TranslationContext || TranslationContext).getContext(...args); },
  cleanTranslatedTitle(...args) { return (window.TranslationContext || TranslationContext).cleanTranslatedTitle(...args); },


  async translateTitle(title) {
    if (!title) return '';
    let cleanTitle = title.split('\n')[0].trim();
    if (cleanTitle.length > 120) {
      cleanTitle = cleanTitle.substring(0, 120).trim();
    }

    const s = State.settings || {};
    const mode = s.titleTranslationMode || 'ai';

    // 1. Chế độ Google Translate: Nhanh, chuẩn xác, hoàn toàn miễn phí, không bao giờ có AI chào hỏi
    if (mode === 'google') {
      try {
        const res = await window.electronAPI.translateText({
          text: cleanTitle,
          sourceLang: s.sourceLang || 'auto',
          targetLang: s.targetLang || 'vi',
          apiProvider: 'google-free'
        });
        if (res) {
          return this.cleanTranslatedTitle(res, cleanTitle);
        }
      } catch (err) {
        console.warn('[translateTitle] Google Translate lỗi, fallback sang AI:', err.message);
        // Fallback sang AI bên dưới nếu Google Translate gặp sự cố mạng
      }
    }

    // 2. Chế độ AI (hoặc fallback từ Google Translate):
    // QUAN TRỌNG: Tuyệt đối không gửi `characterProfiles` (hồ sơ nhân vật) hay prompt dịch truyện dài vào đây!
    // Vì nếu gửi hồ sơ nhân vật vào đoạn văn chỉ có 1 câu tiêu đề, AI (Gemini) sẽ tưởng người dùng đang trò chuyện
    // và sẽ tự động phản hồi chào hỏi ("Chào bạn, mình thấy bạn đã gửi tiêu đề chương...").
    try {
      const titlePrompt = 'Bạn là dịch giả tiểu thuyết. Hãy dịch DUY NHẤT tiêu đề chương này sang tiếng Việt. CHỈ XUẤT RA DUY NHẤT TIÊU ĐỀ ĐÃ DỊCH, tuyệt đối không chào hỏi, không giải thích, không thêm bất kỳ từ ngữ nào khác.';

      const res = await this.executeTranslationWithFallback({
        text: cleanTitle,
        sourceLang: s.sourceLang || 'auto',
        targetLang: s.targetLang || 'vi',
        customPrompt: titlePrompt,
        apiProvider: s.apiProvider || 'google-free',
        apiKey: this.getCleanApiKey(State.getProviderConfig(s.apiProvider), s.apiKey),
        apiEndpoint: s.customEndpoint,
        model: s.model,
        thinkingLevel: 'LOW',
        reasoningEffort: 'low',
        reasoningMode: 'standard',
        safetySetting: s.safetySetting || 'BLOCK_MEDIUM_AND_ABOVE',
        temperature: 0.2,
        glossary: [],
        characterProfiles: [],
        context: ''
      }, 'Tiêu đề chương');

      if (res) {
        return this.cleanTranslatedTitle(res, cleanTitle);
      }
    } catch (aiErr) {
      console.warn('[translateTitle] Lỗi dịch tiêu đề bằng AI:', aiErr.message);
    }

    return cleanTitle;
  },

  // Translate a single block of text
  async translateText(text) {
    if (!text) return '';
    
    if (!State.isTranslating) {
      this.activeFallbackSession = null;
    }

    const s = State.settings;
    const book = State.currentBook;
    const shouldScanGlossary = !book || book.glossaryEnabled !== false;
    const shouldScanCharacters = !book || book.characterProfilesEnabled !== false;

    return await this.executeTranslationWithFallback({
      text,
      sourceLang: s.sourceLang || 'auto',
      targetLang: s.targetLang || 'vi',
      customPrompt: Settings.getProcessedPrompt(),
      apiProvider: s.apiProvider,
      apiKey: this.getCleanApiKey(State.getProviderConfig(s.apiProvider), s.apiKey),
      apiEndpoint: s.customEndpoint,
      model: s.model,
      thinkingLevel: s.thinkingLevel || 'MEDIUM',
      reasoningEffort: s.reasoningEffort || 'medium',
      reasoningMode: s.reasoningMode || 'standard',
      safetySetting: s.safetySetting || 'BLOCK_MEDIUM_AND_ABOVE',
      temperature: s.temperature === undefined ? 1.0 : s.temperature,
      glossary: shouldScanGlossary ? this.getActiveGlossary(text) : [],
      characterProfiles: shouldScanCharacters ? this.getActiveCharacterProfiles(text) : [],
      context: ''
    }, 'Đoạn văn');
  },

  isRateLimitOrQuotaError(err) {
    if (!err) return false;
    const msg = (typeof err === 'string' ? err : (err.message || '')).toLowerCase();
    return (
      msg.includes('429') ||
      msg.includes('resource_exhausted') ||
      msg.includes('rate limit') ||
      msg.includes('ratelimit') ||
      msg.includes('quota') ||
      msg.includes('too many requests') ||
      msg.includes('exceeded your current quota') ||
      msg.includes('insufficient_quota') ||
      msg.includes('credit balance') ||
      msg.includes('tokens per minute') ||
      msg.includes('requests per minute') ||
      msg.includes('requests per day') ||
      msg.includes('tpm') ||
      msg.includes('rpm') ||
      msg.includes('rpd') ||
      msg.includes('busy') ||
      msg.includes('503') ||
      msg.includes('overloaded') ||
      msg.includes('quá tải') ||
      msg.includes('qua tai') ||
      msg.includes('high demand') ||
      msg.includes('thử hết') ||
      msg.includes('tất cả') ||
      msg.includes('gặp sự cố') ||
      msg.includes('không khả dụng') ||
      msg.includes('không tồn tại')
    );
  },

  isValidTranslationResult(text) {
    if (!text || typeof text !== 'string') return false;
    const t = text.trim();
    if (t.length < 2) return false;
    // Không bao giờ coi là bản dịch hợp lệ nếu chứa thông báo lỗi API hoặc rác hệ thống
    const isError = (
      t.startsWith('API Error') ||
      t.startsWith('Lỗi ') ||
      t.startsWith('Error:') ||
      t.includes('Choices empty') ||
      t.includes('Rate Limit') ||
      t.includes('Quota') ||
      t.includes('overloaded') ||
      t.includes('503: Server')
    );
    return !isError;
  },

  getCleanApiKey(provCfg, fallbackKey = '') {
    if (!provCfg) return fallbackKey || '';
    if (typeof provCfg.apiKey === 'string' && provCfg.apiKey.trim() && !provCfg.apiKey.includes('[object Object]')) {
      return provCfg.apiKey.trim();
    }
    if (Array.isArray(provCfg.apiKeys) && provCfg.apiKeys.length > 0) {
      const keys = provCfg.apiKeys
        .map(k => (typeof k === 'string' ? k : k?.key || '').trim())
        .filter(k => k && k !== '[object Object]');
      if (keys.length > 0) return keys.join('\n');
    }
    return fallbackKey || '';
  },

  resetFallbackSession() {
    this.activeFallbackSession = null;
  },

  async executeTranslationWithFallback(callParams, contextTitle = '') {
    const s = State.settings;
    if (s.enableFallback === false) {
      this.activeFallbackSession = null;
      return await window.electronAPI.translateText(callParams);
    }

    if (!this.activeFallbackSession) {
      const currentProv = s.apiProvider || 'google-free';
      const provCfg = (typeof State.getProviderConfig === 'function') ? State.getProviderConfig(currentProv) : {};
      const initialModel = s.model || provCfg.model || callParams.model || '';
      this.activeFallbackSession = {
        provider: currentProv,
        model: initialModel,
        triedSteps: new Set()
      };
    }

    const session = this.activeFallbackSession;
    const chain = (typeof State !== 'undefined' && State.getFallbackChain)
      ? State.getFallbackChain()
      : [];

    // Apply currently active session provider & model (if fallback has already occurred)
    if (session.provider && callParams.apiProvider !== 'google-free') {
      callParams.apiProvider = session.provider;
      if (session.model) callParams.model = session.model;
      const provCfg = State.getProviderConfig(session.provider);
      callParams.apiKey = this.getCleanApiKey(provCfg, callParams.apiKey);
      if (provCfg.customEndpoint) callParams.apiEndpoint = provCfg.customEndpoint;
    }

    let modelFailCount = 0;
    // Model bị chặn do bộ lọc an toàn chỉ bỏ qua cho ĐOẠN NÀY, đoạn sau vẫn quay lại model chính
    const chunkTriedSteps = new Set();

    while (true) {
      try {
        const res = await window.electronAPI.translateText(callParams);
        return res;
      } catch (err) {
        if (State.cancelRequested) throw err;

        if (s.enableFallback === false) {
          throw err;
        }

        const currentProv = callParams.apiProvider || 'gemini';
        const currentModel = callParams.model || '';

        const isQuota = this.isRateLimitOrQuotaError(err);
        const isSafetyOrProhibited = err && err.message && (
          err.message.includes('PROHIBITED_CONTENT') ||
          err.message.includes('chính sách an toàn') ||
          err.message.includes('SAFETY') ||
          err.message.includes('nhạy cảm')
        );

        // Hết quota: đánh dấu cho cả phiên dịch. Bị chặn nội dung: chỉ đánh dấu cho đoạn này.
        const failedKey = `${currentProv}:${currentModel}`;
        if (isSafetyOrProhibited) chunkTriedSteps.add(failedKey);
        else session.triedSteps.add(failedKey);

        // Find the next untried step in the unified interleaved fallback chain
        let nextStep = null;
        for (let idx = 0; idx < chain.length; idx++) {
          const step = chain[idx];
          if (!step || !step.provider) continue;

          // Nếu là lỗi PROHIBITED_CONTENT/chính sách an toàn, bỏ qua các model khác của cùng provider này (vì máy chủ Google chặn toàn bộ model Gemini)
          if (isSafetyOrProhibited && step.provider === currentProv) continue;

          const stepKey = `${step.provider}:${step.model}`;
          if (session.triedSteps.has(stepKey) || chunkTriedSteps.has(stepKey)) continue;

          // Check if provider has valid API key or is free
          const provCfg = State.getProviderConfig(step.provider);
          const cleanKey = this.getCleanApiKey(provCfg, (step.provider === currentProv ? callParams.apiKey : ''));
          const hasKey = step.provider === 'google-free' || !!cleanKey;
          if (!hasKey) {
            console.warn(`[Auto-Fallback] Bỏ qua ${step.provider} (${step.model}): Chưa cài đặt API Key.`);
            continue;
          }

          nextStep = step;
          break;
        }

        // Chỉ tự động thử các model mặc định khác nếu người dùng CHƯA thiết lập chuỗi xoay tua tùy chỉnh (unifiedFallbackChain).
        // Nếu người dùng đã tự cấu hình danh sách model (ví dụ chỉ chọn 3.5-flash-lite và 3.1-flash-lite), BẮT BUỘC tuân thủ đúng danh sách đó,
        // TUYỆT ĐỐI KHÔNG tự ý chuyển sang các model ngoài chuỗi như 3.8, 3.7, 3.6!
        const hasCustomChain = Array.isArray(s.unifiedFallbackChain) && s.unifiedFallbackChain.length > 1;
        if (!nextStep && !hasCustomChain && !isSafetyOrProhibited && State.getFallbackModels) {
          const provFallbacks = State.getFallbackModels(currentProv, currentModel);
          for (const fbModel of provFallbacks) {
            if (!fbModel || fbModel === currentModel) continue;
            const stepKey = `${currentProv}:${fbModel}`;
            if (!session.triedSteps.has(stepKey)) {
              nextStep = { provider: currentProv, model: fbModel };
              break;
            }
          }
        }

        if (nextStep) {
          if (!isSafetyOrProhibited) {
            session.provider = nextStep.provider;
            session.model = nextStep.model;
          }
          const nextCfg = State.getProviderConfig(nextStep.provider);

          callParams.apiProvider = nextStep.provider;
          callParams.model = nextStep.model;
          callParams.apiKey = this.getCleanApiKey(nextCfg, callParams.apiKey);
          callParams.apiEndpoint = nextCfg.customEndpoint || '';

          const provObj = (typeof AIConfig !== 'undefined') ? AIConfig.getProvider(nextStep.provider) : {};
          const provName = provObj.name || nextStep.provider.toUpperCase();

          const reason = isSafetyOrProhibited ? 'bị bộ lọc an toàn chặn (PROHIBITED_CONTENT)' : (isQuota ? 'hết Quota / Rate Limit' : 'gặp sự cố');
          console.warn(`[Auto-Fallback] ${currentProv.toUpperCase()} (${currentModel}) ${reason} ➔ Đổi sang ${provName} (${nextStep.model})`);
          Utils.showToast(`${currentProv.toUpperCase()} (${currentModel}) ${reason} ➔ Chuyển sang ${provName} (${nextStep.model})`, 'warning');
          const progLabel = UI.$('#progressLabel');
          if (progLabel) progLabel.textContent = `Đang dịch ${contextTitle || ''} (Dự phòng: ${provName} - ${nextStep.model})...`;
          await new Promise(r => setTimeout(r, 600));
          continue;
        }

        // Safety net: Google Free if enabled
        if (s.fallbackToGoogleFree !== false && callParams.apiProvider !== 'google-free') {
          if (!isSafetyOrProhibited) {
            session.provider = 'google-free';
            session.model = '';
          }
          callParams.apiProvider = 'google-free';
          callParams.model = '';
          callParams.apiKey = '';
          callParams.apiEndpoint = '';

          const fallbackMsg = isSafetyOrProhibited
            ? 'Nội dung chương bị bộ lọc Gemini chặn (PROHIBITED_CONTENT). Tự động chuyển sang Google Dịch để hoàn tất!'
            : 'Tất cả AI trong chuỗi đã hết Quota. Tự động chuyển sang Google Translate để hoàn tất!';
          Utils.showToast(fallbackMsg, 'info');
          const progLabel = UI.$('#progressLabel');
          if (progLabel) progLabel.textContent = `Đang dịch ${contextTitle || ''} (Dự phòng: Google Translate)...`;
          await new Promise(r => setTimeout(r, 600));
          continue;
        }

        // No more fallbacks available -> re-throw original error
        throw err;
      }
    }
  },

  // File translation loop
  async startFileTranslation() {
    if (!State.currentFile && State.currentBook && State.currentBook.filePath && window.electronAPI) {
      try {
        const res = await window.electronAPI.openFileByPath(State.currentBook.filePath);
        if (res) State.currentFile = res;
      } catch (e) {
        console.error('Failed to reload currentFile:', e);
      }
    }
    if (!State.currentFile || State.isTranslating) {
      if (!State.currentFile) Utils.showToast('Vui lòng mở một cuốn sách trước khi dịch!', 'warning');
      return;
    }
    
    State.isTranslating = true;
    State.cancelRequested = false;
    
    // UI Setup
    UI.toggleHidden(UI.$('#translateFileBtn'), true);
    UI.toggleHidden(UI.$('#cancelTranslation'), false);
    UI.toggleHidden(UI.$('#saveFileBtn'), true);
    UI.toggleHidden(UI.$('#progressSection'), false);

    const s = State.settings;

    // Reset active fallback session for this new translation run
    const currentProv = s.apiProvider || 'google-free';
    const provCfg = (typeof State.getProviderConfig === 'function') ? State.getProviderConfig(currentProv) : {};
    const effectiveModel = s.model || provCfg.model || '';
    this.activeFallbackSession = {
      provider: currentProv,
      model: effectiveModel,
      triedSteps: new Set()
    };
    const selectedChapters = State.chapters.filter(ch => ch.selected);
    
    if (selectedChapters.length === 0) {
      Utils.showToast('Vui lòng chọn ít nhất một chương', 'info');
      State.isTranslating = false;
      this.resetFileUI();
      return;
    }

    // Split chapters into chunks based on model output tokens or manual setting
    const allChapterChunks = selectedChapters.map(ch => {
      let chunkSize = 9999999;
      if (s.enableChunking !== false) {
        if (s.chunkMode === 'manual') {
          chunkSize = s.chunkSize || 3000;
        } else {
          const provider = s.apiProvider || 'gemini';
          const model = s.model || '';
          const info = (typeof AIConfig !== 'undefined' && typeof AIConfig.getSafeChunkLimit === 'function')
            ? AIConfig.getSafeChunkLimit(provider, model, ch.content)
            : { limitChars: 15000 };
          chunkSize = info.limitChars;
        }
      }
      return {
        id: ch.id,
        title: ch.originalTitle || ch.title,
        chunks: Utils.splitIntoChunks(ch.content, chunkSize)
      };
    });
    
    const totalChunks = allChapterChunks.reduce((acc, curr) => acc + curr.chunks.length, 0);
    
    if (State.currentBook) {
      State.currentBook.totalChunks = totalChunks;
      State.saveBooks();
    }

    const queue = allChapterChunks.filter(c => !State.finishedChapters.some(fc => fc.sourceChapterId === c.id));
    const remainingChunks = queue.reduce((acc, curr) => acc + curr.chunks.length, 0);

    if (queue.length === 0) {
      Utils.showToast('Tất cả chương đã chọn đều đã được dịch xong.', 'success');
      State.isTranslating = false;
      this.resetFileUI();
      UI.toggleHidden(UI.$('#progressSection'), true);
      UI.toggleHidden(UI.$('#saveFileBtn'), false);
      return;
    }

    // Shared progress state
    const progress = {
      processed: 0,
      total: remainingChunks
    };

    const startTime = Date.now();
    this.updateProgress(0, progress.total, startTime);
    UI.$('#progressLabel').textContent = 'Đang chuẩn bị...';
    if (window.TranslationPipeline) TranslationPipeline.reset();

    const threadCount = s.enableMultiThreading ? (s.translationThreads || 2) : 1;
    const workers = [];

    // Shared update function
    const onChunkProcessed = () => {
      progress.processed++;
      this.updateProgress(progress.processed, progress.total, startTime);
    };

    // If multi-threading, we show a more general label
    if (threadCount > 1) {
      UI.$('#progressLabel').textContent = `Đang dịch ${queue.length} chương mới (${threadCount} luồng)...`;
    }

    const failedChapters = [];

    for (let i = 0; i < threadCount; i++) {
      workers.push((async () => {
        while (queue.length > 0 && !State.cancelRequested) {
          const chapterData = queue.shift();
          if (!chapterData) break;

          const targetCh = State.chapters ? State.chapters.find(c => c.id === chapterData.id) : null;
          if (targetCh) {
            targetCh._isTranslating = true;
            delete targetCh._translationError;
          }

          if (threadCount === 1) {
            const shortTitle = (chapterData.title || '').length > 60
              ? (chapterData.title.substring(0, 60) + '...')
              : (chapterData.title || `Chương ${chapterData.id + 1}`);
            UI.$('#progressLabel').textContent = `Đang dịch: ${shortTitle}`;
          }

          if (window.ChapterWorkspace) {
            if (threadCount === 1 && ChapterWorkspace.activeChapterId !== chapterData.id) {
              ChapterWorkspace.selectChapter(chapterData.id);
            }
            ChapterWorkspace.renderListOnly();
          }

          let chapterSuccess = false;
          let lastErr = null;
          const maxChapterAttempts = 2;
          let chunksThisAttempt = 0;
          const countChunk = () => { chunksThisAttempt++; onChunkProcessed(); };

          for (let attempt = 1; attempt <= maxChapterAttempts; attempt++) {
            try {
              if (attempt > 1) {
                progress.processed -= chunksThisAttempt;
                chunksThisAttempt = 0;
                console.warn(`[ZumiTranslator] Tự động thử lại ${chapterData.title} (Lần ${attempt}/${maxChapterAttempts})...`);
                await new Promise(r => setTimeout(r, 2000));
              }
              await this.translateChapter(chapterData, s, countChunk, progress);
              chapterSuccess = true;
              break;
            } catch (err) {
              lastErr = err;
              if (State.cancelRequested) break;
              if (attempt < maxChapterAttempts) {
                console.warn(`[ZumiTranslator] ${chapterData.title} gặp sự cố tạm thời (${err.message}). Đang tự động thử lại...`);
                continue;
              }
            }
          }

          if (chapterSuccess) {
            if (targetCh) {
              delete targetCh._isTranslating;
            }
            if (window.ChapterWorkspace) {
              ChapterWorkspace.renderListOnly();
            }
            if (s.enableDelay !== false && s.requestDelay > 0 && queue.length > 0 && !State.cancelRequested) {
              await new Promise(r => setTimeout(r, s.requestDelay));
            }
          } else {
            const err = lastErr || new Error('Lỗi dịch');
            if (targetCh) {
              delete targetCh._isTranslating;
              targetCh._translationError = err.message || 'Lỗi dịch';
            }
            failedChapters.push({ chapter: chapterData, error: err.message });
            if (window.ChapterWorkspace) {
              ChapterWorkspace.renderListOnly();
            }
            console.error('Chapter translation error:', err);
            Utils.showToast(`Lỗi tại ${chapterData.title}: ${err.message}`, 'error');
            // We don't stop everything for one chapter error in multi-thread mode unless it's critical
            if (threadCount === 1) {
              State.isTranslating = false;
              this.resetFileUI();
              return;
            }
          }
        }
      })());
    }

    await Promise.all(workers);

    State.isTranslating = false;
    if (!State.cancelRequested) {
      if (failedChapters.length > 0) {
        UI.$('#progressLabel').textContent = `Hoàn tất với ${failedChapters.length} chương lỗi`;
        UI.toggleHidden(UI.$('#saveFileBtn'), false);
        Utils.showToast(`Đã dịch xong, nhưng có ${failedChapters.length} chương gặp lỗi (chưa dịch được). Bạn có thể chọn các chương lỗi để thử lại!`, 'warning');
      } else {
        UI.$('#progressLabel').textContent = 'Hoàn thành!';
        UI.toggleHidden(UI.$('#saveFileBtn'), false);
        Utils.showToast('Dịch xong toàn bộ thành công 100%!', 'success');
      }
      if (window.TranslationPipeline) {
        TranslationPipeline.setStep('complete');
      }
    }
    this.resetFileUI();
  },

  // Helper to translate a single chapter
  async translateChapter(chapterData, s, onChunkProcessed, progress) {
    let chapterTranslatedContent = '';
    let currentDisplayTitle = chapterData.title;

    const shortTitle = (chapterData.title || '').length > 50
      ? (chapterData.title.substring(0, 50) + '...')
      : (chapterData.title || `Chương ${chapterData.id + 1}`);

    const labelEl = UI.$('#progressLabel');
    if (labelEl) {
      labelEl.textContent = `Đang dịch: ${shortTitle}...`;
    }

    const book = State.currentBook;
    const shouldScanGlossary = !book || book.glossaryEnabled !== false;
    const shouldScanCharacters = !book || book.characterProfilesEnabled !== false;
    const autoScanEnabled = s.autoScanChapters === true;

    // BƯỚC 1: Quét chương hiện tại để tìm & cập nhật từ điển và hồ sơ nhân vật (nếu các tính năng này được bật)
    if (autoScanEnabled && (shouldScanGlossary || shouldScanCharacters) && window.CharacterProfile && CharacterProfile.canScan()) {
      try {
        const sourceChapter = (State.chapters && State.chapters.find(c => c.id === chapterData.id)) || {
          id: chapterData.id,
          title: chapterData.title,
          content: chapterData.chunks.join('\n\n')
        };

        const labelEl = UI.$('#progressLabel');
        const prevLabel = labelEl ? labelEl.textContent : '';
        if (labelEl) {
          const shortTitle = (chapterData.title || '').length > 50
            ? (chapterData.title.substring(0, 50) + '...')
            : (chapterData.title || `Chương ${chapterData.id + 1}`);
          labelEl.textContent = `Đang quét nhân vật & từ điển: ${shortTitle}...`;
        }

        if (window.TranslationPipeline) {
          TranslationPipeline.setStep('scan', (chapterData.title || '').substring(0, 35));
        }

        await CharacterProfile.aiScanAndFill([sourceChapter], { silent: true });

        if (labelEl && prevLabel) {
          labelEl.textContent = prevLabel;
        }
      } catch (scanErr) {
        console.warn(`[AutoScan] Lỗi quét chương ${chapterData.title}, tiếp tục dịch bình thường:`, scanErr);
      }
    }

    // Translate chapter title first if enabled
    if (s.translateChapterTitles !== false) {
      if (window.TranslationPipeline) {
        TranslationPipeline.setStep('title', (chapterData.title || '').substring(0, 35));
      }
      // Nếu tiêu đề chỉ có số (ví dụ: "123"), không cần gọi API dịch
      if (/^\s*\d+\s*$/.test(chapterData.title)) {
        currentDisplayTitle = chapterData.title.trim();
      } else {
        try {
          const translatedTitle = await this.translateTitle(chapterData.title);
          currentDisplayTitle = translatedTitle.replace(/^"|"$/g, '').trim(); 
        } catch (e) {
          console.warn('Không thể dịch tiêu đề chương, giữ nguyên tiêu đề gốc:', e.message);
          if (State.cancelRequested) throw e;
          currentDisplayTitle = chapterData.title || `Chương ${chapterData.id + 1}`;
        }
      }
    }

    for (let i = 0; i < chapterData.chunks.length; i++) {
      if (State.cancelRequested) break;
      
      const chunkText = chapterData.chunks[i];

      const provCfg = (typeof State !== 'undefined' && State.getProviderConfig) ? State.getProviderConfig(s.apiProvider) : {};
      const activeModelName = s.model || provCfg?.model || s.apiProvider || 'AI';
      if (window.TranslationPipeline) {
        TranslationPipeline.setStep('translate', `Đoạn ${i + 1}/${chapterData.chunks.length}`, activeModelName);
      }

      const labelEl = UI.$('#progressLabel');
      if (labelEl) {
        const shortTitle = (currentDisplayTitle || '').length > 50
          ? (currentDisplayTitle.substring(0, 50) + '...')
          : (currentDisplayTitle || `Chương ${chapterData.id + 1}`);
        labelEl.textContent = `Đang dịch: ${shortTitle} (Đoạn ${i + 1}/${chapterData.chunks.length})...`;
      }

      // Mask [IMG:...] markers to lightweight tokens [[IMG_0]], [[IMG_1]] to save tokens and prevent URL corruption
      const imageMaskMap = new Map();
      let maskedChunkText = chunkText;
      if (chunkText.includes('[IMG:')) {
        maskedChunkText = chunkText.replace(/\[IMG:(.*?)\]/g, (match) => {
          const placeholder = `[[IMG_${imageMaskMap.size}]]`;
          imageMaskMap.set(placeholder, match);
          return placeholder;
        });

        // Fast-path: if the chunk is solely an image marker, no API call needed!
        if (imageMaskMap.size === 1 && maskedChunkText.trim() === '[[IMG_0]]') {
          const directImg = imageMaskMap.get('[[IMG_0]]');
          chapterTranslatedContent += (chapterTranslatedContent ? '\n\n' : '') + directImg;
          onChunkProcessed();
          if (window.ChapterWorkspace) {
            ChapterWorkspace.updateLiveChunk(chapterData.id, currentDisplayTitle, chapterTranslatedContent, i, chapterData.chunks.length);
          }
          continue;
        }
      }

      // BƯỚC 2: Đối chiếu từ điển và hồ sơ xem trong đoạn này có những từ, tên nào thì chỉ cung cấp đúng những từ/tên đó!
      const activeGlossary = shouldScanGlossary ? this.getActiveGlossary(`${chapterData.title || ''}\n${maskedChunkText}`) : [];
      const activeProfiles = shouldScanCharacters ? this.getActiveCharacterProfiles(`${chapterData.title || ''}\n${maskedChunkText}`) : [];

      // BƯỚC 3: Dịch đoạn văn với thông tin từ điển & nhân vật
      let chunkResult = await this.executeTranslationWithFallback({
        text: maskedChunkText,
        sourceLang: s.sourceLang || 'auto',
        targetLang: s.targetLang || 'vi',
        customPrompt: Settings.getProcessedPrompt(),
        apiProvider: s.apiProvider,
        apiKey: this.getCleanApiKey(State.getProviderConfig(s.apiProvider), s.apiKey || (Array.isArray(s.apiKeys) ? s.apiKeys.join('\n') : '')),
        apiEndpoint: s.customEndpoint,
        model: s.model,
        thinkingLevel: s.thinkingLevel || 'MEDIUM',
        reasoningEffort: s.reasoningEffort || 'medium',
        reasoningMode: s.reasoningMode || 'standard',
        safetySetting: s.safetySetting || 'BLOCK_MEDIUM_AND_ABOVE',
        temperature: s.temperature === undefined ? 1.0 : s.temperature,
        glossary: activeGlossary,
        characterProfiles: activeProfiles
      }, chapterData.title);

      if (chunkResult && chunkResult.includes('###CONTENT###')) {
        const parts = chunkResult.split('###CONTENT###');
        const titleCandidate = parts[0].replace('###TITLE###', '').trim();
        if (titleCandidate && i === 0) {
          currentDisplayTitle = titleCandidate;
        }
        chunkResult = parts[1].trim();
      }

      // Restore masked image markers
      if (imageMaskMap.size > 0 && chunkResult) {
        for (const [placeholder, originalImgTag] of imageMaskMap.entries()) {
          const escapedPlaceholder = placeholder.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
          const placeholderRegex = new RegExp(escapedPlaceholder.replace(/_/g, '\\s*_?\\s*'), 'gi');
          if (placeholderRegex.test(chunkResult)) {
            placeholderRegex.lastIndex = 0;
            chunkResult = chunkResult.replace(placeholderRegex, `\n\n${originalImgTag}\n\n`);
          } else {
            // Append if AI omitted placeholder so illustration is never lost
            chunkResult += `\n\n${originalImgTag}\n\n`;
          }
        }
      }

      chapterTranslatedContent += (chapterTranslatedContent ? '\n\n' : '') + chunkResult;
      onChunkProcessed();
      
      // CẬP NHẬT TRỰC TIẾP: Dịch tới đâu hiển thị ngay đoạn dịch tới đó trên màn hình Workspace!
      try {
        if (window.EventBus && typeof window.EventBus.emit === 'function') {
          window.EventBus.emit('chapter:chunk-translated', {
            chapterId: chapterData.id,
            title: currentDisplayTitle,
            content: chapterTranslatedContent,
            chunkIndex: i,
            totalChunks: chapterData.chunks.length
          });
        }
      } catch (busErr) {
        console.warn('[EventBus] Warning:', busErr);
      }
      if (window.ChapterWorkspace && typeof window.ChapterWorkspace.updateLiveChunk === 'function') {
        ChapterWorkspace.updateLiveChunk(chapterData.id, currentDisplayTitle, chapterTranslatedContent, i, chapterData.chunks.length);
      }
      
      // Small delay to avoid rate limits
      if (i < chapterData.chunks.length - 1 && s.enableDelay !== false) {
        await new Promise(r => setTimeout(r, s.requestDelay || 500));
      }
    }

    if (!State.cancelRequested) {
      // Update the original chapter object with the translated title
      const ch = State.chapters.find(c => c.id === chapterData.id);
      if (ch) {
        if (!ch.originalTitle) {
          ch.originalTitle = chapterData.title;
        }
        ch.title = currentDisplayTitle;
        delete ch._langEvaluation;
        delete ch._bypassCache;
      }

      // Add to finished chapters
      State.finishedChapters.push({
        sourceChapterId: chapterData.id,
        title: currentDisplayTitle,
        content: chapterTranslatedContent,
        sourceContent: chapterData.chunks.join('\n\n')
      });
      
      // Sort finished chapters by their original ID to maintain order
      State.finishedChapters.sort((a, b) => {
        const idA = State.chapters.find(c => c.id === a.sourceChapterId)?.id || 0;
        const idB = State.chapters.find(c => c.id === b.sourceChapterId)?.id || 0;
        return idA - idB;
      });

      // Save overall progress using shared progress counters
      State.saveTranslationProgress(progress.processed, progress.total);
      this.renderCompletedChapters();
      
      // Refresh chapter list UI and workspace
      if (window.ChapterWorkspace) {
        ChapterWorkspace.render();
      } else if (window.Bookshelf) {
        Bookshelf.renderChapterList();
      }
      if (window.TranslationWorkflow) TranslationWorkflow.update();
      if (window.TranslationPipeline) {
        TranslationPipeline.setStep('finalize', 'Đã lưu chương');
      }
    }
  },

  async autoFixChapter(idx) {
    const fc = State.finishedChapters[idx];
    if (!fc || !fc.content) return;

    const foreign = window.ForeignDetector ? ForeignDetector.detect(fc.content) : null;
    if (!foreign || !foreign.hasForeign) {
      Utils.showToast('Chương này không có ký tự ngoại ngữ nào cần sửa!', 'info');
      return;
    }

    Utils.showToast(`Đang gọi AI xử lý các từ sót (${foreign.samples.slice(0, 5).join(', ')})...`, 'info');

    const s = State.settings;
    const fixPrompt = `Bạn là biên tập viên dịch thuật tiểu thuyết tài hoa. 
Bản dịch tiếng Việt dưới đây còn sót một số ký tự/từ ngữ ngoại ngữ (${foreign.warningMessage}).
Nhiệm vụ: Hãy dịch dứt điểm tất cả các ký tự ngoại ngữ còn sót này sang tiếng Việt tự nhiên, phù hợp với ngữ cảnh tiểu thuyết, giữ nguyên phong cách và không làm mất các đoạn văn đã dịch tốt.
Chỉ xuất ra toàn bộ bản dịch tiếng Việt hoàn chỉnh, không thêm bất kỳ lời bình luận hay giải thích nào khác.`;

    try {
      const fixedContent = await window.electronAPI.translateText({
        text: fc.content,
        sourceLang: 'vi',
        targetLang: 'vi',
        customPrompt: fixPrompt,
        apiProvider: s.apiProvider,
        apiKey: s.apiKey,
        apiEndpoint: s.customEndpoint,
        model: s.model,
        thinkingLevel: 'LOW',
        temperature: 0.3,
        glossary: this.getActiveGlossary(fc.content),
        characterProfiles: this.getActiveCharacterProfiles(fc.content)
      });

      if (fixedContent && fixedContent.trim().length > 100) {
        fc.content = fixedContent.trim();
        State.saveFinishedChapters();
        this.renderCompletedChapters();
        if (window.ChapterWorkspace) ChapterWorkspace.render();
        Utils.showToast(`Đã sửa xong chữ sót cho "${fc.title}"!`, 'success');
      } else {
        throw new Error('AI trả về phản hồi không hợp lệ.');
      }
    } catch (err) {
      console.error('Auto fix error:', err);
      Utils.showToast(`Lỗi sửa tự động: ${err.message}`, 'error');
    }
  },

  // --- FACADE DELEGATION: HẬU XỬ LÝ & BATCH REPLACE (TranslationPostProcess) ---
  renderCompletedChapters(...args) { return (window.TranslationPostProcess || TranslationPostProcess).renderCompletedChapters(...args); },
  findAndScrollToFaultyChapter(...args) { return (window.TranslationPostProcess || TranslationPostProcess).findAndScrollToFaultyChapter(...args); },
  isTranslationSuspicious(...args) { return (window.TranslationPostProcess || TranslationPostProcess).isTranslationSuspicious(...args); },
  compareAndReportCompleteness(...args) { return (window.TranslationPostProcess || TranslationPostProcess).compareAndReportCompleteness(...args); },
  batchReplace(...args) { return (window.TranslationPostProcess || TranslationPostProcess).batchReplace(...args); },


  updateProgress(processed, total, startTime) {
    const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
    const bar = UI.$('#progressBar');
    const percentEl = UI.$('#progressPercent');
    const chunksEl = UI.$('#progressChunks');
    const timeEl = UI.$('#progressTime');

    if (bar) bar.style.width = `${percent}%`;
    if (percentEl) percentEl.textContent = `${percent}%`;
    if (chunksEl) chunksEl.textContent = `${processed}/${total} chunks`;

    if (timeEl && startTime && processed > 0) {
      const elapsed = Date.now() - startTime;
      const remaining = (elapsed / processed) * (total - processed);
      timeEl.textContent = `Còn lại: ~${Utils.formatTime(remaining)}`;
    }
    if (window.TranslationWorkflow) TranslationWorkflow.update();
  },

  resetFileUI() {
    const btn = document.getElementById('translateFileBtn') || (typeof UI !== 'undefined' && UI.$ ? UI.$('#translateFileBtn') : null);
    if (btn) {
      if (typeof UI !== 'undefined' && UI.toggleHidden) UI.toggleHidden(btn, false);
      else btn.classList.remove('hidden');
      const hasSelected = Array.isArray(State.chapters) && State.chapters.some(c => c.selected);
      btn.disabled = !hasSelected;
    }
    const cancelBtn = document.getElementById('cancelTranslation') || (typeof UI !== 'undefined' && UI.$ ? UI.$('#cancelTranslation') : null);
    if (cancelBtn) {
      if (typeof UI !== 'undefined' && UI.toggleHidden) UI.toggleHidden(cancelBtn, true);
      else cancelBtn.classList.add('hidden');
    }
    if (window.TranslationWorkflow) TranslationWorkflow.update();
  }
};

if (typeof window !== 'undefined') {
  window.Translation = Translation;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Translation;
}
