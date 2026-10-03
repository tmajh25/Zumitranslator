/**
 * TRANSLATION PROGRESS & LANGUAGE DETECTOR (POWERED BY GOOGLE)
 * Leverages Google's Auto-Detection API to detect language and evaluate translation progress
 * against the target language (default: Vietnamese / tool language).
 */

const ProgressDetector = {
  // Mapping Google language codes to Vietnamese display names and flags
  LANG_MAP: {
    'vi': { name: 'Tiếng Việt', short: 'vi', flag: '🇻🇳' },
    'zh-CN': { name: 'Tiếng Trung (Giản thể)', short: 'cn', flag: '🇨🇳' },
    'zh-TW': { name: 'Tiếng Trung (Phồn thể)', short: 'cn', flag: '🇨🇳' },
    'zh': { name: 'Tiếng Trung', short: 'cn', flag: '🇨🇳' },
    'ja': { name: 'Tiếng Nhật', short: 'ja', flag: '🇯🇵' },
    'ko': { name: 'Tiếng Hàn', short: 'kr', flag: '🇰🇷' },
    'en': { name: 'Tiếng Anh', short: 'eng', flag: '🇬🇧' },
    'th': { name: 'Tiếng Thái', short: 'th', flag: '🇹🇭' },
    'ru': { name: 'Tiếng Nga', short: 'ru', flag: '🇷🇺' },
    'fr': { name: 'Tiếng Pháp', short: 'fr', flag: '🇫🇷' },
    'de': { name: 'Tiếng Đức', short: 'de', flag: '🇩🇪' },
    'es': { name: 'Tiếng Tây Ban Nha', short: 'es', flag: '🇪🇸' }
  },

  // Color tokens for GitHub-style language breakdown bars
  LANG_COLORS: {
    'vi': '#22c55e', // Vibrant emerald green (Translated)
    'ko': '#3178c6', // Clean blue (like TypeScript in GitHub)
    'zh': '#f1e05a', // Warm gold / yellow (like JavaScript in GitHub)
    'ja': '#e11d48', // Crimson rose
    'en': '#a855f7', // Purple (like CSS in GitHub)
    'ru': '#06b6d4', // Cyan
    'th': '#14b8a6', // Teal
    'fr': '#38bdf8', // Sky blue
    'de': '#fb923c', // Orange
    'es': '#f97316', // Orange-red
    'other': '#94a3b8' // Slate gray
  },

  // Regex patterns for residual foreign character check
  RESIDUAL_PATTERNS: {
    cjk: /[\u4e00-\u9fff\u3400-\u4dbf]/g,
    japanese: /[\u3040-\u309f\u30a0-\u30ff]/g,
    korean: /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/g,
    thai: /[\u0e00-\u0e7f]/g,
    vietnameseMarks: /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi
  },

  /**
   * Remove or mask translator notes, explanations, and bracketed vocabulary definitions
   * e.g. "(Note: 청월 (靑月) : ...)", "(Note: đệ tử đời thứ hai)", "“Thiên Niên Hoa”(Note: (千): 1 ngàn...)"
   */
  maskTranslatorNotes(text) {
    if (!text || typeof text !== 'string') return '';
    // 1. Strip notes starting with Note:, Chú thích:, etc. even with nested parentheses inside
    let cleaned = text.replace(/(\(|\[|\{)\s*(Note|Chú thích|TN|Ghi chú|Lời dịch giả)[\s\S]*?\)(?=\s|[.,!?\n\r]|$)/gi, ' ');
    // 2. Standalone Asian annotations in brackets like (청월), (靑月), (千), (年), (花)
    cleaned = cleaned.replace(/(\(|\[)\s*[\u4e00-\u9fff\uac00-\ud7af\u3040-\u30ff\u1100-\u11ff\u3130-\u318f\s]+\s*(\)|\])/g, ' ');
    // 3. Webnovel glossary lines like [Lên trên] Jangju (장주) : chủ tiệm...
    cleaned = cleaned.replace(/\[Lên trên\][^\n\r]*/gi, ' ');
    return cleaned;
  },

  /**
   * Analyze exact language ratio / percentage breakdown for a given text
   * Returns target language percent, dominant language, and list of languages with their percentages
   */
  getLanguageBreakdown(text, targetLang = 'vi') {
    if (!text || typeof text !== 'string') {
      return {
        targetPercent: 0,
        dominantLang: 'empty',
        dominantFlag: '⚪',
        dominantName: 'Trống',
        breakdown: [],
        badgeClass: 'empty',
        badgeText: 'Trống',
        badgeHtml: '<span class="lang-ratio-badge empty">Trống</span>',
        summaryText: 'Chương trống'
      };
    }

    const clean = text.replace(/\[IMG:[^\]]+\]/g, '').replace(/<[^>]+>/g, '').trim();
    if (!clean) {
      if (text.includes('[IMG:')) {
        return {
          targetPercent: 100,
          dominantLang: 'img',
          dominantFlag: '🖼️',
          dominantName: 'Minh họa',
          breakdown: [{ lang: 'img', percent: 100, flag: '🖼️', name: 'Minh họa', color: '#10b981' }],
          badgeClass: 'done',
          badgeText: 'Minh họa',
          badgeHtml: '<span class="lang-ratio-badge done">Minh họa</span>',
          summaryText: 'Hình ảnh / Minh họa'
        };
      }
      return {
        targetPercent: 0,
        dominantLang: 'empty',
        dominantFlag: '⚪',
        dominantName: 'Trống',
        breakdown: [],
        badgeClass: 'empty',
        badgeText: 'Trống',
        badgeHtml: '<span class="lang-ratio-badge empty">Trống</span>',
        summaryText: 'Chương trống'
      };
    }

    const normTarget = (targetLang || 'vi').toLowerCase().split('-')[0];

    // Non-Latin Asian & Cyrillic scripts (evaluated on real text to detect all languages in the story)
    const jpCount = (clean.match(/[\u3040-\u30ff]/g) || []).length;
    const krCount = (clean.match(/[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\ud7b0-\ud7ff]/g) || []).length;
    const ruCount = (clean.match(/[\u0400-\u04ff]/g) || []).length;
    const thCount = (clean.match(/[\u0e00-\u0e7f]/g) || []).length;
    const cjkCount = (clean.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;

    // Latin character matches
    const latinMatches = clean.match(/[a-zA-Z\u00C0-\u024F\u1EA0-\u1EF9]/g) || [];
    const latinCharCount = latinMatches.length;

    // Vietnamese specific markers
    const viUnique = (clean.match(/[đĐơờớởỡợưừứửữựăằắẳẵặảãạẻẽẹỉĩịỏõọủũụỷỹỵầấẩẫậềếểễệồốổỗộ]/gi) || []).length;
    const viVowels = (clean.match(/[àáèéìíòóùúỳýâêô]/gi) || []).length;
    const viWords = (clean.match(/\b(và|của|là|có|được|không|một|người|trong|đã|để|với|này|những|các|cho|tại|như|nhưng|khi|anh|cô|hắn|cậu|ông|bà|mình|tôi|nói|thấy|biết|lại|ra|vào|lên|xuống|chương|tiếng|nơi|kia|thế|mà|thì|nếu|đang|vừa|rồi|sớm|trở|thành|đám|lũ|chúng|nó)\b/gi) || []).length;
    const viScore = (viUnique * 4) + (viWords * 2) + Math.min(viVowels, 3);
    const viUnaccented = (clean.match(/\b(chuong|tap|phan|hoi|quyen|ngoai truyen|loi bat|muc luc|tac gia|dich gia|thien|nien|hoa)\b/gi) || []).length;

    // Distinctive English stop words check (strict genuine English vocabulary only, no single-letter words)
    const enWords = (clean.match(/\b(the|and|of|that|with|this|from|have|they|which|were|their|been|when|what|about|into|than|them|could|would|should|because|without|through|between)\b/gi) || []).length;

    let viEffective = 0;
    let otherLatinEffective = 0;

    if (viScore >= 4 || (latinCharCount > 0 && (viUnique > 0 || viWords > 0 || viUnaccented > 0))) {
      // Vietnamese is the primary Latin language
      if (enWords >= 3) {
        otherLatinEffective = enWords * 4;
        viEffective = Math.max(0, latinCharCount - otherLatinEffective);
      } else {
        viEffective = latinCharCount;
      }
    } else if (enWords >= 2 || (latinCharCount > 25 && enWords >= 1)) {
      otherLatinEffective = latinCharCount;
    } else if (normTarget === 'vi') {
      viEffective = latinCharCount;
    } else {
      otherLatinEffective = latinCharCount;
    }

    // Weight: 1 Asian character has higher semantic density than 1 Latin letter (~3x)
    const krEffective = krCount * 3.0;
    const zhEffective = (jpCount === 0 ? cjkCount : 0) * 3.0;
    const jpEffective = (jpCount + (jpCount > 0 ? cjkCount : 0)) * 3.0;
    const ruEffective = ruCount;
    const thEffective = thCount * 2;

    const totalEffective = viEffective + otherLatinEffective + krEffective + zhEffective + jpEffective + ruEffective + thEffective;

    if (totalEffective === 0) {
      return {
        targetPercent: 0,
        dominantLang: 'empty',
        dominantFlag: '⚪',
        dominantName: 'Trống',
        breakdown: [],
        badgeClass: 'empty',
        badgeText: 'Trống',
        badgeHtml: '<span class="lang-ratio-badge empty">Trống</span>',
        summaryText: 'Chương trống'
      };
    }

    // Extract sample words/characters for each non-target language
    const krMatches = clean.match(/[\uac00-\ud7af]{1,}/g) || [];
    const krSamples = Array.from(new Set(krMatches)).slice(0, 5);

    const zhMatches = clean.match(/[\u4e00-\u9fff]{1,}/g) || [];
    const zhSamples = Array.from(new Set(zhMatches)).slice(0, 5);

    const jpMatches = clean.match(/[\u3040-\u30ff]{2,}/g) || clean.match(/[\u3040-\u30ff]/g) || [];
    const jpSamples = Array.from(new Set(jpMatches)).slice(0, 5);

    const enMatches = clean.match(/\b(the|and|of|that|with|this|from|have|they|which|were|their|been|when|what|about|into|than|them|could|would|should|because|without|through|between)\b/gi) || [];
    const enSamples = Array.from(new Set(enMatches.map(w => w.toLowerCase()))).slice(0, 5);

    const ruMatches = clean.match(/[\u0400-\u04ff]{2,}/g) || [];
    const ruSamples = Array.from(new Set(ruMatches)).slice(0, 5);

    const thMatches = clean.match(/[\u0e00-\u0e7f]{2,}/g) || [];
    const thSamples = Array.from(new Set(thMatches)).slice(0, 5);

    const langRaw = [
      { lang: 'vi', count: viEffective, name: 'Tiếng Việt', flag: '🇻🇳', color: this.LANG_COLORS['vi'], samples: [] },
      { lang: 'ko', count: krEffective, name: 'Tiếng Hàn', flag: '🇰🇷', color: this.LANG_COLORS['ko'], samples: krSamples },
      { lang: 'zh', count: zhEffective, name: 'Tiếng Trung', flag: '🇨🇳', color: this.LANG_COLORS['zh'], samples: zhSamples },
      { lang: 'ja', count: jpEffective, name: 'Tiếng Nhật', flag: '🇯🇵', color: this.LANG_COLORS['ja'], samples: jpSamples },
      { lang: 'en', count: otherLatinEffective, name: 'Tiếng Anh', flag: '🇬🇧', color: this.LANG_COLORS['en'], samples: enSamples },
      { lang: 'ru', count: ruEffective, name: 'Tiếng Nga', flag: '🇷🇺', color: this.LANG_COLORS['ru'], samples: ruSamples },
      { lang: 'th', count: thEffective, name: 'Tiếng Thái', flag: '🇹🇭', color: this.LANG_COLORS['th'], samples: thSamples }
    ];

    let activeLangs = langRaw
      .filter(l => l.count > 0)
      .map(l => {
        const rawPct = (l.count / totalEffective) * 100;
        return {
          ...l,
          percent: Number(rawPct.toFixed(1))
        };
      })
      .filter(l => l.percent > 0)
      .sort((a, b) => b.percent - a.percent);

    if (activeLangs.length === 1) {
      activeLangs[0].percent = 100;
    } else if (activeLangs.length > 1) {
      const sum = activeLangs.reduce((acc, curr) => acc + curr.percent, 0);
      const diff = Number((100 - sum).toFixed(1));
      if (Math.abs(diff) > 0 && Math.abs(diff) < 2) {
        activeLangs[0].percent = Number((activeLangs[0].percent + diff).toFixed(1));
      }
    }

    const targetItem = activeLangs.find(l => l.lang === normTarget);
    let targetPercent = targetItem ? targetItem.percent : 0;
    const dominant = activeLangs[0] || { lang: 'unknown', name: 'Không rõ', flag: '🌐', percent: 100, color: '#94a3b8', samples: [] };

    let badgeClass = 'done';
    if (targetPercent >= 85) {
      badgeClass = 'done';
    } else if (targetPercent >= 10) {
      badgeClass = 'partial';
    } else {
      badgeClass = 'untranslated';
    }

    // Hiển thị đầy đủ tất cả ngôn ngữ phát hiện được trên huy hiệu với tên viết tắt ngắn gọn (vi, eng, kr, cn...)
    const getShort = (lang) => this.LANG_MAP[lang]?.short || lang;
    let badgeText = '';
    if (activeLangs.length === 1) {
      badgeText = `${getShort(activeLangs[0].lang)} ${activeLangs[0].percent}%`;
    } else {
      badgeText = activeLangs.map(l => `${getShort(l.lang)} ${l.percent}%`).join(' • ');
    }

    const detailedSummary = activeLangs.map(l => `${l.flag} ${l.name}: ${l.percent}%`).join(' | ');

    return {
      targetPercent,
      dominantLang: dominant.lang,
      dominantFlag: dominant.flag,
      dominantName: dominant.name,
      breakdown: activeLangs,
      badgeClass,
      badgeText,
      badgeHtml: `<span class="lang-ratio-badge ${badgeClass}" title="Chi tiết ngôn ngữ: ${detailedSummary}">${badgeText}</span>`,
      summaryText: detailedSummary
    };
  },

  /**
   * Offline language detection heuristic supporting multiple international languages
   * (Japanese, Korean, Chinese, Vietnamese, English, French, German, Spanish, Russian, Thai)
   */
  detectLanguageOffline(clean) {
    if (!clean) return 'empty';
    const masked = this.maskTranslatorNotes(clean);

    // 1. Calculate Asian/Cyrillic script counts
    const jpCount = (masked.match(/[\u3040-\u30ff]/g) || []).length;
    const krCount = (masked.match(/[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\ud7b0-\ud7ff]/g) || []).length;
    const ruCount = (masked.match(/[\u0400-\u04ff]/g) || []).length;
    const thCount = (masked.match(/[\u0e00-\u0e7f]/g) || []).length;
    const cjkCount = (masked.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;

    // 2. Pre-calculate Vietnamese score to avoid misclassifying translated text with foreign notes
    const viUnique = (masked.match(/[đĐơờớởỡợưừứửữựăằắẳẵặảãạẻẽẹỉĩịỏõọủũụỷỹỵầấẩẫậềếểễệồốổỗộ]/gi) || []).length;
    const viVowels = (masked.match(/[àáèéìíòóùúỳýâêô]/gi) || []).length;
    const viWords = (masked.match(/\b(và|của|là|có|được|không|một|người|trong|đã|để|với|này|những|các|cho|tại|như|nhưng|khi|anh|cô|hắn|cậu|ông|bà|mình|tôi|nói|thấy|biết|lại|ra|vào|lên|xuống|chương)\b/gi) || []).length;
    const viScore = (viUnique * 4) + (viWords * 2) + Math.min(viVowels, 3);
    const viUnaccented = (masked.match(/\b(chuong|tap|phan|hoi|quyen|ngoai truyen|loi bat|muc luc|tac gia|dich gia|thien|nien|hoa)\b/gi) || []).length;

    // If text has significant Vietnamese content outnumbering residual Asian characters, it is Vietnamese
    const foreignAsianCount = jpCount + krCount + (jpCount === 0 ? cjkCount : 0);
    if (viScore >= 6 && viScore > foreignAsianCount * 2) {
      return 'vi';
    }
    if (viUnaccented > 0 && foreignAsianCount === 0) {
      return 'vi';
    }

    // 3. Dominant script checks for foreign source texts
    if (jpCount >= 2 && jpCount > viScore) return 'ja';
    if (krCount >= 2 && krCount > viScore) return 'ko';
    if (ruCount >= 5) return 'ru';
    if (thCount >= 5) return 'th';
    if (cjkCount >= 2 && jpCount === 0 && cjkCount > viScore) return 'zh';

    // 4. Weighted scoring for Latin-script languages
    const scores = { vi: viScore, fr: 0, de: 0, es: 0, en: 0 };

    // French: ligatures, specific accents, and stop words
    const frUnique = (masked.match(/[œæçÇ]/gi) || []).length;
    const frAccents = (masked.match(/[éèêëàâçîïôûù]/gi) || []).length;
    const frWords = (masked.match(/\b(le|les|des|du|un|une|est|dans|pour|avec|sur|qui|ce|cette|sont|il|elle|ils|elles|pas|plus|chapitre)\b/gi) || []).length;
    scores.fr = (frUnique * 4) + (frWords * 2) + Math.min(frAccents, 2);

    // German: umlauts, Eszett, and stop words
    const deUnique = (masked.match(/[äöüßÄÖÜ]/gi) || []).length;
    const deWords = (masked.match(/\b(der|die|das|und|ist|den|von|zu|mit|nicht|ein|eine|auf|dem|sich|kapitel)\b/gi) || []).length;
    scores.de = (deUnique * 4) + (deWords * 2);

    // Spanish: inverted marks, ñ, accents, and stop words
    const esUnique = (masked.match(/[ñÑ¿¡]/gi) || []).length;
    const esAccents = (masked.match(/[áéíóú]/gi) || []).length;
    const esWords = (masked.match(/\b(el|los|las|un|una|por|con|para|como|pero|del|al|su|sus|se|más|capítulo|estaba|noche)\b/gi) || []).length;
    scores.es = (esUnique * 4) + (esWords * 2) + Math.min(esAccents, 2);

    // English: common stop words
    const enWords = (masked.match(/\b(the|and|of|to|in|a|is|that|for|it|as|was|with|he|on|be|at|by|this|had|not|are|from|or|have|an|they|which|one|you|were|her|all|she|there|would|their|we|him|been|has|when|who|will|more|no|if|out|so|said|what|up|its|about|into|than|them|can|only|other|new|some|could)\b/gi) || []).length;
    scores.en = enWords * 2;

    let bestLang = 'unknown';
    let maxScore = 0;
    for (const [lang, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestLang = lang;
      }
    }

    if (maxScore >= 2) return bestLang;

    return 'unknown';
  },

  /**
   * Fast robust check if text matches the target language
   * @param {string} text - Content to check
   * @param {string} targetLang - Target language code ('vi', 'en', 'ja', 'ko', 'zh', etc.)
   */
  matchesTargetLanguage(text, targetLang = 'vi') {
    if (!text || typeof text !== 'string') return false;
    const clean = text.replace(/\[IMG:[^\]]+\]/g, '').replace(/<[^>]+>/g, '').trim();
    if (!clean) return text.includes('[IMG:'); // pure illustration chapters are universal

    const normTarget = (targetLang || 'vi').toLowerCase().split('-')[0];
    const detected = this.detectLanguageOffline(clean);
    const normDetected = (detected || '').toLowerCase().split('-')[0];

    return normDetected === normTarget;
  },

  /**
   * Fast check if text is in Vietnamese (backwards compatible helper)
   */
  isVietnamese(text) {
    return this.matchesTargetLanguage(text, 'vi');
  },

  /**
   * Extract clean sample text for language detection (150-250 characters)
   */
  getSample(text, maxLen = 220) {
    if (!text || typeof text !== 'string') return '';
    // Strip image markers, HTML tags, and excessive whitespaces
    const clean = text.replace(/\[IMG:[^\]]+\]/g, '').replace(/<[^>]+>/g, '').replace(/[\r\n\t]+/g, ' ').trim();
    if (clean.length <= maxLen) return clean;
    
    // Pick from the first 1/3 of chapter for representative content
    return clean.substring(0, maxLen);
  },

  /**
   * Detect language using Google API
   * @param {string} text - Sample text
   * @returns {Promise<string>} Language code returned by Google (e.g. 'zh-CN', 'vi', 'ja', 'en')
   */
  async detectWithGoogle(text) {
    const sample = this.getSample(text);
    if (!sample) return 'unknown';

    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=auto&tl=vi&dt=t&q=${encodeURIComponent(sample)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) throw new Error(`Google API status: ${res.status}`);
      const data = await res.json();
      
      // Google returns detected language at data[2]
      if (data && typeof data[2] === 'string') {
        return data[2].trim();
      }
    } catch (err) {
      // Offline fallback: regex heuristic
      return this.detectLanguageOffline(sample);
    }

    return this.detectLanguageOffline(sample);
  },

  /**
   * Fast offline fallback if network is unreachable
   */
  detectFallback(sample) {
    return this.detectLanguageOffline(sample);
  },

  /**
   * Get friendly language display info
   */
  getLangInfo(langCode) {
    const info = this.LANG_MAP[langCode];
    if (info) return info;
    return { name: langCode ? langCode.toUpperCase() : 'Không rõ', flag: '🌐' };
  },

  /**
   * Evaluate single chapter vs targetLang with exact language breakdown
   * @param {Object} chapter - { id, title, content }
   * @param {string} targetLang - default 'vi'
   */
  async evaluateChapter(chapter, targetLang = 'vi') {
    const content = chapter.content || '';
    const normTarget = (targetLang || 'vi').toLowerCase().split('-')[0];
    const targetInfo = this.getLangInfo(normTarget);
    const breakdown = this.getLanguageBreakdown(content, targetLang);

    if (!content.trim()) {
      return {
        id: chapter.id,
        status: 'empty',
        statusLabel: 'Chương trống',
        badgeClass: 'badge-empty',
        detectedLang: 'empty',
        langName: 'Trống',
        flag: '⚪',
        foreignCount: 0,
        isTranslated: false,
        breakdown,
        targetPercent: 0,
        ratioBadgeHtml: breakdown.badgeHtml
      };
    }

    const isMatchTarget = breakdown.targetPercent >= 90;
    const isPartial = breakdown.targetPercent >= 10 && breakdown.targetPercent < 90;

    let status = 'untranslated';
    let statusLabel = breakdown.dominantName;
    let badgeClass = 'badge-untranslated';
    let flag = breakdown.dominantFlag;

    if (isMatchTarget) {
      status = 'translated';
      statusLabel = `${breakdown.targetPercent}%`;
      badgeClass = 'badge-translated';
      flag = '🟢';
    } else if (isPartial) {
      status = 'partial';
      statusLabel = `${breakdown.targetPercent}%`;
      badgeClass = 'badge-partial';
      flag = '⚠️';
    }

    return {
      id: chapter.id,
      status,
      statusLabel,
      badgeClass,
      detectedLang: breakdown.dominantLang,
      langName: breakdown.dominantName,
      flag,
      foreignCount: 0,
      isTranslated: isMatchTarget,
      breakdown,
      targetPercent: breakdown.targetPercent,
      ratioBadgeHtml: breakdown.badgeHtml
    };
  },

  /**
   * Scan entire book / chapters concurrently with batch throttling
   * @param {Array} chapters - List of chapters
   * @param {string} targetLang - Target language ('vi')
   * @param {Function} onProgress - Optional progress callback ({ completed, total })
   */
  async scanChapters(chapters, targetLang = 'vi', onProgress = null) {
    if (!Array.isArray(chapters) || chapters.length === 0) {
      return {
        total: 0,
        translatedCount: 0,
        partialCount: 0,
        untranslatedCount: 0,
        percent: 0,
        dominantSourceLang: 'Không có dữ liệu',
        dominantFlag: '🌐',
        chapterResults: new Map(),
        untranslatedChapterIds: [],
        partialChapterIds: [],
        translatedChapterIds: [],
        bookBreakdown: []
      };
    }

    const total = chapters.length;
    const chapterResults = new Map();
    const sourceFrequency = {};
    let translatedCount = 0;
    let partialCount = 0;
    let untranslatedCount = 0;
    const untranslatedChapterIds = [];
    const partialChapterIds = [];
    const translatedChapterIds = [];

    // Concurrency pool (batch size 6)
    const BATCH_SIZE = 6;
    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = chapters.slice(i, i + BATCH_SIZE);
      const batchEvaluations = await Promise.all(
        batch.map(ch => this.evaluateChapter(ch, targetLang))
      );

      batchEvaluations.forEach(evalResult => {
        chapterResults.set(evalResult.id, evalResult);
        
        // Cache on chapter object for fast UI rendering
        const ch = chapters.find(c => c.id === evalResult.id);
        if (ch) ch._langEvaluation = evalResult;

        if (evalResult.status === 'translated') {
          translatedCount++;
          translatedChapterIds.push(evalResult.id);
        } else if (evalResult.status === 'partial') {
          partialCount++;
          partialChapterIds.push(evalResult.id);
        } else {
          untranslatedCount++;
          untranslatedChapterIds.push(evalResult.id);
          if (evalResult.langName && evalResult.detectedLang !== 'empty') {
            sourceFrequency[evalResult.langName] = (sourceFrequency[evalResult.langName] || 0) + 1;
          }
        }
      });

      if (typeof onProgress === 'function') {
        onProgress({ completed: Math.min(i + BATCH_SIZE, total), total });
      }
    }

    // Determine dominant source language detected
    let dominantSourceLang = 'Chưa xác định';
    let maxFreq = 0;
    for (const [lang, freq] of Object.entries(sourceFrequency)) {
      if (freq > maxFreq) {
        maxFreq = freq;
        dominantSourceLang = lang;
      }
    }

    const dominantFlag = Object.values(this.LANG_MAP).find(m => m.name === dominantSourceLang)?.flag || '🌐';
    const weightedProgress = translatedCount + (partialCount * 0.5);
    const percent = Math.round((weightedProgress / total) * 100);

    return {
      total,
      translatedCount,
      partialCount,
      untranslatedCount,
      percent,
      dominantSourceLang,
      dominantFlag,
      chapterResults,
      untranslatedChapterIds,
      partialChapterIds,
      translatedChapterIds
    };
  },

  /**
   * Generates GitHub-style Languages Breakdown bar HTML
   * @param {Array} breakdownList - [{ lang, name, flag, color, percent }]
   * @param {Object} options - { title: string, height: number, showTitle: boolean, showLegend: boolean, compact: boolean }
   */
  renderMultiLangBar(breakdownList, { title = 'Languages', height = 8, showTitle = false, showLegend = true, compact = false, shortNames = false } = {}) {
    if (!Array.isArray(breakdownList) || breakdownList.length === 0) {
      return `
        <div class="github-languages-widget ${compact ? 'compact' : ''}">
          ${showTitle ? `<div class="github-languages-title">${title}</div>` : ''}
          <div class="github-languages-bar" style="height: ${height}px">
            <div class="github-languages-segment" style="width: 100%; background-color: var(--border-medium)" title="Chưa có dữ liệu"></div>
          </div>
          ${showLegend ? `
            <div class="github-languages-legend">
              <span class="legend-item"><span class="legend-dot" style="background-color: var(--border-medium)"></span><span class="lang-name">Chưa có dữ liệu</span></span>
            </div>
          ` : ''}
        </div>
      `;
    }

    const segmentsHtml = breakdownList.map(item => `
      <div class="github-languages-segment" 
           style="width: ${item.percent}%; background-color: ${item.color}" 
           title="${item.name}: ${item.percent}%"></div>
    `).join('');

    const useShort = !!shortNames;
    const legendHtml = showLegend ? `
      <div class="github-languages-legend">
        ${breakdownList.map(item => {
          const shortCode = this.LANG_MAP[item.lang]?.short || item.lang;
          const displayName = useShort ? shortCode : item.name;
          return `
            <span class="legend-item" title="${item.name}: ${item.percent}%">
              <span class="legend-dot" style="background-color: ${item.color}"></span>
              <span class="lang-name">${displayName}</span>
              <span class="lang-pct">${item.percent}%</span>
            </span>
          `;
        }).join('')}
      </div>
    ` : '';

    const displayTitle = (title === 'Languages' || !title) ? 'Ngôn ngữ trong truyện' : title;

    return `
      <div class="github-languages-widget ${compact ? 'compact' : ''}">
        ${showTitle ? `<div class="github-languages-title">${displayTitle}</div>` : ''}
        <div class="github-languages-bar" style="height: ${height}px">
          ${segmentsHtml}
        </div>
        ${legendHtml}
      </div>
    `;
  },

  /**
   * Calculate aggregated language breakdown for a whole book
   */
  getBookLanguageBreakdown(book, targetLang = 'vi') {
    if (!book) {
      return {
        targetPercent: 0,
        breakdown: [],
        barHtml: this.renderMultiLangBar([], { showLegend: false }),
        summaryText: '0%'
      };
    }

    const chapters = book.chapters || [];
    const normTarget = (targetLang || (typeof State !== 'undefined' && State.settings && State.settings.targetLang) || 'vi').toLowerCase().split('-')[0];

    if (chapters.length === 0) {
      const p = typeof book.progressPercent === 'number' ? book.progressPercent : 0;
      const srcLang = (book.sourceLang || 'other').toLowerCase().split('-')[0];
      const srcInfo = this.LANG_MAP[srcLang] || { name: 'Gốc', flag: '🌐' };
      const fakeBreakdown = p > 0 ? [
        { lang: normTarget, name: this.LANG_MAP[normTarget]?.name || 'Tiếng Việt', flag: this.LANG_MAP[normTarget]?.flag || '🇻🇳', color: this.LANG_COLORS[normTarget] || '#22c55e', percent: p },
        { lang: srcLang, name: srcInfo.name === 'other' ? 'Gốc' : srcInfo.name, flag: srcInfo.flag || '🌐', color: this.LANG_COLORS[srcLang] || '#94a3b8', percent: 100 - p }
      ].filter(x => x.percent > 0) : (
        book.sourceLang ? [{ lang: srcLang, name: srcInfo.name, flag: srcInfo.flag || '🌐', color: this.LANG_COLORS[srcLang] || '#94a3b8', percent: 100 }] : []
      );

      return {
        targetPercent: p,
        breakdown: fakeBreakdown,
        barHtml: this.renderMultiLangBar(fakeBreakdown, { showLegend: true }),
        barWithTitleHtml: this.renderMultiLangBar(fakeBreakdown, { title: 'Ngôn ngữ trong truyện', showTitle: true, showLegend: true }),
        compactBarHtml: this.renderMultiLangBar(fakeBreakdown, { height: 6, showLegend: false, compact: true }),
        summaryText: fakeBreakdown.map(b => `${b.name} ${b.percent}%`).join('  ')
      };
    }

    // Build lookup map for finished/translated chapters
    const finishedList = (book.finishedChapters && book.finishedChapters.length > 0)
      ? book.finishedChapters 
      : ((typeof State !== 'undefined' && State.finishedChapters) || []);

    const finishedMap = new Map();
    finishedList.forEach(fc => {
      if (fc.sourceChapterId !== undefined) {
        finishedMap.set(fc.sourceChapterId, fc);
        finishedMap.set(String(fc.sourceChapterId), fc);
      }
      if (fc.id !== undefined) {
        finishedMap.set(fc.id, fc);
        finishedMap.set(String(fc.id), fc);
      }
    });

    // Accumulate each chapter's language breakdown, weighted by word/character count
    const langScores = {};
    let totalWeightCounted = 0;

    chapters.forEach(ch => {
      const fc = finishedMap.get(ch.id) || finishedMap.get(String(ch.id));
      const hasFinishedContent = !!(fc && ((fc.content && fc.content.trim()) || (fc.title && fc.title.trim())));

      let bd = null;
      if (hasFinishedContent) {
        const text = (fc.content && fc.content.trim()) ? fc.content : (fc.title || '');
        bd = this.getLanguageBreakdown(text, targetLang);
      } else if (ch._langEvaluation && ch._langEvaluation.breakdown) {
        bd = ch._langEvaluation.breakdown;
      } else {
        const text = (ch.content && ch.content.trim()) ? ch.content : (ch.title || '');
        if (text) {
          bd = this.getLanguageBreakdown(text, targetLang);
          if (!ch._langEvaluation) ch._langEvaluation = { breakdown: bd, targetPercent: bd.targetPercent };
        }
      }

      const weight = Math.max(10, (hasFinishedContent && fc.content ? fc.content.length : 0) || ch.wordCount || ch.charCount || (ch.content && ch.content.length) || 100);

      const items = Array.isArray(bd) ? bd : (bd && Array.isArray(bd.breakdown) ? bd.breakdown : []);
      if (items.length > 0) {
        items.forEach(item => {
          if (!langScores[item.lang]) {
            langScores[item.lang] = {
              score: 0,
              samples: new Set()
            };
          }
          langScores[item.lang].score += (item.percent * weight);
          if (item.samples && Array.isArray(item.samples)) {
            item.samples.forEach(s => langScores[item.lang].samples.add(s));
          }
        });
        totalWeightCounted += (100 * weight);
      }
    });

    const divisor = Math.max(1, totalWeightCounted);
    let bookBreakdown = Object.entries(langScores).map(([lang, entry]) => {
      const info = this.LANG_MAP[lang] || { name: lang, flag: '🌐' };
      const color = this.LANG_COLORS[lang] || '#94a3b8';
      const rawPct = (entry.score / divisor) * 100;
      return {
        lang,
        name: info.name,
        flag: info.flag,
        color,
        percent: Number(rawPct.toFixed(1)),
        samples: entry.samples ? Array.from(entry.samples).slice(0, 5) : []
      };
    }).filter(b => b.percent > 0).sort((a, b) => b.percent - a.percent);

    if (bookBreakdown.length === 1) {
      bookBreakdown[0].percent = 100;
    } else if (bookBreakdown.length > 1) {
      const sum = bookBreakdown.reduce((acc, c) => acc + c.percent, 0);
      const diff = Number((100 - sum).toFixed(1));
      if (Math.abs(diff) > 0 && Math.abs(diff) < 2 && bookBreakdown[0]) {
        bookBreakdown[0].percent = Number((bookBreakdown[0].percent + diff).toFixed(1));
      }
    }

    const targetItem = bookBreakdown.find(b => b.lang === normTarget);
    const targetPercent = targetItem ? targetItem.percent : (bookBreakdown[0]?.lang === normTarget ? bookBreakdown[0].percent : 0);
    const summaryText = bookBreakdown.map(b => `${b.name} ${b.percent}%`).join('  ');

    return {
      targetPercent,
      breakdown: bookBreakdown,
      barHtml: this.renderMultiLangBar(bookBreakdown, { title: 'Ngôn ngữ trong truyện', showTitle: false, showLegend: true }),
      shortBarHtml: this.renderMultiLangBar(bookBreakdown, { title: 'Ngôn ngữ', showTitle: false, showLegend: true, shortNames: true }),
      barWithTitleHtml: this.renderMultiLangBar(bookBreakdown, { title: 'Ngôn ngữ trong truyện', showTitle: true, showLegend: true }),
      compactBarHtml: this.renderMultiLangBar(bookBreakdown, { height: 6, showTitle: false, showLegend: false, compact: true }),
      summaryText
    };
  },

  /**
   * Renders the progress report into the scan modal dialog
   */
  renderReportModal(report, handlers) {
    if (typeof ProgressReportModal !== 'undefined' && typeof ProgressReportModal.render === 'function') {
      return ProgressReportModal.render(report, handlers);
    }
  }
};

if (typeof window !== 'undefined') {
  window.ProgressDetector = ProgressDetector;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProgressDetector;
}
