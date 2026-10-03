/**
 * FOREIGN CHARACTER DETECTOR & HIGHLIGHTER
 * Inspired by Aiko Novel Translator
 * Detects untranslated characters (Chinese, Japanese, Korean, Thai) in Vietnamese translated text
 */

const ForeignDetector = {
  PATTERNS: {
    chinese: /[\u4e00-\u9fff\u3400-\u4dbf]/g,
    japanese: /[\u3040-\u309f\u30a0-\u30ff]/g,
    korean: /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/g,
    thai: /[\u0e00-\u0e7f]/g
  },

  detect(text) {
    if (!text) {
      return {
        hasForeign: false,
        totalCount: 0,
        warningMessage: '',
        severity: 'none',
        samples: [],
        chineseCount: 0,
        japaneseCount: 0,
        koreanCount: 0,
        thaiCount: 0
      };
    }

    const chineseMatches = text.match(this.PATTERNS.chinese) || [];
    const japaneseMatches = text.match(this.PATTERNS.japanese) || [];
    const koreanMatches = text.match(this.PATTERNS.korean) || [];
    const thaiMatches = text.match(this.PATTERNS.thai) || [];

    const uniqueChinese = Array.from(new Set(chineseMatches));
    const uniqueJapanese = Array.from(new Set(japaneseMatches));
    const uniqueKorean = Array.from(new Set(koreanMatches));
    const uniqueThai = Array.from(new Set(thaiMatches));

    const totalCount = chineseMatches.length + japaneseMatches.length + koreanMatches.length + thaiMatches.length;
    const hasForeign = totalCount > 0;

    const warnings = [];
    if (uniqueChinese.length > 0) warnings.push(`Sót ${uniqueChinese.length} chữ Hán (${uniqueChinese.slice(0, 6).join(' ')})`);
    if (uniqueJapanese.length > 0) warnings.push(`Sót ${uniqueJapanese.length} chữ Nhật (${uniqueJapanese.slice(0, 6).join(' ')})`);
    if (uniqueKorean.length > 0) warnings.push(`Sót ${uniqueKorean.length} chữ Hàn (${uniqueKorean.slice(0, 6).join(' ')})`);
    if (uniqueThai.length > 0) warnings.push(`Sót ${uniqueThai.length} chữ Thái (${uniqueThai.slice(0, 6).join(' ')})`);

    const warningMessage = warnings.join(' • ');
    let severity = 'none';
    if (totalCount > 15) severity = 'high';
    else if (totalCount > 4) severity = 'medium';
    else if (totalCount > 0) severity = 'low';

    return {
      hasForeign,
      chineseCount: uniqueChinese.length,
      japaneseCount: uniqueJapanese.length,
      koreanCount: uniqueKorean.length,
      thaiCount: uniqueThai.length,
      totalCount,
      warningMessage,
      severity,
      samples: [...uniqueChinese, ...uniqueJapanese, ...uniqueKorean, ...uniqueThai].slice(0, 10)
    };
  },

  highlightHtml(text) {
    if (!text) return text;
    return text
      .replace(this.PATTERNS.chinese, m => `<mark class="foreign-mark chinese" title="Chữ Hán chưa dịch">${m}</mark>`)
      .replace(this.PATTERNS.japanese, m => `<mark class="foreign-mark japanese" title="Chữ Nhật chưa dịch">${m}</mark>`)
      .replace(this.PATTERNS.korean, m => `<mark class="foreign-mark korean" title="Chữ Hàn chưa dịch">${m}</mark>`)
      .replace(this.PATTERNS.thai, m => `<mark class="foreign-mark thai" title="Chữ Thái chưa dịch">${m}</mark>`);
  }
};

if (typeof window !== 'undefined') {
  window.ForeignDetector = ForeignDetector;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ForeignDetector;
}
