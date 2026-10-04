/**
 * ZumiTranslator - Character Scanner Service
 * Quản lý cấu hình AI và tiến trình đọc hiểu tiểu thuyết, trích xuất nhân vật & xưng hô
 */

const CharacterScanner = {
  isScanning: false,
  scanLock: Promise.resolve(),

  async acquireScanLock() {
    let release;
    const nextLock = new Promise(resolve => { release = resolve; });
    const prevLock = this.scanLock;
    this.scanLock = nextLock;
    await prevLock;
    return release;
  },

  updateProfilerModelDropdowns(provider) {
    const s = State.settings || {};
    const chosenProvider = provider || s.profilerProvider || 'auto';
    let effective = chosenProvider;
    if (effective === 'auto') {
      const active = s.apiProvider || 'gemini';
      effective = ['gemini', 'openai', 'deepseek', 'groq', 'cerebras', 'openrouter', 'custom'].includes(active) ? active : 'gemini';
    }

    let models = [];
    if (typeof AIConfig !== 'undefined' && AIConfig.getModels) {
      models = AIConfig.getModels(effective) || [];
    }

    const currentModel = s.profilerModel || 'auto';

    const selects = [
      document.getElementById('characterScanModelSelect'),
      document.getElementById('glossaryScanModelSelect'),
      document.getElementById('profilerModelSetting')
    ].filter(Boolean);

    selects.forEach(sel => {
      sel.innerHTML = '<option value="auto">Mặc định (Theo model dịch)</option>';
      models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        if (m === currentModel) opt.selected = true;
        sel.appendChild(opt);
      });
      if (currentModel !== 'auto' && !models.includes(currentModel)) {
        const opt = document.createElement('option');
        opt.value = currentModel;
        opt.textContent = currentModel;
        opt.selected = true;
        sel.appendChild(opt);
      }
      sel.value = currentModel;
    });
  },

  onProfilerModelChange(model) {
    State.saveSettings({ profilerModel: model });
    const selects = [
      document.getElementById('characterScanModelSelect'),
      document.getElementById('glossaryScanModelSelect'),
      document.getElementById('profilerModelSetting')
    ].filter(Boolean);
    selects.forEach(sel => {
      sel.value = model;
    });
    Utils.showToast(`Đã chọn Model quét: ${model === 'auto' ? 'Mặc định (Theo model dịch)' : model}`, 'info');
  },

  extractCleanKey(cfg, fallback = '') {
    if (!cfg) return fallback || '';
    if (typeof cfg.apiKey === 'string' && cfg.apiKey.trim() && !cfg.apiKey.includes('[object Object]')) {
      return cfg.apiKey.trim();
    }
    if (Array.isArray(cfg.apiKeys) && cfg.apiKeys.length > 0) {
      const raw = cfg.apiKeys
        .map(k => (typeof k === 'string' ? k : k?.key || '').trim())
        .filter(k => k && k !== '[object Object]');
      if (raw.length > 0) return raw.join('\n');
    }
    return fallback || '';
  },

  getProfilerConfig() {
    const s = State.settings || {};
    const chosen = s.profilerProvider || 'auto';
    const aiProviders = ['gemini', 'openai', 'deepseek', 'groq', 'cerebras', 'openrouter', 'custom'];

    const applyProfilerModel = (prof) => {
      if (s.profilerModel && s.profilerModel !== 'auto') {
        prof.model = s.profilerModel;
      }
      return prof;
    };

    const getProviderProfile = (p) => {
      const pConfig = (s.providerConfigs && s.providerConfigs[p]) || (State.getProviderConfig ? State.getProviderConfig(p) : {});
      const defs = State.getProviderDefaults ? State.getProviderDefaults(p) : {};
      const apiKey = this.extractCleanKey(pConfig, (s.apiProvider === p ? this.extractCleanKey(State.getProviderConfig(p), s.apiKey) : ''));
      const model = pConfig.model || defs.model;
      const customEndpoint = pConfig.customEndpoint || defs.customEndpoint;
      return {
        provider: p,
        apiKey,
        model,
        customEndpoint,
        name: p.toUpperCase()
      };
    };

    // 1. Explicit provider chosen
    if (chosen !== 'auto' && aiProviders.includes(chosen)) {
      const prof = getProviderProfile(chosen);
      if (!prof.apiKey && chosen !== 'custom') {
        throw new Error(`Bạn đã chọn AI quét là "${prof.name}" nhưng chưa nhập API Key cho provider này trong Cài đặt.`);
      }
      return applyProfilerModel(prof);
    }

    // 2. 'auto' mode: check active provider
    if (aiProviders.includes(s.apiProvider)) {
      const pConfig = State.getProviderConfig ? State.getProviderConfig(s.apiProvider) : {};
      const apiKey = this.extractCleanKey(pConfig, s.apiKey);
      if (apiKey || s.apiProvider === 'custom') {
        return applyProfilerModel({
          provider: s.apiProvider,
          apiKey,
          model: s.model,
          customEndpoint: s.customEndpoint,
          name: (s.apiProvider || '').toUpperCase()
        });
      }
    }

    // 3. Active provider is non-AI (e.g. google-free, deepl), look for any configured AI key
    for (const p of ['gemini', 'deepseek', 'openai', 'groq', 'openrouter']) {
      const pConfig = (s.providerConfigs && s.providerConfigs[p]) || (State.getProviderConfig ? State.getProviderConfig(p) : {});
      const cleanK = this.extractCleanKey(pConfig);
      if (cleanK) {
        return applyProfilerModel(getProviderProfile(p));
      }
    }

    throw new Error('Công cụ dịch hiện tại không hỗ trợ phân tích AI (Google Dịch / DeepL). Vui lòng chọn "AI quét" (ở menu trên hoặc Cài đặt) là Gemini, OpenAI hoặc DeepSeek và nhập API Key.');
  },

  canScan() {
    try {
      this.getProfilerConfig();
      return true;
    } catch (e) {
      return false;
    }
  },

  buildSafeScannerText(targetChapters, budget = 3500) {
    if (!Array.isArray(targetChapters) || targetChapters.length === 0) return '';

    const toxicRegex = /(?:假阳具|假玩具|玩具|小穴|后穴|花穴|肉穴|粉穴|蜜穴|肉棒|鸡巴|肛塞|胖次|罩罩|爱液|阴蒂|潮吹|内射|高潮|抽插|呻吟|赤裸|乳房|做爱|自慰|初夜|性玩具|性爱|透[！!]|被.*透|禁地|神圣的禁地|血迹|落红|破处|侵犯|强奸|强暴|压在身下|毫无反抗之力|娇嫩的花|摧残|凋零|萝莉.*赤裸|赤裸.*萝莉|敏感度|玩不坏|玩坏|怀孕|药丸|下药|迷药|无色无味|崩溃|绝望|不要|呜呜|逃走|崩坏|只能是我的|抢走你|チンポ|まんこ|질내사정)/i;

    const roleKeywords = /(?:妹妹|哥哥|姐姐|弟弟|父亲|母亲|爸爸|妈妈|师兄|师姐|师弟|师妹|师尊|师父|弟子|宗主|长老|同学|老师|朋友|女友|男友|主角|少爷|小姐|陛下|殿下|队长|将军|大人|先生|女士|男|女)/;

    const cleanExcerpts = [];
    let currentLen = 0;

    for (let cIdx = 0; cIdx < targetChapters.length; cIdx++) {
      const ch = targetChapters[cIdx];
      const rawTitle = ch.title || `Chương ${cIdx + 1}`;
      const safeTitle = rawTitle.replace(/(?:假阳具|假玩具|做爱|自慰|肉棒|鸡巴|小穴|透[！!]|被.*透|侵犯|强奸|强暴|性爱)/gi, '').trim() || `Chương ${cIdx + 1}`;
      
      const paragraphs = (ch.content || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
      if (paragraphs.length === 0) continue;

      let startIdx = 0;
      let teaserCount = 0;
      for (let i = 0; i < Math.min(15, paragraphs.length); i++) {
        if (toxicRegex.test(paragraphs[i])) teaserCount++;
      }
      if (teaserCount >= 2 && paragraphs.length > 20) {
        startIdx = Math.min(12, Math.floor(paragraphs.length / 4));
      }

      const chapterExcerpts = [];
      for (let i = startIdx; i < paragraphs.length; i++) {
        const p = paragraphs[i];
        if (toxicRegex.test(p)) {
          const dMatches = p.match(/["“「『]([^"”」』]+)["”」』]/g);
          if (dMatches) {
            for (const d of dMatches) {
              if (!toxicRegex.test(d) && !/^(?:["“「『])?\s*(?:嗯|啊|呀|呜|哈|咿|不要|痛)+[！!~…\s]*(?:["”」』])?$/i.test(d)) {
                if (currentLen + d.length <= budget) {
                  chapterExcerpts.push(d);
                  currentLen += d.length + 1;
                }
              }
            }
          }
          continue;
        }

        if (p.includes('“') || p.includes('"') || p.includes('「') || roleKeywords.test(p)) {
          if (currentLen + p.length <= budget) {
            chapterExcerpts.push(p);
            currentLen += p.length + 2;
          }
        }

        if (currentLen >= budget) break;
      }

      if (chapterExcerpts.length === 0) {
        for (let i = startIdx; i < paragraphs.length; i++) {
          const p = paragraphs[i];
          if (!toxicRegex.test(p)) {
            if (currentLen + p.length <= budget) {
              chapterExcerpts.push(p);
              currentLen += p.length + 2;
            }
          }
          if (currentLen >= budget) break;
        }
      }

      if (chapterExcerpts.length > 0) {
        cleanExcerpts.push(`=== CHƯƠNG: ${safeTitle} ===\n${chapterExcerpts.join('\n\n')}`);
      }

      if (currentLen >= budget) break;
    }

    return cleanExcerpts.join('\n\n');
  },

  cleanGlossaryValue(val, key = '') {
    if (window.BookGlossary && typeof window.BookGlossary.cleanGlossaryValue === 'function') {
      return window.BookGlossary.cleanGlossaryValue(val, key);
    }
    if (!val || typeof val !== 'string') return '';
    let clean = val.trim();

    const parenMatch = clean.match(/^([^(（]+)\s*[（(]([^)）]+)[)）]\s*$/);
    if (parenMatch) {
      const outside = parenMatch[1].trim();
      const inside = parenMatch[2].trim();

      const outsideHasLatin = /[a-zA-ZÀ-ỹ]/.test(outside);
      const outsideHasForeign = /[\uac00-\ud7af\u4e00-\u9fa5\u3040-\u30ff]/.test(outside);
      const insideHasLatin = /[a-zA-ZÀ-ỹ]/.test(inside);
      const insideHasForeign = /[\uac00-\ud7af\u4e00-\u9fa5\u3040-\u30ff]/.test(inside);

      if (!outsideHasLatin && outsideHasForeign && insideHasLatin && !insideHasForeign) {
        const parts = inside.split(/\s*[/;]\s*/);
        const candidate = parts.find(p => !/^(?:tên viết tắt|thuật ngữ|nghĩa là|chú thích|kỹ năng|ma vật|cấp)/i.test(p.trim()));
        clean = (candidate || parts[0]).trim();
      } else {
        clean = outside;
      }
    }

    clean = clean.replace(/\s*[\(\[（【][^)\]）】]*(?:ma vật|kỹ năng|thuật ngữ|tên viết tắt|quê hương|nghĩa là|chú thích|tước hiệu|chức nghiệp|cấp [A-Z0-9]|rank|tier|level|giải thích)[^)\]）】]*[\)\]）】]/gi, '');
    clean = clean.replace(/\s*[\(\[（【][^)\]）】]*[\uac00-\ud7af\u4e00-\u9fa5\u3040-\u30ff][^)\]）】]*[\)\]）】]/g, '');
    clean = clean.replace(/\s*[/|\-]?\s*['"‘“「]?[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\u4e00-\u9fa5\u3040-\u30ff]+['"’”」]?/g, '');

    if (clean.includes('/') && !clean.includes('http')) {
      const parts = clean.split(/\s*\/\s*/).map(p => p.trim()).filter(Boolean);
      if (parts.length > 1) {
        const viPart = parts.find(p => /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(p));
        clean = viPart || parts[0];
      }
    }

    clean = clean.replace(/^[\s/\\|'":;-]+|[\s/\\|'":;-]+$/g, '').trim();

    if (clean && clean.length > 1 && /^[a-zà-ỹ]/.test(clean)) {
      clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    }

    return clean;
  },

  async aiScanAndFill(customChapters = null, options = {}) {
    const silent = (options && options.silent === true) || false;
    const releaseLock = await this.acquireScanLock();

    try {
      const book = State.currentBook;
      if (!book) {
        if (!silent) Utils.showToast('Vui lòng mở một truyện trước khi phân tích.', 'warning');
        return null;
      }

      const allChapters = State.chapters || [];
      if (allChapters.length === 0) {
        if (!silent) Utils.showToast('Truyện chưa có chương nào để AI đọc và phân tích.', 'warning');
        return null;
      }

      const s = State.settings || {};

      let profiler;
      try {
        profiler = this.getProfilerConfig();
      } catch (err) {
        if (!silent) Utils.showToast(err.message, 'warning');
        return null;
      }

      let targetChapters = customChapters;
      if (!targetChapters || targetChapters.length === 0) {
        const isFinished = (ch) => State.finishedChapters && State.finishedChapters.some(fc => fc.sourceChapterId === ch.id);
        const untranslatedSelected = allChapters.filter(c => c.selected && !isFinished(c));
        if (untranslatedSelected.length > 0) {
          targetChapters = untranslatedSelected;
        } else {
          const untranslatedAll = allChapters.filter(c => !isFinished(c));
          if (untranslatedAll.length > 0) {
            targetChapters = untranslatedAll;
          } else {
            targetChapters = allChapters.filter(c => c.selected);
            if (targetChapters.length === 0) targetChapters = allChapters.slice(0, 3);
          }
        }
      }

      if (targetChapters.length > 12) {
        const total = targetChapters.length;
        const maxPick = 10;
        const step = Math.max(1, Math.floor(total / maxPick));
        const sampled = [];
        for (let i = 0; i < total && sampled.length < maxPick; i += step) {
          sampled.push(targetChapters[i]);
        }
        if (!sampled.includes(targetChapters[total - 1])) {
          sampled[sampled.length - 1] = targetChapters[total - 1];
        }
        targetChapters = sampled;
      }

      const chapterTitles = targetChapters.map(c => c.title || `Chương ${c.id + 1}`).join(', ');

      let combinedText = '';
      if (targetChapters.length === 1) {
        const ch = targetChapters[0];
        const text = (ch.content || '').trim();
        if (text.length > 120000) {
          const partLen = 40000;
          const startPart = text.slice(0, partLen);
          const midIndex = Math.floor((text.length - partLen) / 2);
          const midPart = text.slice(midIndex, midIndex + partLen);
          const endPart = text.slice(-partLen);
          combinedText = `=== CHƯƠNG: ${ch.title} (Đầu chương) ===\n${startPart}\n\n=== (Giữa chương) ===\n${midPart}\n\n=== (Cuối chương) ===\n${endPart}`;
        } else {
          combinedText = `=== CHƯƠNG: ${ch.title} ===\n${text}`;
        }
      } else {
        for (const ch of targetChapters) {
          const text = ch.content || '';
          combinedText += `\n\n=== CHƯƠNG: ${ch.title} ===\n${text.slice(0, 15000)}`;
          if (combinedText.length >= 120000) break;
        }
      }

      if (!combinedText.trim()) {
        if (!silent) Utils.showToast('Nội dung các chương trống, không thể phân tích.', 'warning');
        return null;
      }

      // Tinh giản thông minh cho Scanner: Lọc bỏ các đoạn miêu tả cấm kỵ/giải phẫu sắc dục để AI không bao giờ bị chặn PROHIBITED_CONTENT
      let safeCombinedText = this.buildSafeScannerText(targetChapters, 3500);
      if (!safeCombinedText || safeCombinedText.length < 50) {
        safeCombinedText = combinedText.slice(0, 3500);
      }

      this.isScanning = true;
      const loadingEl = document.getElementById('characterProfileAiLoading');
      const loadingText = document.getElementById('characterAiLoadingText');
      const scanBtn = document.getElementById('aiScanCharactersBtn');

      if (!silent) {
        if (loadingEl) loadingEl.classList.remove('hidden');
        if (loadingText) loadingText.textContent = `AI (${profiler.name}) đang đọc ${targetChapters.length} chương (${chapterTitles}) và phân tích nhân vật, xưng hô...`;
        if (scanBtn) {
          scanBtn.disabled = true;
          scanBtn.textContent = '⏳ Đang phân tích...';
        }
      }

      let bookLang = (book && book.language && book.language !== 'vi') ? book.language : (s.sourceLang || 'auto');
      if (window.ProgressDetector && typeof window.ProgressDetector.detectLanguageOffline === 'function') {
        const detected = ProgressDetector.detectLanguageOffline(combinedText);
        if (detected && detected !== 'unknown' && detected !== 'empty' && detected !== 'vi') {
          bookLang = detected;
        }
      }
      if (bookLang === 'auto' || !bookLang || bookLang === 'vi') {
        const kanaCount = (combinedText.match(/[\u3041-\u3096\u30a1-\u30fa]/g) || []).length;
        const hangulCount = (combinedText.match(/[\uac00-\ud7af]/g) || []).length;
        const cjkCount = (combinedText.match(/[\u4e00-\u9fa5]/g) || []).length;
        const totalAsian = cjkCount + kanaCount;
        const isJp = kanaCount >= 4 && (cjkCount === 0 || (kanaCount / totalAsian) >= 0.08);

        if (isJp) bookLang = 'ja';
        else if (hangulCount >= 3 && hangulCount >= cjkCount) bookLang = 'ko';
        else if (cjkCount >= 3) bookLang = 'zh';
        else bookLang = 'en';
      }

      const targetLangCode = (s.targetLang || 'vi');
      const targetLangMap = { 'vi': 'Tiếng Việt', 'en': 'Tiếng Anh', 'ja': 'Tiếng Nhật', 'ko': 'Tiếng Hàn', 'zh-CN': 'Tiếng Trung (Giản)', 'zh-TW': 'Tiếng Trung (Phồn)', 'fr': 'Tiếng Pháp', 'de': 'Tiếng Đức', 'es': 'Tiếng Tây Ban Nha' };
      const targetLangName = targetLangMap[targetLangCode] || targetLangCode;
      const isVi = (targetLangCode === 'vi');

      let langRules = '';
      if (bookLang === 'ja') {
        langRules = `[QUY TẮC NGUYÊN TÁC TIẾNG NHẬT]:
- "translatedName": BẮT BUỘC giữ phiên âm chuẩn Romaji / Katakana tự nhiên của Nhật (VD: 相良 -> Sagara, 須藤 -> Sudo, さっちゃん -> Sacchan, 美咲 -> Misaki).
- TUYỆT ĐỐI CẤM DỊCH TÊN TIẾNG NHẬT THÀNH ÂM HÁN VIỆT (không dịch thành Tương Lạc, Tu Đằng...).`;
      } else if (bookLang === 'zh') {
        langRules = isVi ? `[QUY TẮC NGUYÊN TÁC TIẾNG TRUNG]:
- "translatedName": Phiên âm chuẩn Hán Việt trang trọng và tự nhiên (VD: 萧炎 -> Tiêu Viêm, 林动 -> Lâm Động, 薰儿 -> Huân Nhi).` : `[QUY TẮC NGUYÊN TÁC TIẾNG TRUNG]:
- "translatedName": Phiên âm chuẩn Pinyin hoặc tên dịch phù hợp sang ${targetLangName} (VD: 萧炎 -> Xiao Yan, 林动 -> Lin Dong, 薰儿 -> Xun'er).`;
      } else if (bookLang === 'ko') {
        langRules = `[QUY TẮC NGUYÊN TÁC TIẾNG HÀN]:
- "translatedName": Phiên âm Latin hoặc tên chuẩn ${targetLangName} (VD: Sung Jinwoo, Cha Hae-in, Ryu Hayul, Shin Yuna).`;
      } else {
        langRules = `[QUY TẮC DỊCH TÊN]:
- "translatedName": Giữ nguyên tên gốc Latin hoặc phiên âm chuẩn ${targetLangName}.`;
      }

      let existingContext = '';
      const cData = window.CharacterData || CharacterData;
      if (Array.isArray(book.characterProfiles) && book.characterProfiles.length > 0) {
        const charSummary = book.characterProfiles
          .slice(0, 40)
          .map(c => {
            const canon = cData.getCharacterCanonicalName(c);
            const rules = cData.getPronounRules(c)
              .filter(r => r && r.target && (r.self || r.others))
              .map(r => `với ${r.target}: xưng "${r.self}", gọi "${r.others}"`)
              .join('; ');
            return `- ${canon}: ${c.relationship || 'Chưa rõ'} ${rules ? `| Xưng hô: [${rules}]` : ''}`;
          })
          .join('\n');
        existingContext = `\n\nCÁC NHÂN VẬT & QUY TẮC ĐÃ CÓ TRONG HỒ SƠ:\n${charSummary}\n*LƯU Ý: Giữ đúng tên chuẩn đã có ở trên. Nếu nhân vật có tiến triển mối quan hệ hoặc cách xưng hô mới, hãy cập nhật bổ sung!`;
      }

      const extractionPrompt = `Bạn là chuyên gia phân tích và biên dịch tiểu thuyết cao cấp.
Nhiệm vụ: Đọc kỹ các chương truyện sau, nhận diện các nhân vật quan trọng và thuật ngữ/địa danh cốt lõi.${existingContext}

I. DANH SÁCH CẤM (TUYỆT ĐỐI KHÔNG TRÍCH XUẤT):
1. Về Nhân vật & Xưng hô:
   - CẤM tách cùng một người thành nhiều nhân vật: Khi nhân vật lúc được gọi bằng họ, lúc gọi bằng tên, lúc gọi bằng biệt danh (VD: Sagara, Sousuke, Sacchan) -> Bắt buộc gom về một nhân vật duy nhất với tên đầy đủ chuẩn nhất.
   - CẤM lấy chức danh/danh xưng làm tên nhân vật nếu không có tên riêng thực sự (VD: "Trưởng làng", "Tông chủ", "Chủ quán", "Tiểu thư", "Trọng tài", "Lão ăn mày"...).
   - CẤM người qua đường, NPC phụ chỉ xuất hiện 1-2 câu rồi biến mất (người bán hàng, lính canh, hành khách...).
   - CẤM nhân vật chỉ được nhắc tên qua lời kể/hồi tưởng mà không có hội thoại trực tiếp.
   - CẤM nhân vật đã có trong hồ sơ nếu không có thông tin mới (quan hệ mới, xưng hô mới).
   - CẤM tự suy đoán xưng hô khi chưa có hội thoại thực tế; CẤM nhồi nhét một chuỗi từ xưng hô hỗn loạn (chỉ lấy 1-2 từ chuẩn xác nhất trong ngữ cảnh thực tế).
2. Về Glossary (Từ điển):
   - CẤM bốc cả cụm câu, đoản ngữ miêu tả, cụm có số lượng (VD: "đôi mắt sắc lẹm", "ba con ma vật", "chiếc xe từ từ lăn bánh"...). Chỉ lấy danh từ riêng/thuật ngữ ngắn (1-4 từ).
   - CẤM nhân vật đã có trong danh sách "characters" (tránh trùng lặp).
   - CẤM danh từ chung, chức danh, nghề nghiệp thông thường mà AI tự dịch đúng theo ngữ cảnh (học viện, y sư / thầy thuốc, hội trưởng, quản gia, hầu gái, quán trọ, ma pháp sư, kiếm sĩ, hiệp sĩ, thợ săn, lính canh, quái vật, ma vật, rồng, hầm ngục, kỹ năng, ma lực, bình thuốc...).
   - CẤM từ ngữ, khái niệm phổ biến trong thể loại truyện (isekai, tu tiên, hệ thống, fantasy...) mà AI hiển nhiên tự dịch chuẩn.
   - CẤM biệt danh / ngoại hiệu dễ suy luận từ ngữ cảnh; đại từ, liên từ, động từ, tính từ thông dụng.
   - CẤM tên nhân vật mà AI tự phiên âm hoặc dịch chuẩn xác không bị sai lệch.

II. QUY TẮC DỊCH TÊN THEO NGUYÊN TÁC:
${langRules}

III. QUY TẮC CHUẨN HÓA NGÔN NGỮ ĐÍCH (${targetLangName.toUpperCase()}):
1. Tất cả các trường ("translatedName", "target", "self", "others", "value") BẮT BUỘC 100% bằng ${targetLangName} (hoặc tên riêng Latin chuẩn).
2. TUYỆT ĐỐI CẤM để lại ký tự gốc (Hán tự, Hangul, Kana) hoặc ghi chú giải thích trong ngoặc như "선배 (Tiền bối)", "사장님 (Ông chủ)". Chỉ ghi duy nhất từ dịch: "tiền bối", "ông chủ".
3. Giao tiếp với người xem/khán giả: mục "target" ghi "Khán giả", "self" ghi "tôi / em", "others" ghi "quý vị khán giả / các bạn khán giả".

IV. ĐỊNH DẠNG ĐẦU RA (CHỈ TRẢ VỀ DUY NHẤT JSON HỢP LỆ):
{
  "characters": [
    {
      "originalName": "Tên gốc trong nguyên tác (VD: Seol Yuwol, 蕭炎, 相良...)",
      "translatedName": "Tên dịch chuẩn ${targetLangName} (theo mục II)",
      "gender": "Nam | Nữ | Phi giới tính / Khác",
      "relationship": "Mỗi vai trò 1 dòng ngắn gọn bắt đầu bằng '-' (CẤM viết đoạn văn dài; VD: - Nhân vật chính\\n- Bạn thân của Sagara)",
      "pronounRules": [
        {
          "target": "Tên đối tượng giao tiếp bằng ${targetLangName} (ưu tiên dùng đúng tên đã có trong hồ sơ)",
          "self": "Từ tự xưng bằng ${targetLangName} (1-2 từ chuẩn xác; VD: tôi / ta / đệ / em)",
          "others": "Từ gọi đối phương bằng ${targetLangName} (1-2 từ chuẩn xác; VD: anh / huynh / tiền bối / sư phụ)"
        }
      ],
      "note": "Ghi chú dịch thuật ngắn gọn nếu có"
    }
  ],
  "glossary": [
    {
      "key": "Từ gốc độc đáo (địa danh chính, môn phái, bảo vật riêng, thuật ngữ hệ thống riêng)",
      "value": "Nghĩa dịch hoặc phiên âm chuẩn ${targetLangName} (chỉ ghi từ dịch, không kèm chú thích)"
    }
  ]
}`;

      const scanChain = (typeof State !== 'undefined' && State.getProfilerFallbackChain)
        ? State.getProfilerFallbackChain()
        : [];

      const primaryKey = this.extractCleanKey(State.getProviderConfig(profiler.provider), profiler.apiKey);

      const scanCandidates = [
        {
          provider: profiler.provider,
          model: profiler.model,
          apiKey: primaryKey,
          customEndpoint: profiler.customEndpoint
        }
      ];

      for (const step of scanChain) {
        if (!step || !step.provider || step.provider === 'google-free') continue;
        const cfg = State.getProviderConfig(step.provider);
        const key = this.extractCleanKey(cfg, (step.provider === profiler.provider ? primaryKey : ''));
        if (key && !(step.provider === profiler.provider && step.model === profiler.model)) {
          scanCandidates.push({
            provider: step.provider,
            model: step.model,
            apiKey: key,
            customEndpoint: cfg.customEndpoint || ''
          });
        }
      }

      let parsed = null;
      let lastErr = null;

      for (let scIdx = 0; scIdx < scanCandidates.length; scIdx++) {
        const candidate = scanCandidates[scIdx];
        if (scIdx > 0 && !silent) {
          const provObj = (typeof AIConfig !== 'undefined') ? AIConfig.getProvider(candidate.provider) : {};
          const pName = provObj.name || candidate.provider.toUpperCase();
          Utils.showToast(`Đổi AI quét sang "${pName}" (${candidate.model})...`, 'info');
        }

        try {
          if (!window.electronAPI || typeof window.electronAPI.translateText !== 'function') {
            throw new Error('Chức năng gọi AI (window.electronAPI.translateText) chưa sẵn sàng.');
          }

          const rawResp = await window.electronAPI.translateText({
            text: safeCombinedText,
            sourceLang: bookLang || 'auto',
            targetLang: targetLangCode || 'vi',
            customPrompt: extractionPrompt,
            apiProvider: candidate.provider,
            apiKey: candidate.apiKey,
            model: candidate.model,
            apiEndpoint: candidate.customEndpoint || '',
            temperature: 0.1,
            thinkingLevel: s.thinkingLevel || 'low',
            reasoningEffort: s.reasoningEffort || 'low',
            safetySetting: 'BLOCK_NONE'
          });

          if (rawResp && rawResp.trim().length > 10) {
            let jsonStr = rawResp.trim();
            if (jsonStr.includes('```json')) {
              jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
            } else if (jsonStr.includes('```')) {
              jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
            }

            let tempParsed = null;
            try {
              tempParsed = JSON.parse(jsonStr);
            } catch (e) {
              const start = jsonStr.indexOf('{');
              const end = jsonStr.lastIndexOf('}');
              if (start !== -1 && end !== -1 && end > start) {
                try {
                  tempParsed = JSON.parse(jsonStr.substring(start, end + 1));
                } catch (e2) {
                  const sanitized = jsonStr.substring(start, end + 1).replace(/,\s*([}\]])/g, '$1');
                  try {
                    tempParsed = JSON.parse(sanitized);
                  } catch (e3) {
                    console.warn('[Profiler] Lỗi parse JSON từ phản hồi AI:', e, jsonStr);
                  }
                }
              }
            }

            if (tempParsed && Array.isArray(tempParsed.characters) && tempParsed.characters.length > 0) {
              parsed = tempParsed;
              break;
            } else if (tempParsed && Array.isArray(tempParsed.characters)) {
              console.warn(`[Profiler] Model ${candidate.model} trả về 0 nhân vật. Đang thử tiếp...`);
            }
          }
        } catch (callErr) {
          console.warn(`[Profiler] Candidate failed: ${candidate.provider} (${candidate.model})`, callErr);
          lastErr = callErr;
        }
      }

      if (!parsed) {
        throw new Error(lastErr ? `Lỗi quét AI: ${lastErr.message}` : 'AI không trích xuất được danh sách nhân vật hợp lệ.');
      }

      if (!Array.isArray(parsed.characters)) {
        parsed.characters = [];
      }
      if (!Array.isArray(parsed.glossary)) {
        parsed.glossary = [];
      }

      if (!Array.isArray(book.characterProfiles)) book.characterProfiles = [];

      let addedCharCount = 0;
      let updatedCharCount = 0;

      parsed.characters.forEach(item => {
        const originalName = (item.originalName || item.speaker || '').trim();
        const translatedName = (item.translatedName || item.listener || '').trim();
        if (!originalName && !translatedName) return;

        let incomingRules = [];
        if (Array.isArray(item.pronounRules) && item.pronounRules.length > 0) {
          incomingRules = item.pronounRules.map(r => {
            let t = (r.target || '').trim();
            if (/^[\uac00-\ud7af\u1100-\u11ff\u4e00-\u9fff\u3040-\u30ff\s()]+$/.test(t)) {
              const tr = cData.cleanToTargetLanguage(t);
              if (tr && tr !== t) t = tr.charAt(0).toUpperCase() + tr.slice(1);
            }
            return {
              target: t,
              self: cData.cleanToTargetLanguage(r.self || ''),
              others: cData.cleanToTargetLanguage(r.others || '')
            };
          }).filter(r => r.target || r.self || r.others);
        } else if (item.pronouns || item.listener) {
          const { self, others } = cData.parsePronounsPair(item.pronouns || '');
          let t = (item.listener || '').trim();
          if (/^[\uac00-\ud7af\u1100-\u11ff\u4e00-\u9fff\u3040-\u30ff\s()]+$/.test(t)) {
            const tr = cData.cleanToTargetLanguage(t);
            if (tr && tr !== t) t = tr.charAt(0).toUpperCase() + tr.slice(1);
          }
          incomingRules.push({
            target: t,
            self: cData.cleanToTargetLanguage(self || ''),
            others: cData.cleanToTargetLanguage(others || '')
          });
        }

        const existing = book.characterProfiles.find(c => {
          const cOrig = (c.originalName || c.speaker || '').trim().toLowerCase();
          const cTrans = (c.translatedName || c.listener || '').trim().toLowerCase();
          const inOrig = (originalName || '').toLowerCase();
          const inTrans = (translatedName || '').toLowerCase();

          // NẾU CẢ 2 ĐỀU CÓ TÊN GỐC VÀ KHÁC NHAU: TUYỆT ĐỐI KHÔNG GỘP
          if (inOrig && cOrig && inOrig !== cOrig) {
            return false;
          }

          const origMatch = inOrig && cOrig === inOrig;
          const transMatch = inTrans && cTrans === inTrans;
          return origMatch || transMatch || (inOrig && cTrans === inOrig);
        });

        if (existing) {
          let changed = false;

          if (translatedName && (!existing.translatedName || existing.translatedName === existing.originalName)) {
            existing.translatedName = translatedName;
            existing.listener = translatedName;
            changed = true;
          }

          if (bookLang === 'ja' && item.translatedName && item.translatedName !== existing.translatedName) {
            existing.translatedName = item.translatedName;
            existing.listener = item.translatedName;
            changed = true;
          }

          const newRel = (item.relationship || '').trim();
          if (newRel) {
            const mergedRel = cData.cleanAndConsolidateRelationship(
              existing.relationship ? `${existing.relationship}\n${newRel}` : newRel
            );
            if (mergedRel && mergedRel !== existing.relationship) {
              existing.relationship = mergedRel;
              changed = true;
            }
          }

          incomingRules.forEach(inRule => {
            if (!inRule.target) return;
            const partner = cData.findPartnerCharacter(existing, inRule.target);
            if (partner) {
              inRule.target = cData.getCharacterCanonicalName(partner);
            }
          });

          const existingRules = cData.getPronounRules(existing);
          incomingRules.forEach(inRule => {
            const matchRule = existingRules.find(r => r.target && inRule.target && cData.areTargetsEquivalent(r.target, inRule.target));
            if (matchRule) {
              if (inRule.target && (
                !matchRule.target ||
                inRule.target.length > matchRule.target.length ||
                (inRule.target.includes('(') && !matchRule.target.includes('('))
              )) {
                matchRule.target = inRule.target;
              }
              if (inRule.self) {
                const s1 = cData.splitTerms(matchRule.self || '');
                const s2 = cData.splitTerms(inRule.self || '');
                const dedupedSelf = cData.dedupeTerms([...s1, ...s2]);
                matchRule.self = dedupedSelf.slice(0, 2).join(' / ');
                changed = true;
              }
              if (inRule.others) {
                const o1 = cData.splitTerms(matchRule.others || '');
                const o2 = cData.splitTerms(inRule.others || '');
                const dedupedOthers = cData.dedupeTerms([...o1, ...o2]);
                matchRule.others = dedupedOthers.slice(0, 2).join(' / ');
                changed = true;
              }
            } else if (inRule.target || inRule.self || inRule.others) {
              if (existingRules.length === 1 && !existingRules[0].target && !existingRules[0].self && !existingRules[0].others) {
                existingRules[0] = inRule;
              } else {
                existingRules.push(inRule);
              }
              changed = true;
            }
          });
          existing.pronounRules = cData.consolidatePronounRules(existingRules);
          cData.syncPronounsString(existing);

          const newNote = (item.note || '').trim();
          if (newNote && (!existing.note || !existing.note.toLowerCase().includes(newNote.toLowerCase()))) {
            existing.note = existing.note ? `${existing.note}\n- ${newNote}` : newNote;
            changed = true;
          }

          if (item.gender && (!existing.gender || existing.gender === 'Phi giới tính / Khác')) {
            existing.gender = item.gender;
            changed = true;
          }

          if (changed) updatedCharCount++;
        } else {
          const canonicalTarget = translatedName || originalName;
          incomingRules.forEach(inRule => {
            if (!inRule.target) return;
            const partner = cData.findPartnerCharacter(null, inRule.target);
            if (partner) {
              inRule.target = cData.getCharacterCanonicalName(partner);
            }
          });

          const newChar = {
            id: `char_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            enabled: true,
            originalName,
            translatedName: translatedName || originalName,
            speaker: originalName,
            listener: canonicalTarget,
            gender: item.gender || 'Phi giới tính / Khác',
            relationship: cData.cleanAndConsolidateRelationship(item.relationship || ''),
            pronounRules: cData.consolidatePronounRules(incomingRules),
            note: item.note || ''
          };
          cData.syncPronounsString(newChar);
          book.characterProfiles.push(newChar);
          addedCharCount++;
        }
      });

      let addedGlossaryCount = 0;
      if (Array.isArray(parsed.glossary) && parsed.glossary.length > 0) {
        if (!Array.isArray(book.glossary)) book.glossary = [];
        const existingKeys = new Set(book.glossary.map(g => (g.key || '').trim().toLowerCase()));
        const existingCharKeys = new Set();
        if (Array.isArray(book.characterProfiles)) {
          book.characterProfiles.forEach(c => {
            if (c.originalName) existingCharKeys.add(c.originalName.trim().toLowerCase());
            if (c.translatedName) existingCharKeys.add(c.translatedName.trim().toLowerCase());
            if (c.speaker) existingCharKeys.add(c.speaker.trim().toLowerCase());
            if (c.listener) existingCharKeys.add(c.listener.trim().toLowerCase());
          });
        }

        parsed.glossary.forEach(g => {
          const k = (g.key || g.original || '').trim();
          const rawVal = (g.value || g.translated || '').trim();
          const v = this.cleanGlossaryValue(rawVal, k);
          const kLower = k.toLowerCase();
          if (k && v && !existingKeys.has(kLower) && !existingCharKeys.has(kLower)) {
            book.glossary.push({
              key: k,
              value: v,
              enabled: true
            });
            existingKeys.add(kLower);
            addedGlossaryCount++;
          }
        });
        if (window.BookGlossary) window.BookGlossary.render();
      }

      State.saveBooks();
      if (typeof State.saveCurrentBook === 'function') {
        State.saveCurrentBook(true);
      }
      if (window.CharacterProfile && typeof window.CharacterProfile.render === 'function') {
        window.CharacterProfile.render();
      }
      if (window.BookGlossary && typeof window.BookGlossary.render === 'function') {
        window.BookGlossary.render();
      }

      let toastMsg = `AI đã đọc xong! `;
      if (addedCharCount > 0) toastMsg += `Thêm mới ${addedCharCount} nhân vật. `;
      if (updatedCharCount > 0) toastMsg += `Cập nhật tiến triển cho ${updatedCharCount} nhân vật cũ. `;
      if (addedGlossaryCount > 0) toastMsg += `Thêm ${addedGlossaryCount} từ điển (thuật ngữ/địa danh).`;
      if (addedCharCount === 0 && updatedCharCount === 0 && addedGlossaryCount === 0) {
        toastMsg = 'AI đã đọc xong! Các nhân vật & thuật ngữ đều đã được cập nhật đầy đủ.';
      }

      if (!silent) {
        Utils.showToast(toastMsg, 'success');
      } else if (addedCharCount > 0 || updatedCharCount > 0 || addedGlossaryCount > 0) {
        const summary = [];
        if (addedCharCount > 0) summary.push(`+${addedCharCount} nhân vật`);
        if (updatedCharCount > 0) summary.push(`↺${updatedCharCount} vai trò`);
        if (addedGlossaryCount > 0) summary.push(`+${addedGlossaryCount} từ điển`);
        Utils.showToast(`[${targetChapters[0]?.title || 'Chương'}] Đã tìm thấy: ${summary.join(', ')}`, 'info');
      }

      return { addedCharCount, updatedCharCount, addedGlossaryCount };
    } catch (err) {
      console.error('Error during AI character scan:', err);
      if (!silent) {
        Utils.showToast(`Lỗi phân tích: ${err.message}`, 'error');
      }
      throw err;
    } finally {
      this.isScanning = false;
      const loadingEl = document.getElementById('characterProfileAiLoading');
      const scanBtn = document.getElementById('aiScanCharactersBtn');
      if (loadingEl) loadingEl.classList.add('hidden');
      if (scanBtn) {
        scanBtn.disabled = false;
        scanBtn.innerHTML = '<span>Quét nhân vật AI</span>';
      }
      releaseLock();
    }
  }
};

if (typeof window !== 'undefined') {
  window.CharacterScanner = CharacterScanner;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CharacterScanner;
}
