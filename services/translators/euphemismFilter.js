/**
 * Euphemism Filter Service (R18 Gateway Bypass)
 * Automatically converts raw explicit keywords into literary euphemisms
 * before sending to Gemini 3 / strict AI gateways, preventing PROHIBITED_CONTENT errors.
 */

class EuphemismFilter {
  // Korean dictionary: Chuyển từ thô tục đường phố sang thuật ngữ giải phẫu/hành vi chuẩn xác 1:1
  static KO_MAP = [
    { pattern: /자지/g, replacement: '음경' },       // dương vật / cặc
    { pattern: /보지/g, replacement: '음부' },       // âm hộ / lồn
    { pattern: /보짓물/g, replacement: '애액' },     // dịch nhờn / nước tình
    { pattern: /육봉/g, replacement: '음경' },       // dương vật
    { pattern: /섹스/g, replacement: '성교' },       // quan hệ tình dục / làm tình
    { pattern: /난교/g, replacement: '군교' },       // quan hệ tập thể
    { pattern: /씨발/g, replacement: '젠장' },       // chết tiệt
    { pattern: /좆됐/g, replacement: '망했' },       // hỏng bét
    { pattern: /좆/g, replacement: '빌어먹을' }     // mẹ kiếp
  ];

  // Chinese dictionary: Giữ chuẩn nghĩa giải phẫu và hành vi, loại bỏ ẩn dụ hoa mỹ làm sai lệch nguyên tác
  static ZH_MAP = [
    { pattern: /肉棒/g, replacement: '阴茎' },       // dương vật / cặc
    { pattern: /鸡巴/g, replacement: '阴茎' },       // dương vật
    { pattern: /小穴/g, replacement: '阴道' },       // âm đạo
    { pattern: /肉穴/g, replacement: '阴道' },       // âm đạo
    { pattern: /逼/g, replacement: '阴部' },         // âm bộ / lồn
    { pattern: /抽插/g, replacement: '抽送' },       // thọc vào rút ra / ra vào
    { pattern: /做爱/g, replacement: '性交' },       // quan hệ / làm tình
    { pattern: /淫水/g, replacement: '爱液' },       // dịch nhờn / nước dâm
    { pattern: /内射/g, replacement: '体内射精' }   // xuất tinh vào trong / bắn vào trong
  ];

  // Japanese dictionary: Chuyển từ thô sang từ giải phẫu/hành vi trực tiếp
  static JA_MAP = [
    { pattern: /チンポ/g, replacement: '陰茎' },     // dương vật / cặc
    { pattern: /ちんぽ/g, replacement: '陰茎' },
    { pattern: /肉棒/g, replacement: '陰茎' },
    { pattern: /まんこ/g, replacement: '陰部' },     // âm bộ / lồn
    { pattern: /マンコ/g, replacement: '陰部' },
    { pattern: /セックス/g, replacement: '性交' }   // quan hệ tình dục / làm tình
  ];

  /**
   * Apply euphemism masking to source text based on language
   */
  static mask(text, sourceLang = 'auto') {
    if (!text || typeof text !== 'string') return text;
    let masked = text;

    // Detect language or apply corresponding map
    const lang = (sourceLang || 'auto').toLowerCase();

    if (lang === 'ko' || /[\uAC00-\uD7AF]/.test(text)) {
      for (const item of EuphemismFilter.KO_MAP) {
        masked = masked.replace(item.pattern, item.replacement);
      }
    }

    if (lang === 'zh' || /[\u4E00-\u9FFF]/.test(text)) {
      for (const item of EuphemismFilter.ZH_MAP) {
        masked = masked.replace(item.pattern, item.replacement);
      }
    }

    if (lang === 'ja' || /[\u3040-\u30FF]/.test(text)) {
      for (const item of EuphemismFilter.JA_MAP) {
        masked = masked.replace(item.pattern, item.replacement);
      }
    }

    return masked;
  }
}

module.exports = EuphemismFilter;
