/**
 * R18 Content Detector Service
 * Automatically detects adult / R18 erotic content across multiple languages:
 * Korean (ko), Chinese (zh), Japanese (ja), English (en), Vietnamese (vi).
 * 
 * STRICT RULE: "chỉ những ngôn ngữ chỉ rõ mới hiện"
 * Only inspects and displays R18 when the source/target language is explicitly configured.
 * Never performs indiscriminate cross-language scans to prevent false positives.
 */

class R18Detector {
  // Explicit rating tags in chapter titles
  static TITLE_RATING_PATTERNS = {
    universal: [
      /[\[(【（]\s*(?:18\+|19\+|r-?18|r-?19|smut|nsfw)\s*[\])】）]/i,
      /(?:^|[^\p{L}\p{N}])(?:r-?18|r-?19)(?:$|[^\p{L}\p{N}])/iu
    ],
    ko: [
      /[\[(【（]\s*(?:19금|18금|고수위)\s*[\])】）]/i,
      /(?:^|[^\p{L}\p{N}])(?:19금|18금)(?:$|[^\p{L}\p{N}])/iu
    ],
    zh: [
      /[\[(【（]\s*(?:18禁|19禁|高H|肉文)\s*[\])】）]/i,
      /(?:^|[^\p{L}\p{N}])(?:18禁|19禁)(?:$|[^\p{L}\p{N}])/iu
    ],
    ja: [
      /[\[(【（]\s*(?:18禁|R-?18)\s*[\])】）]/i,
      /(?:^|[^\p{L}\p{N}])(?:18禁)(?:$|[^\p{L}\p{N}])/iu
    ],
    vi: [
      /[\[(【（]\s*(?:18\+|cao\s*h|h\s*văn)\s*[\])】）]/i,
      /(?:^|[^\p{L}\p{N}])(?:cao\s*h|h\s*văn)(?:$|[^\p{L}\p{N}])/iu
    ]
  };

  // Strong, unequivocal adult words (No homonyms or generic words)
  static STRONG_PATTERNS = {
    ko: [
      /질내사정/g, /보짓물/g, /쿠퍼액/g, /음핵/g, /클리토리스/g, /펠라치오/g,
      /자위행위/g, /떡신/g,
      /(?:자지|음경|육봉)\s*(?:를|을)?\s*(?:빨|물|세우|삽입|박|넣)/g,
      /(?:보지|음순)\s*(?:를|을)?\s*(?:벌리|핥|빨|박|삽입)/g,
      /정액(?:을|이|과|에)\s*(?:싸|뿜|흘|삼키|뿌리|쏟)/g,
      // 자지/보지 chỉ tính khi đi với trợ từ/hậu tố mang nghĩa giải phẫu (loại 자지 않다, 보지 못했다...)
      /(?<!혼)자지(?:가|를|에|끝|기둥|털)/g,
      /보지(?:가|에|속|구멍|털|살)/g,
      /보짓/g, /젖꼭지/g, /애무/g
    ],
    zh: [
      /肉棒/g, /鸡巴/g, /小穴/g, /抽插/g, /内射/g, /淫水/g, /潮吹/g, /阴蒂/g
    ],
    ja: [
      /チンポ/g, /ちんぽ/g, /まんこ/g, /マンコ/g, /クリトリス/g, /潮吹き/g, /中出し/g, /オナニー/g
    ],
    en: [
      /\b(?:blowjob|creampie|clitoris|dildo|cumshot)\b/gi,
      /\b(?:suck|stroke)\s+(?:his\s+)?cock\b/gi
    ],
    vi: [
      /\b(?:thao lộng|tiểu huyệt|hoa huyệt|dâm thủy|bắn tinh|bú cu|mút cu|chịch nhau|làm tình thô bạo)\b/gi
    ]
  };

  // Contextual adult words (Require higher occurrence & score)
  static CONTEXTUAL_PATTERNS = {
    ko: [
      /애액/g, /자궁구/g, /오르가즘/g, /신음/g, /섹스/g, /정액/g, /쾌감/g, /절정/g
    ],
    zh: [
      /做爱/g, /自慰/g, /高潮/g
    ],
    ja: [
      /セックス/g, /オーガズム/g, /フェラ/g
    ],
    en: [
      /\borgasm\b/gi, /\bhandjob\b/gi
    ],
    vi: [
      /\blên đỉnh\b/gi, /\blàm tình\b/gi
    ]
  };

  /**
   * Normalize language code to standard keys ('ko', 'zh', 'ja', 'en', 'vi')
   * Returns empty string if unknown or not explicitly specified.
   * @param {string} lang
   * @returns {string}
   */
  static normalizeLang(lang) {
    if (!lang || typeof lang !== 'string') return '';
    const l = lang.toLowerCase().trim();
    if (l === 'auto' || l === 'undefined' || l === 'null') return '';
    if (l.startsWith('ko') || l === 'korean' || l === 'kr') return 'ko';
    if (l.startsWith('zh') || l === 'chinese' || l === 'cn' || l === 'tw') return 'zh';
    if (l.startsWith('ja') || l === 'japanese' || l === 'jp') return 'ja';
    if (l.startsWith('en') || l === 'english') return 'en';
    if (l.startsWith('vi') || l === 'vietnamese' || l === 'vn') return 'vi';
    return '';
  }

  /**
   * Determine explicitly specified languages to inspect.
   * "chỉ những ngôn ngữ chỉ rõ mới hiện" -> Strictly only inspect explicitly specified languages.
   * @param {string} sourceLang
   * @returns {string[]}
   */
  static resolveExplicitLangs(sourceLang, text = '') {
    const normParam = R18Detector.normalizeLang(sourceLang);
    if (normParam) return [normParam];
    if (typeof State !== 'undefined' && State.settings) {
      const normSetting = R18Detector.normalizeLang(State.settings.sourceLang);
      if (normSetting) return [normSetting];
    }
    // 'auto': xác định đúng 1 ngôn ngữ từ chữ viết của văn bản (không quét chéo)
    const byScript = R18Detector.detectScriptLang(text);
    return byScript ? [byScript] : [];
  }

  /**
   * Detect the single dominant language of a text by its script.
   * @param {string} text
   * @returns {string} 'ko' | 'ja' | 'zh' | 'vi' | 'en' | ''
   */
  static detectScriptLang(text) {
    if (!text || typeof text !== 'string') return '';
    const sample = text.length > 5000 ? text.slice(0, 5000) : text;
    const count = re => (sample.match(re) || []).length;
    const hangul = count(/[\uAC00-\uD7AF]/g);
    const kana = count(/[\u3040-\u30FF]/g);
    const han = count(/[\u4E00-\u9FFF]/g);
    const viet = count(/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/gi);
    const latin = count(/[a-z]/gi);
    if (hangul > 20 && hangul >= kana && hangul >= han) return 'ko';
    if (kana > 20) return 'ja';
    if (han > 20) return 'zh';
    if (viet > 20) return 'vi';
    if (latin > 100) return 'en';
    return '';
  }

  /**
   * Check if chapter title explicitly marks R18 / 19+
   * @param {string} title
   * @param {string[]} langs
   * @returns {boolean}
   */
  static isTitleR18(title, langs = []) {
    if (!title || typeof title !== 'string') return false;
    // Check universal rating tags first (e.g. [18+], [19+], [R18], [NSFW])
    if (R18Detector.TITLE_RATING_PATTERNS.universal.some(re => re.test(title))) {
      return true;
    }
    // Only check language-specific title patterns for explicitly specified languages
    for (const l of langs) {
      const patterns = R18Detector.TITLE_RATING_PATTERNS[l];
      if (patterns && patterns.some(re => re.test(title))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Return standardized R18 Badge HTML (Clean text badge, NO flame icon)
   * @param {string} extraClass - Optional extra CSS class
   * @param {string} id - Optional element id
   * @returns {string}
   */
  static getBadgeHtml(extraClass = '', id = '') {
    const cls = extraClass ? `r18-badge-micro ${extraClass}` : 'r18-badge-micro';
    const idAttr = id ? `id="${id}" ` : '';
    return `<span ${idAttr}class="${cls}" title="Chương 18+">18+</span>`;
  }

  /**
   * Helper to check chapter object and its translation
   * @param {object} ch - Chapter object
   * @param {object} fc - Finished chapter object (if any)
   * @param {string} sourceLang - Source language
   * @returns {boolean}
   */
  static isChapterR18(ch, fc, sourceLang = 'auto') {
    if (!ch) return false;
    const langs = R18Detector.resolveExplicitLangs(sourceLang, ch.content || ch.title || '');

    // Check title
    const title = `${ch.title || ''} ${(fc && fc.title) ? fc.title : ''}`;
    if (R18Detector.isTitleR18(title, langs)) {
      ch._isR18 = true;
      return true;
    }

    // Check source content (only with the single resolved source language)
    if (ch.content && langs.length > 0) {
      const res = R18Detector.detect(ch.content, langs[0]);
      if (res.isR18) {
        ch._isR18 = true;
        return true;
      }
    }

    // Check translated content (if translation exists and targetLang is vi)
    if (fc && fc.content) {
      const targetLang = (typeof State !== 'undefined' && State.settings && State.settings.targetLang) || 'vi';
      if (R18Detector.normalizeLang(targetLang) === 'vi') {
        const res = R18Detector.detect(fc.content, 'vi');
        if (res.isR18) {
          ch._isR18 = true;
          return true;
        }
      }
    }

    ch._isR18 = false;
    return false;
  }

  /**
   * Detect whether text contains genuine R18 / explicit sexual content
   * @param {string} text - Raw text to inspect
   * @param {string} sourceLang - Source language code ('ko', 'zh', 'ja', 'en', 'vi', 'auto')
   * @returns {{ isR18: boolean, matchCount: number, totalScore: number }}
   */
  static detect(text, sourceLang = 'auto') {
    if (!text || typeof text !== 'string') {
      return { isR18: false, matchCount: 0, totalScore: 0 };
    }

    const langs = R18Detector.resolveExplicitLangs(sourceLang, text);
    // If language cannot be determined, do not inspect and do not trigger
    if (langs.length === 0) {
      return { isR18: false, matchCount: 0, totalScore: 0, reason: 'no_explicit_lang' };
    }

    let strongMatches = 0;
    let contextualMatches = 0;

    for (const lang of langs) {
      if (R18Detector.STRONG_PATTERNS[lang]) {
        for (const regex of R18Detector.STRONG_PATTERNS[lang]) {
          regex.lastIndex = 0;
          const m = text.match(regex);
          if (m) strongMatches += m.length;
        }
      }
      if (R18Detector.CONTEXTUAL_PATTERNS[lang]) {
        for (const regex of R18Detector.CONTEXTUAL_PATTERNS[lang]) {
          regex.lastIndex = 0;
          const m = text.match(regex);
          if (m) contextualMatches += m.length;
        }
      }
    }

    const totalScore = strongMatches * 2 + contextualMatches;
    // Strict threshold: At least 2 strong matches AND totalScore >= 4, or 3+ strong matches.
    // Prevents normal chapters with passing mentions from falsely showing R18.
    const isR18 = strongMatches >= 3
      || (strongMatches >= 2 && totalScore >= 4)
      || (strongMatches >= 1 && contextualMatches >= 5);

    return {
      isR18,
      strongMatches,
      contextualMatches,
      totalScore,
      matchCount: strongMatches + contextualMatches,
      langsChecked: langs
    };
  }
}

if (typeof window !== 'undefined') {
  window.R18Detector = R18Detector;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = R18Detector;
}
