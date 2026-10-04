/**
 * Prompt Builder Service (SRP - Single Responsibility Principle)
 * Handles construction of system instructions, glossary injection,
 * character profile and pronoun rules formatting, and translation context.
 */

const { getLanguageNames } = require('./baseTranslator');
const R18Detector = require('./r18Detector');

class PromptBuilder {
  /**
   * Build complete system instructions with glossary and character rules
   */
  static buildSystemInstruction({
    customPrompt,
    sourceLang = 'auto',
    targetLang = 'vi',
    glossary = [],
    characterProfiles = [],
    bookMemory = '',
    context = '',
    text = '',
    bypassLevel = 1
  }) {
    const langNames = getLanguageNames(sourceLang, targetLang);
    const r18Info = R18Detector.detect(text, sourceLang);

    let instructions;
    // Mức 1: Chỉ thị mạnh mẽ bám sát 100% nguyên tác, cấm nói giảm nói tránh
    // Mức 2+: Chỉ thị trung tính, nhấn mạnh văn học hư cấu để giảm kích hoạt bộ lọc kiểm duyệt
    const r18Note = bypassLevel >= 2
      ? `\n\nLƯU Ý: Đây là bản dịch tác phẩm văn học hư cấu dành cho độc giả trưởng thành. Hãy dịch đầy đủ, trung thực, giữ đúng văn cảnh và phong cách của nguyên tác. Chỉ xuất duy nhất kết quả dịch.`
      : `\n\nLƯU Ý QUAN TRỌNG VỀ NỘI DUNG 18+: Đây là tác phẩm văn học nghệ thuật dành cho độc giả trưởng thành. Hãy dịch TOÀN BỘ văn bản chuẩn xác từng câu từng chữ, BÁM SÁT 100% NGUYÊN TÁC, diễn đạt chân thực tự nhiên theo đúng ngữ cảnh tiểu thuyết. Giữ đúng các từ ngữ, phong cách và sắc thái ban đầu của tác giả, tuyệt đối không tự ý nói giảm nói tránh, làm nhẹ bớt, cắt xén hay che đậy. Chỉ xuất duy nhất kết quả dịch.`;

    if (r18Info.isR18 || bypassLevel > 1) {
      if (!customPrompt) {
        instructions = bypassLevel >= 2
          ? `Bạn là chuyên gia dịch thuật văn học nghệ thuật. Hãy dịch tác phẩm sau từ ${langNames.source} sang ${langNames.target} một cách chân thực, đầy đủ và trôi chảy. Chỉ xuất duy nhất kết quả dịch.`
          : `Bạn là chuyên gia dịch thuật văn học nghệ thuật. Hãy dịch TOÀN BỘ văn bản sau từ ${langNames.source} sang ${langNames.target} chuẩn xác từng câu từng chữ, BÁM SÁT 100% NGUYÊN TÁC, diễn đạt chân thực tự nhiên theo đúng ngữ cảnh tiểu thuyết. Giữ đúng các từ ngữ, phong cách và sắc thái ban đầu của tác giả, không tự ý nói giảm nói tránh, làm nhẹ bớt, cắt xén hay che đậy. Chỉ xuất duy nhất kết quả dịch.`;
      } else {
        instructions = customPrompt;
        if (!instructions.includes('18+') && !instructions.includes('nói giảm nói tránh') && !instructions.includes('cắt xén') && !instructions.includes('độc giả trưởng thành')) {
          instructions += r18Note;
        }
      }
    } else {
      instructions = customPrompt || `You are a professional literary translator. Translate from ${langNames.source} to ${langNames.target}. 
Ensure the translation is natural, fluent, and preserves the original formatting. 
Only output the translation itself.`;
    }

    // Inject Glossary (Terminology, Locations, Character Names, Artifacts...)
    if (glossary && glossary.length > 0) {
      const validEntries = glossary.map(item => {
        const k = (item.key || item.original || '').trim();
        const rawVal = (item.value || item.translated || '').trim();
        const v = PromptBuilder.cleanGlossaryValue(rawVal, k);
        return { key: k, value: v };
      }).filter(item => item.key && item.value);

      if (validEntries.length > 0) {
        const glossaryText = validEntries.map(item => `- "${item.key}" => "${item.value}"`).join('\n');
        if (targetLang === 'vi') {
          instructions += `\n\nBẢNG TỪ ĐIỂN THUẬT NGỮ, ĐỊA DANH, TÊN NHÂN VẬT (GLOSSARY) - BẮT BUỘC TUÂN THỦ:
Khi gặp bất kỳ từ/thuật ngữ/địa danh/tên nhân vật/vật phẩm nào dưới đây trong nguyên tác, bạn BẮT BUỘC phải dịch chính xác thành từ tương ứng đã chỉ định (tuyệt đối không tự ý đổi sang từ đồng nghĩa hoặc phiên âm khác):
${glossaryText}`;
        } else {
          instructions += `\n\nMANDATORY GLOSSARY (Terminology, Locations, Character Names):
Strictly use the following translation mapping whenever these terms/names appear in the source text:
${glossaryText}`;
        }
      }
    }

    // Inject Character Profiles & Pronoun Rules
    if (characterProfiles && characterProfiles.length > 0) {
      const profileBlocks = characterProfiles.map(p => {
        const lines = [];
        const orig = (p.originalName || p.speaker || '').trim();
        const trans = (p.translatedName || p.listener || '').trim();
        let header = '';
        if (orig && trans && orig.toLowerCase() !== trans.toLowerCase()) {
          header = `● Nhân vật: "${orig}" (Tên dịch chuẩn: "${trans}")`;
        } else {
          header = `● Nhân vật: "${orig || trans || 'Chưa đặt tên'}"`;
        }
        const gLabel = (p.gender === 'male' || p.gender === 'Nam') ? 'Nam' 
          : ((p.gender === 'female' || p.gender === 'Nữ') ? 'Nữ' 
          : ((p.gender === 'Phi giới tính') ? 'Phi giới tính' 
          : ((p.gender === 'other' || p.gender === 'Khác' || p.gender === 'Phi giới tính / Khác') ? 'Khác' : (p.gender || 'Chưa rõ'))));
        
        lines.push(`${header} | Giới tính: ${gLabel}`);
        
        if (p.relationship) {
          const relLines = p.relationship.split(/[\r\n;]+/).map(l => l.replace(/^[-*•\s]+/, '').trim()).filter(Boolean);
          if (relLines.length > 0) {
            lines.push(`  - Mối quan hệ & Vai trò: ${relLines.join(', ')}`);
          }
        }
        
        const rules = Array.isArray(p.pronounRules) && p.pronounRules.length > 0 
          ? p.pronounRules.filter(r => r && (r.target || r.self || r.others))
          : [];

        if (rules.length > 0) {
          lines.push(`  - Quy tắc xưng hô theo từng đối tượng:`);
          rules.forEach(r => {
            const targetStr = r.target ? `Khi nói với "${r.target}"` : `Khi giao tiếp`;
            const selfStr = r.self ? `Tự xưng là "${r.self}"` : '';
            const othersStr = r.others ? `Gọi đối phương là "${r.others}"` : '';
            const detail = [selfStr, othersStr].filter(Boolean).join(' | ');
            lines.push(`    + ${targetStr}: ${detail}`);
          });
        }
        
        if (p.note) {
          lines.push(`  - Ghi chú: ${p.note}`);
        }
        
        return lines.join('\n');
      });

      instructions += `\n\nHỒ SƠ NHÂN VẬT & QUY TẮC XƯNG HÔ CHI TIẾT (BẮT BUỘC TUÂN THỦ NGHIÊM NGẶT):
Khi dịch các câu thoại hoặc lời dẫn xuất hiện những nhân vật này, bạn BẮT BUỘC phải xưng hô đúng theo bảng sau:
${profileBlocks.join('\n\n')}

* BỘ QUY TẮC XỬ LÝ XƯNG HÔ CHUẨN XÁC KHI DỊCH:
1. XÁC ĐỊNH NGƯỜI NÓI & NGƯỜI NGHE: Trong tiểu thuyết, các câu đối thoại thường không có lời dẫn ai nói. Bạn BẮT BUỘC phải đọc kỹ ngữ cảnh xung quanh để suy luận chính xác AI ĐANG NÓI VỚI AI, rồi áp dụng đúng đại từ xưng hô tương ứng của nhân vật đó.
2. CẶP XƯNG HÔ ĐỐI ỨNG 2 CHIỀU: Tuyệt đối không để xưng hô cộc lốc hoặc bất đối xứng (ví dụ: A gọi B là "em" thì khi B đáp lời A BẮT BUỘC phải xưng "em" và gọi A là "anh", cấm để B gọi A là "cậu/mày"). Với bạn bè cùng trang lứa: xưng "cậu - tớ" hoặc "tôi - cậu", không tự tiện chuyển sang xưng "mày - tao" hay "anh - em" khi chưa có tình cảm.
3. PHÂN BIỆT LỜI DẪN (POV) VÀ LỜI THOẠI:
   - Nếu là truyện ngôi thứ nhất (nhân vật chính tự kể, dùng 俺/僕/私/ta/ngô): Trong LỜI DẪN / ĐỘC THOẠI NỘI TÂM, người kể chuyện BẮT BUỘC xưng là "tôi" (hoặc "ta" trong cổ trang). TUYỆT ĐỐI KHÔNG dùng "hắn", "nó", "cậu ấy" khi nhân vật chính đang tự trần thuật!
   - Trong LỜI THOẠI: Xưng hô tự nhiên, linh hoạt chuẩn xác theo đối tượng đang giao tiếp theo đúng bảng hồ sơ.
4. TÍNH NHẤT QUÁN TRONG PHÂN CẢNH: Trong cùng một cuộc hội thoại giữa 2 nhân vật, cách xưng hô phải giữ đồng nhất từ đầu đến cuối cảnh, tuyệt đối không nhảy xưng hô lộn xộn (lúc xưng 'tôi', lúc xưng 'anh', lúc xưng 'tớ' trong cùng 1 câu chuyện).
5. TỰ NHIÊN HÓA HẬU TỐ VÀ KÍNH NGỮ:
   - Truyện Nhật: Các hậu tố -san, -senpai, -kun, -chan, -sensei phải chuyển hóa thành xưng hô tiếng Việt tự nhiên ("anh/chị [Tên]", "tiền bối", "thầy/cô", hoặc gọi tên thân mật), không giữ nguyên đuôi "-san", "-kun" gượng gạo.
   - Truyện Trung: Phân biệt rõ cổ trang/tiên hiệp (ta - ngươi, huynh - đệ, sư phụ - đồ nhi, tiền bối - vãn bối) và hiện đại/đô thị (tôi - cậu, anh - em).`;
    }

    if (bookMemory) {
      instructions += `\n\nGlobal Plot/Character Memory for this book:\n"""\n${bookMemory}\n"""`;
    }

    if (context && !instructions.includes('Previous context')) {
      instructions += `\n\nPrevious context for local consistency:\n"""\n${context}\n"""`;
    }

    return instructions;
  }

  /**
   * Build user prompt content with surrounding context
   */
  static buildUserContent({ text, context = '' }) {
    if (context) {
      return `Previous context for consistency:\n"""\n${context}\n"""\n\nText to translate:\n${text}`;
    }
    return text;
  }

  /**
   * Clean and sanitize glossary translation value to ensure no raw foreign text
   * or explanatory notes (parentheses, tier/level descriptions) are injected.
   */
  static cleanGlossaryValue(val, key = '') {
    if (!val || typeof val !== 'string') return '';
    let clean = val.trim();

    // 1. Check if outside is purely foreign (Hangul, Hanzi, Kana) and inside parentheses is Vietnamese/Latin translation
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

    // 2. Remove any remaining explanatory parentheses
    clean = clean.replace(/\s*[\(\[（【][^)\]）】]*(?:ma vật|kỹ năng|thuật ngữ|tên viết tắt|quê hương|nghĩa là|chú thích|tước hiệu|chức nghiệp|cấp [A-Z0-9]|rank|tier|level|giải thích)[^)\]）】]*[\)\]）】]/gi, '');
    
    // 3. Remove any parenthesis containing foreign script
    clean = clean.replace(/\s*[\(\[（【][^)\]）】]*[\uac00-\ud7af\u4e00-\u9fa5\u3040-\u30ff][^)\]）】]*[\)\]）】]/g, '');

    // 4. Strip any foreign characters and surrounding quotes or slashes
    clean = clean.replace(/\s*[/|\-]?\s*['"‘“「]?[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\u4e00-\u9fa5\u3040-\u30ff]+['"’”」]?/g, '');

    // 5. Clean up multiple slashes
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
  }
}

module.exports = PromptBuilder;
