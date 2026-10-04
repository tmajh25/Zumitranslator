/**
 * ZumiTranslator - Dedicated Glossary AI Scanner
 * Handles terminology extraction, language-specific prompting, AI execution, and deduplication
 */

const GlossaryScanner = {
  isScanning: false,

  async scanAndFill(customChapters = null, controller = null) {
    if (this.isScanning) return;

    const book = State.currentBook;
    if (!book) {
      Utils.showToast('Vui lòng mở một truyện trước khi phân tích.', 'warning');
      return;
    }

    const allChapters = State.chapters || [];
    if (allChapters.length === 0) {
      Utils.showToast('Truyện chưa có chương nào để AI đọc.', 'warning');
      return;
    }

    const s = State.settings || {};

    let profiler;
    try {
      profiler = window.CharacterProfile ? CharacterProfile.getProfilerConfig() : null;
      if (!profiler) throw new Error('Không tìm thấy cấu hình profiler AI.');
    } catch (err) {
      Utils.showToast(err.message, 'warning');
      return;
    }

    // Determine chapters to analyze: priority to customChapters -> untranslated selected -> untranslated all -> selected -> first 3 chapters
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
    if (targetChapters.length > 5) {
      targetChapters = targetChapters.slice(0, 5);
    }

    let combinedText = '';
    if (targetChapters.length === 1) {
      const ch = targetChapters[0];
      const text = (ch.content || '').trim();
      combinedText = `=== CHƯƠNG: ${ch.title} ===\n${text.slice(0, 60000)}`;
    } else {
      for (const ch of targetChapters) {
        const text = ch.content || '';
        combinedText += `\n\n=== CHƯƠNG: ${ch.title} ===\n${text.slice(0, 15000)}`;
        if (combinedText.length >= 60000) break;
      }
    }

    if (!combinedText.trim()) {
      Utils.showToast('Nội dung các chương trống, không thể phân tích.', 'warning');
      return;
    }

    // Tinh giản thông minh cho Scanner: Lọc bỏ các đoạn miêu tả cấm kỵ/giải phẫu sắc dục để AI không bao giờ bị chặn PROHIBITED_CONTENT
    let safeCombinedText = (window.CharacterScanner && typeof window.CharacterScanner.buildSafeScannerText === 'function')
      ? window.CharacterScanner.buildSafeScannerText(targetChapters, 3500)
      : '';
    if (!safeCombinedText || safeCombinedText.length < 50) {
      safeCombinedText = combinedText.slice(0, 3500);
    }

    // Determine language of the novel
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
- Tên nhân vật, địa danh Nhật: BẮT BUỘC giữ phiên âm chuẩn Romaji / Katakana tự nhiên của Nhật (VD: 相良 -> Sagara, 須藤 -> Sudo, さっちゃん -> Sacchan, 美咲 -> Misaki).
- TUYỆT ĐỐI CẤM DỊCH TÊN TIẾNG NHẬT THÀNH ÂM HÁN VIỆT (không dịch thành Tương Lạc, Tu Đằng...).
- Chiêu thức / Thuật ngữ: Dịch nghĩa tự nhiên hoặc phiên âm Katakana/Romaji thích hợp theo bối cảnh.`;
    } else if (bookLang === 'zh') {
      langRules = isVi ? `[QUY TẮC NGUYÊN TÁC TIẾNG TRUNG]:
- Tên nhân vật, địa danh, tông môn, công pháp, cảnh giới: Phiên âm Hán Việt chuẩn xác, trang trọng và tự nhiên (VD: 萧炎 -> Tiêu Viêm, 云岚宗 -> Vân Lam Tông, 斗皇 -> Đấu Hoàng, 乌坦城 -> Ô Thản Thành).` : `[QUY TẮC NGUYÊN TÁC TIẾNG TRUNG]:
- Tên nhân vật, địa danh, tông môn, công pháp, cảnh giới: Phiên âm Pinyin hoặc dịch nghĩa chuẩn sang ${targetLangName} (VD: 萧炎 -> Xiao Yan, 云岚宗 -> Yunlan Sect, 斗皇 -> Dou Huang, 乌坦城 -> Wutan City).`;
    } else if (bookLang === 'ko') {
      langRules = `[QUY TẮC NGUYÊN TÁC TIẾNG HÀN]:
- Tên nhân vật, địa danh: Phiên âm Latin hoặc tên chuẩn ${targetLangName} (VD: Sung Jinwoo, Cha Hae-in, Ryu Hayul, Shin Yuna).`;
    } else {
      langRules = `[QUY TẮC DỊCH THUẬT NGỮ & TÊN RIÊNG]:
- Giữ nguyên tên riêng Latin hoặc chuyển tự/phiên âm chuẩn ${targetLangName}.`;
    }

    this.isScanning = true;
    if (controller) controller.isScanning = true;

    const loadingEl = document.getElementById('bookGlossaryAiLoading');
    const loadingText = document.getElementById('glossaryAiLoadingText');
    const scanBtn = document.getElementById('aiScanGlossaryBtn');

    if (loadingEl) loadingEl.classList.remove('hidden');
    if (loadingText) loadingText.textContent = `AI (${profiler.name}) đang đọc ${targetChapters.length} chương và dò tìm thuật ngữ, địa danh, tên nhân vật...`;
    if (scanBtn) {
      scanBtn.disabled = true;
      scanBtn.textContent = '⏳ Đang dò tìm...';
    }

    const prompt = `Bạn là chuyên gia dịch thuật tiểu thuyết. Đọc kỹ văn bản truyện dưới đây và trích xuất danh từ riêng CỐT LÕI mà nếu dịch sai sẽ làm lệch mạch truyện.

I. DANH SÁCH CẤM (TUYỆT ĐỐI KHÔNG LẤY VÀO GLOSSARY):
- CẤM bốc cả cụm câu, đoản ngữ miêu tả, cụm có kèm số lượng (VD: "đôi mắt sắc lẹm", "ba con ma vật", "chiếc xe từ từ lăn bánh"...). Chỉ lấy danh từ riêng/thuật ngữ ngắn gọn (1-4 từ).
- CẤM lấy chức danh/danh xưng chung làm thuật ngữ (VD: "Trưởng làng", "Tông chủ", "Chủ quán", "Tiểu thư", "Trọng tài"...).
- CẤM danh từ chung, chức danh, nghề nghiệp thông thường mà AI tự dịch đúng theo ngữ cảnh (học viện, y sư / thầy thuốc, hội trưởng, quản gia, hầu gái, quán trọ, ma pháp sư, kiếm sĩ, hiệp sĩ, thợ săn, lính canh, quái vật, ma vật, rồng, hầm ngục, kỹ năng, ma lực, bình thuốc...).
- CẤM nhân vật phụ qua đường chỉ nhắc tên 1-2 lần rồi biến mất, không có vai trò hay thoại trong cốt truyện.
- CẤM từ ngữ, khái niệm phổ biến trong thể loại truyện (isekai, tu tiên, hệ thống, fantasy...) mà AI hiển nhiên tự dịch chuẩn.
- CẤM biệt danh / ngoại hiệu dễ suy luận từ ngữ cảnh; đại từ, liên từ, động từ, tính từ thông dụng.
- CẤM tên nhân vật mà AI tự phiên âm hoặc dịch chuẩn xác không bị sai lệch.

II. CHỈ LẤY CÁC MỤC THỰC SỰ ĐỘC ĐÁO & ĐẶC TRƯNG CỦA TRUYỆN:
1. Địa danh & Tổ chức CHÍNH YẾU mang tên riêng độc nhất (tông môn, thành trì, vương quốc, gia tộc, học viện độc đáo).
2. Thuật ngữ hệ thống ĐỘC QUYỀN của truyện (cảnh giới tu luyện riêng, hệ thống sức mạnh riêng, đơn vị tiền tệ riêng mà AI không thể tự suy luận đúng).
3. Bảo vật / Vũ khí / Sinh vật mang tên riêng gắn liền với nhân vật chính hoặc mạch truyện.
4. Tên nhân vật QUAN TRỌNG có tên phiên âm đặc biệt cần cố định cách viết.

III. QUY TẮC NGUYÊN TÁC:
${langRules}

IV. QUY TẮC CHUẨN HÓA CHO "value" (Dịch nghĩa chuẩn):
1. BẮT BUỘC 100% bằng ${targetLangName} (hoặc tên riêng Latin chuẩn).
2. TUYỆT ĐỐI CẤM chứa ký tự gốc (Hán tự, Hangul, Kana).
3. TUYỆT ĐỐI CẤM ghi chú thích, cấp bậc hoặc giải thích trong ngoặc (chỉ ghi duy nhất từ dịch thay thế).

V. ĐỊNH DẠNG ĐẦU RA (CHỈ TRẢ VỀ DUY NHẤT MÃ JSON HỢP LỆ):
{
  "glossary": [
    { "key": "...", "value": "..." }
  ]
}`;

    const scanChain = (typeof State !== 'undefined' && State.getProfilerFallbackChain)
      ? State.getProfilerFallbackChain()
      : [];

    const primaryKey = (typeof CharacterScanner !== 'undefined' && CharacterScanner.extractCleanKey)
      ? CharacterScanner.extractCleanKey(State.getProviderConfig(profiler.provider), profiler.apiKey)
      : profiler.apiKey;

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
      const key = (typeof CharacterScanner !== 'undefined' && CharacterScanner.extractCleanKey)
        ? CharacterScanner.extractCleanKey(cfg, (step.provider === profiler.provider ? primaryKey : ''))
        : (cfg.apiKey || '');
      if (key && !(step.provider === profiler.provider && step.model === profiler.model)) {
        scanCandidates.push({
          provider: step.provider,
          model: step.model,
          apiKey: key,
          customEndpoint: cfg.customEndpoint || ''
        });
      }
    }

    try {
      let parsed = null;
      let lastErr = null;

      for (let scIdx = 0; scIdx < scanCandidates.length; scIdx++) {
        const candidate = scanCandidates[scIdx];
        if (scIdx > 0) {
          const provObj = (typeof AIConfig !== 'undefined') ? AIConfig.getProvider(candidate.provider) : {};
          const pName = provObj.name || candidate.provider.toUpperCase();
          Utils.showToast(`Đổi AI dò thuật ngữ sang "${pName}" (${candidate.model})...`, 'info');
        }

        try {
          const rawResp = await window.electronAPI.translateText({
            text: safeCombinedText,
            sourceLang: s.sourceLang || 'auto',
            targetLang: s.targetLang || 'vi',
            customPrompt: prompt,
            apiProvider: candidate.provider,
            apiKey: candidate.apiKey,
            apiEndpoint: candidate.customEndpoint || '',
            model: candidate.model,
            temperature: 0.2,
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
                } catch (e2) {}
              }
            }

            if (tempParsed && Array.isArray(tempParsed.glossary) && tempParsed.glossary.length > 0) {
              parsed = tempParsed;
              break;
            } else if (tempParsed && Array.isArray(tempParsed.glossary)) {
              console.warn(`[Glossary] Model ${candidate.model} trả về 0 thuật ngữ. Đang thử tiếp...`);
            }
          }
        } catch (callErr) {
          console.warn(`[Glossary] Candidate failed: ${candidate.provider} (${candidate.model})`, callErr);
          lastErr = callErr;
        }
      }

      if (!parsed || !Array.isArray(parsed.glossary)) {
        throw new Error(lastErr ? `Lỗi dò thuật ngữ: ${lastErr.message}` : 'Không trích xuất được danh sách thuật ngữ hợp lệ.');
      }

      if (!Array.isArray(book.glossary)) book.glossary = [];
      const existingKeys = new Set(book.glossary.map(g => (g.key || g.original || '').trim().toLowerCase()));

      const existingCharKeys = new Set();
      if (Array.isArray(book.characterProfiles)) {
        book.characterProfiles.forEach(c => {
          if (c.originalName) existingCharKeys.add(c.originalName.trim().toLowerCase());
          if (c.translatedName) existingCharKeys.add(c.translatedName.trim().toLowerCase());
        });
      }

      const cleanVal = (val, key) => {
        if (controller && typeof controller.cleanGlossaryValue === 'function') {
          return controller.cleanGlossaryValue(val, key);
        }
        return (val || '').replace(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, '').trim();
      };

      let addedCount = 0;
      parsed.glossary.forEach(g => {
        const k = (g.key || g.original || '').trim();
        const rawVal = (g.value || g.translated || '').trim();
        const v = cleanVal(rawVal, k);
        const kLower = k.toLowerCase();
        if (k && v && !existingKeys.has(kLower) && !existingCharKeys.has(kLower)) {
          book.glossary.push({
            key: k,
            value: v,
            enabled: true
          });
          existingKeys.add(kLower);
          addedCount++;
        }
      });

      State.saveBooks();
      if (typeof State.saveCurrentBook === 'function') {
        State.saveCurrentBook(true);
      }
      if (controller && typeof controller.render === 'function') {
        controller.render();
      } else if (window.BookGlossary && typeof window.BookGlossary.render === 'function') {
        window.BookGlossary.render();
      }

      Utils.showToast(`AI đã dò và thêm ${addedCount} thuật ngữ, địa danh, tên nhân vật vào bảng Glossary!`, 'success');
    } catch (err) {
      console.error('Error during AI glossary scan:', err);
      Utils.showToast(`Lỗi phân tích: ${err.message}`, 'error');
    } finally {
      this.isScanning = false;
      if (controller) controller.isScanning = false;
      if (loadingEl) loadingEl.classList.add('hidden');
      if (scanBtn) {
        scanBtn.disabled = false;
        scanBtn.innerHTML = '<span>Quét từ điển AI</span>';
      }
    }
  }
};

if (typeof window !== 'undefined') {
  window.GlossaryScanner = GlossaryScanner;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GlossaryScanner;
}
