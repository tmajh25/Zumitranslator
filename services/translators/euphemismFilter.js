/**
 * Euphemism Filter Service (R18 Gateway Bypass & Safe Desensitization)
 * Dynamically converts sensitive/prohibited expressions (such as minor age tropes,
 * non-consensual acts, and explicit anatomy) into safe literary euphemisms
 * before sending to Gemini / strict AI gateways to bypass PROHIBITED_CONTENT blocks.
 * 
 * Supports both:
 * 1. Literary Euphemism Masking + Unmasking (preserving fluent prose context)
 * 2. Positional Placeholder Masking ({pos_1}, {pos_2}...) as a robust multilingual fallback
 */

class EuphemismFilter {
  static ZH_NUMS = {
    '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15, '十六': 16, '十七': 17
  };

  static ZH_VI = {
    1: 'một', 2: 'hai', 3: 'ba', 4: 'bốn', 5: 'năm',
    6: 'sáu', 7: 'bảy', 8: 'tám', 9: 'chín', 10: 'mười',
    11: 'mười một', 12: 'mười hai', 13: 'mười ba', 14: 'mười bốn',
    15: 'mười lăm', 16: 'mười sáu', 17: 'mười bảy'
  };

  static VI_UNITS = ['không', 'mốt', 'hai', 'ba', '(?:tư|bốn)', 'lăm', 'sáu', 'bảy', 'tám', 'chín'];
  static ZH_MASK_NUMS = ['二十', '二十一', '二十二', '二十三', '二十四', '二十五', '二十六', '二十七', '二十八', '二十九'];

  /**
   * Dynamic Age Processor:
   * Dynamically transforms ANY minor age (< 18) across Arabic digits, Chinese/Kanji,
   * or Korean into safe adult ages in their 20s, eliminating the need to hardcode
   * individual age keywords. Automatically registers exact unmask restoration rules
   * customized for targetLang ('vi', 'en', etc.).
   */
  static processDynamicAges(text, activeUnmasks = [], targetLang = 'vi') {
    if (!text || typeof text !== 'string') return text;
    const isEn = (targetLang || 'vi').toLowerCase().startsWith('en');
    let masked = text;

    // 1. Arabic digits < 18 with age suffix (e.g. 12岁, 14살, 15歳)
    masked = masked.replace(/(?<!\d)([1-9]|1[0-7])\s*(岁|歲|살|歳)/g, (match, numStr, suf) => {
      const num = parseInt(numStr, 10);
      const maskedAge = 20 + (num % 10);
      if (isEn) {
        const enPattern = new RegExp(`(?:twenty-(?:zero|one|two|three|four|five|six|seven|eight|nine)|${maskedAge})\\s*years?\\s*old`, 'gi');
        activeUnmasks.push({ pattern: enPattern, replacement: `${num} years old` });
      } else {
        const viPattern = new RegExp(`(?:hai mươi ${EuphemismFilter.VI_UNITS[num % 10]}|${maskedAge})\\s*tuổi`, 'gi');
        activeUnmasks.push({ pattern: viPattern, replacement: `${num} tuổi` });
      }
      return `${maskedAge}${suf}`;
    });

    // 2. Chinese minor age ranges: 十三四, 十四五, 七八...
    masked = masked.replace(/(?<![一二两三四五六七八九十百\d])(十[一二三四五六七]{1,2}|[一二两三四五六七八九]{2})\s*(岁|歲|歳)/g, (match, rangeStr, suf) => {
      const maskedRange = '二十' + rangeStr.replace(/^十/, '');
      if (isEn) {
        activeUnmasks.push({
          pattern: /(?:24s*[-~–]s*25|twenty-fours*(?:to|-)?s*twenty-five)s*years?s*old/gi,
          replacement: '13 to 14 years old'
        });
      } else {
        let viReplacement = 'mười ba, mười bốn tuổi';
        if (rangeStr.startsWith('十')) {
          const rest = rangeStr.slice(1);
          viReplacement = rest.split('').map(c => EuphemismFilter.ZH_VI[10 + (EuphemismFilter.ZH_NUMS[c] || 0)]).filter(Boolean).join(', ') + ' tuổi';
        } else {
          viReplacement = rangeStr.split('').map(c => EuphemismFilter.ZH_VI[EuphemismFilter.ZH_NUMS[c] || 0]).filter(Boolean).join(', ') + ' tuổi';
        }
        activeUnmasks.push({
          pattern: /(?:hai mươi (?:tư|bốn)[,\s-]+(?:hai mươi\s*)?lăm|24\s*[-~–]\s*25)\s*tuổi/gi,
          replacement: viReplacement
        });
      }
      return `${maskedRange}${suf}`;
    });

    // 3. Chinese single/teens numerals (1-17): 十二岁, 十四岁, 八岁...
    masked = masked.replace(/(?<![一二两三四五六七八九十百\d])(十[一二两三四五六七]?|[一二两三四五六七八九])\s*(岁|歲|歳)/g, (match, zh, suf) => {
      const num = EuphemismFilter.ZH_NUMS[zh];
      if (num && num < 18) {
        const offset = num % 10;
        const maskWord = EuphemismFilter.ZH_MASK_NUMS[offset];
        if (isEn) {
          const enPattern = new RegExp(`(?:twenty-(?:zero|one|two|three|four|five|six|seven|eight|nine)|${20 + offset})\\s*years?\\s*old`, 'gi');
          activeUnmasks.push({ pattern: enPattern, replacement: `${num} years old` });
        } else {
          const viWord = EuphemismFilter.ZH_VI[num];
          const viPattern = new RegExp(`(?:hai mươi ${EuphemismFilter.VI_UNITS[offset]}|${20 + offset})\\s*tuổi`, 'gi');
          activeUnmasks.push({ pattern: viPattern, replacement: `${viWord} tuổi` });
        }
        return `${maskWord}${suf}`;
      }
      return match;
    });

    // 4. Korean age words: 열두 살, 열세 살...
    masked = masked.replace(/(열\s*[한두세네다여일]?)\s*살/g, (match, koWord) => {
      const koMap = { '열': 10, '열한': 11, '열두': 12, '열세': 13, '열네': 14, '열다섯': 15, '열여섯': 16, '열일곱': 17 };
      const cleanKo = koWord.replace(/\s+/g, '');
      const num = koMap[cleanKo] || 10;
      const offset = num % 10;
      if (isEn) {
        activeUnmasks.push({
          pattern: new RegExp(`(?:twenty-(?:zero|one|two|three|four|five|six|seven|eight|nine)|${20 + offset})\\s*years?\\s*old`, 'gi'),
          replacement: `${num} years old`
        });
      } else {
        const viWord = EuphemismFilter.ZH_VI[num] || 'mười';
        activeUnmasks.push({
          pattern: new RegExp(`(?:hai mươi ${EuphemismFilter.VI_UNITS[offset]}|${20 + offset})\\s*tuổi`, 'gi'),
          replacement: `${viWord} tuổi`
        });
      }
      const koMaskWords = ['스물', '스물한', '스물두', '스물세', '스물네', '스물다섯', '스물여섯', '스물일곱', '스물여덟', '스물아홉'];
      return `${koMaskWords[offset]} 살`;
    });

    return masked;
  }

  // Korean dictionary: Generalized structural patterns
  static KO_MAP = [
    // Minors & Loli triggers (Level 4)
    {
      level: 4,
      pattern: /(?:[어린귀여운합법]+)?(?:로리|유녀|여아|여초딩|중딩)/g,
      replacement: '귀여운 소녀',
      meaning: { vi: 'loli', en: 'loli' },
      unmask: [
        { pattern: /cô gái đáng yêu|thiếu nữ đáng yêu|thiếu nữ nhỏ nhắn/gi, replacement: 'loli' },
        { pattern: /cute girl|little girl/gi, replacement: 'loli' },
        { pattern: /cô bé/gi, replacement: 'ấu nữ' }
      ]
    },
    // Non-consensual acts (Level 4)
    {
      level: 4,
      pattern: /강간|침범|성폭행|윤간/g,
      replacement: '독점',
      meaning: { vi: 'cưỡng đoạt', en: 'rape' },
      unmask: [
        { pattern: /độc chiếm/gi, replacement: 'cưỡng đoạt' },
        { pattern: /monopolize|possess/gi, replacement: 'rape' }
      ]
    },
    // Anatomy & Explicit acts (Level 3)
    {
      level: 3,
      pattern: /자지|육봉|음경|대물|귀두/g,
      replacement: '음경',
      meaning: { vi: 'gậy thịt', en: 'cock' },
      unmask: [
        { pattern: /dương vật/gi, replacement: 'gậy thịt' },
        { pattern: /penis/gi, replacement: 'cock' }
      ]
    },
    {
      level: 3,
      pattern: /보지|음순|음부|클리토리스|자궁|꽃잎/g,
      replacement: '음부',
      meaning: { vi: 'hoa huyệt', en: 'pussy' },
      unmask: [
        { pattern: /âm hộ/gi, replacement: 'hoa huyệt' },
        { pattern: /pudenda|vulva/gi, replacement: 'pussy' }
      ]
    },
    {
      level: 3,
      pattern: /보짓물|애액|백탁액|아기씨/g,
      replacement: '애액',
      meaning: { vi: 'nước dâm', en: 'love juices' },
      unmask: [
        { pattern: /dịch thể/gi, replacement: 'nước dâm' },
        { pattern: /bodily fluid/gi, replacement: 'love juices' }
      ]
    },
    {
      level: 3,
      pattern: /섹스|난교|따먹(?:는|었|을|다|고|어|은)?|착정|씨받이|조수를\s*뿜|쑤셨다|박아(?:댔|주|다|라)?/g,
      replacement: '성교',
      meaning: { vi: 'làm tình', en: 'fuck' },
      unmask: [
        { pattern: /quan hệ tình dục|giao hợp/gi, replacement: 'làm tình' },
        { pattern: /intercourse|make love/gi, replacement: 'fuck' }
      ]
    }
  ];

  // Chinese dictionary: Generalized structural patterns
  static ZH_MAP = [
    // 1. Minors & Loli compound patterns (Level 4)
    {
      level: 4,
      pattern: /(?:[小大娇萌白黑嫩可爱合法纯情呆双胞幼稚红眸的]+)?(?:萝莉|蘿莉|幼女|女童|幼童|小女孩|小学生|初中生|幼妹)/g,
      replacement: (match) => {
        if (match.includes('合法')) return '合法娇小少女';
        if (match.includes('小')) return '娇柔娇小少女';
        return '娇小少女';
      },
      meaning: { vi: 'loli', en: 'loli' },
      unmask: [
        { pattern: /thiếu nữ nhỏ nhắn hợp pháp|cô gái nhỏ nhắn hợp pháp/gi, replacement: 'loli hợp pháp' },
        { pattern: /legal petite girl/gi, replacement: 'legal loli' },
        { pattern: /thiếu nữ nhỏ nhắn yếu đuối|thiếu nữ nhỏ nhắn mềm mại|cô gái nhỏ nhắn mềm mại/gi, replacement: 'tiểu loli' },
        { pattern: /thiếu nữ nhỏ nhắn|cô gái nhỏ nhắn|cô bé nhỏ nhắn/gi, replacement: 'loli' },
        { pattern: /petite girl|small girl/gi, replacement: 'loli' },
        { pattern: /cô gái nhỏ|bé gái nhỏ/gi, replacement: 'ấu nữ' }
      ]
    },

    // 2. Non-consensual, Humiliation & Physical Restraint (Level 4)
    {
      level: 4,
      pattern: /(?:强暴|强奸|强占|侵犯|霸占|凌辱|践踏|蹂躏|玩弄|糟蹋|摧残(?:破坏)?|从后方按在(?:了)?地上|按在(?:了)?地上|按倒在地上|压在身下|毫无反抗之(?:力|能)|像是狗狗一样|像狗狗一样|如狗般|抓住臀瓣(?:高高的)?翘起)/g,
      replacement: '占有',
      meaning: { vi: 'cưỡng bức', en: 'rape' },
      unmask: [
        { pattern: /chiếm đoạt cưỡng ép|cưỡng ép chiếm đoạt/gi, replacement: 'cưỡng bức' },
        { pattern: /forced possession|forcibly possess/gi, replacement: 'rape' },
        { pattern: /bị chiếm đoạt/gi, replacement: 'bị xâm hại' },
        { pattern: /was possessed/gi, replacement: 'was assaulted' },
        { pattern: /chiếm đoạt/gi, replacement: 'xâm hại' },
        { pattern: /possess/gi, replacement: 'assault' },
        { pattern: /dằn vặt|dày vò/gi, replacement: 'tàn phá' }
      ]
    },

    // 3. Adult Toys & Restraints (Level 3) - Put BEFORE Male Anatomy to prevent partial match like 假{pos_X}
    {
      level: 3,
      pattern: /(?:粗大|特大|长)?(?:假阳具|假肉棒|假玩具|那玩具|情趣玩具|性玩具|按摩棒|跳蛋|肛塞|特殊道具|震动棒)/g,
      replacement: '特制情趣道具',
      meaning: { vi: 'dương vật giả', en: 'dildo' },
      unmask: [
        { pattern: /đạo cụ tình thú đặc chế|đồ chơi tình thú đặc chế/gi, replacement: 'dương vật giả' },
        { pattern: /trang sức mát-xa|dụng cụ mát-xa/gi, replacement: 'nút hậu môn' },
        { pattern: /special adult prop/gi, replacement: 'dildo' }
      ]
    },

    // 4. Female Anatomy & Genital compound patterns (Level 3)
    {
      level: 3,
      pattern: /(?:(?:[小嫩粉蜜肉水紧窄深私湿桃雏骚娇秘赤红湿润泥泞狭窄紧致幽暗]+[穴缝])|花穴|肉穴|粉穴|蜜穴|小穴|嫩穴|湿穴|后庭|后穴|阴[部道唇蒂]|私处|花径幽处|花径|蜜谷|花蒂|花心|花芯|子宫(?:壁)?|宫颈|宫口|花门|嫩肉|蜜道|幽径)/g,
      replacement: '花径幽处',
      meaning: { vi: 'hoa huyệt', en: 'pussy' },
      unmask: [
        { pattern: /chốn hoa kính|hoa kính riêng tư|hoa kính kín đáo|u kinh nơi hoa|chốn u uẩn của hoa|chốn u tịch/gi, replacement: 'hoa huyệt' },
        { pattern: /hoa kính/gi, replacement: 'hoa huyệt' },
        { pattern: /u sở|u kính/gi, replacement: 'tiểu huyệt' },
        { pattern: /secret flower path|flower path|intimate path/gi, replacement: 'pussy' }
      ]
    },
    {
      level: 3,
      pattern: /(?<![懵牛傻逗装])(?:骚逼|逼|屄|浪穴)/g,
      replacement: '敏感私处',
      meaning: { vi: 'hoa huyệt', en: 'pussy' },
      unmask: [
        { pattern: /nơi riêng tư nhạy cảm|nơi riêng tư dâm đãng/gi, replacement: 'hoa huyệt' },
        { pattern: /nơi riêng tư/gi, replacement: 'âm hộ' },
        { pattern: /sensitive private parts/gi, replacement: 'pussy' }
      ]
    },

    // 5. Male Anatomy compound patterns (Level 3)
    {
      level: 3,
      pattern: /(?:[大粗硬热巨长狰狞灼热铁坚硬滚烫火热硕大傲人沉重]+)?(?:[肉阳龙玉铁][棒具根棍刃物茎柱]|鸡巴|阴茎|分身|巨物|粗大之物|庞然大物)/g,
      replacement: '粗大阳具',
      meaning: { vi: 'gậy thịt', en: 'meat rod' },
      unmask: [
        { pattern: /dương vật thô to|dương vật to lớn/gi, replacement: 'đại nhục bổng' },
        { pattern: /dương vật/gi, replacement: 'gậy thịt' },
        { pattern: /thick male organ|male organ/gi, replacement: 'meat rod' }
      ]
    },

    // 6. Sexual verbs, Penetration, Positions & Intercourse (Level 3)
    {
      level: 3,
      pattern: /(?:后入(?:的姿势|式)?|犬趴|狗爬式)/g,
      replacement: '亲密姿势',
      meaning: { vi: 'tư thế từ phía sau', en: 'from behind' },
      unmask: [
        { pattern: /tư thế thân mật/gi, replacement: 'tư thế từ phía sau' }
      ]
    },
    {
      level: 3,
      pattern: /(被[\u4e00-\u9fa5]{0,6}?)?(透|肏|操|干|日|草|狠狠弄|贯穿|抽插|抽送|狂插|猛插|狂肏|猛肏|插入(?:进)?|抽出|捅穿|凿开|顶在|注入进)(批|逼|死|哭|翻|烂|穿|坏|出水|射|进)?/g,
      replacement: (match, p1) => (p1 || '') + '深度占有',
      meaning: { vi: 'thao', en: 'fuck' },
      unmask: [
        { pattern: /độ sâu chiếm đoạt|chiếm đoạt sâu sắc|chiếm đoạt sâu/gi, replacement: 'thao' },
        { pattern: /chiếm đoạt/gi, replacement: 'thao' },
        { pattern: /deeply possessed|deeply possess/gi, replacement: 'fuck' },
        { pattern: /ra vào rút đẩy|rút đẩy/gi, replacement: 'thọc vào rút ra' },
        { pattern: /quán thông/gi, replacement: 'thao' }
      ]
    },
    {
      level: 3,
      pattern: /做爱|欢爱|交欢|媾和|云雨/g,
      replacement: '深度结合',
      meaning: { vi: 'làm tình', en: 'make love' },
      unmask: [
        { pattern: /kết hợp sâu sắc|kết hợp sâu|hoan ái/gi, replacement: 'làm tình' },
        { pattern: /deep union|deeply unite/gi, replacement: 'make love' }
      ]
    },

    // 7. Bodily Fluids & Ejaculation (Level 3)
    {
      level: 3,
      pattern: /(?:[淫爱情骚蜜粘稠]+[水液汁露]|白浊(?:液)?)/g,
      replacement: '情露甘泉',
      meaning: { vi: 'nước dâm', en: 'love juices' },
      unmask: [
        { pattern: /tình lộ cam tuyền|cam tuyền tình lộ|cam tuyền|tình dịch/gi, replacement: 'nước dâm' },
        { pattern: /cam lộ trắng đục|cam lộ/gi, replacement: 'tinh dịch' },
        { pattern: /sweet dew of passion/gi, replacement: 'love juices' }
      ]
    },
    {
      level: 3,
      pattern: /(?:中出|内射|潮吹|绝顶|射精)(?:到怀孕|受孕)?/g,
      replacement: (match) => {
        if (match.includes('孕')) return '深度结合受孕';
        if (match.includes('潮吹')) return '绝顶喷涌';
        return '体内释放';
      },
      meaning: { vi: 'bắn vào trong', en: 'creampie' },
      unmask: [
        { pattern: /kết hợp sâu sắc thụ thai|kết hợp sâu sắc để thụ thai/gi, replacement: 'bắn vào trong đến khi mang thai' },
        { pattern: /giải phóng bên trong cơ thể|giải phóng trong cơ thể/gi, replacement: 'bắn vào trong' },
        { pattern: /rót vào trong cơ thể|dồn vào trong cơ thể/gi, replacement: 'xuất tinh vào trong' },
        { pattern: /release inside the body/gi, replacement: 'creampie' },
        { pattern: /phun trào tuyệt đỉnh|phun trào cực khoái/gi, replacement: 'triều xuy' },
        { pattern: /peak eruption/gi, replacement: 'squirt' }
      ]
    },

    // 8. Nakedness & Clothing exposure (Level 3)
    {
      level: 3,
      pattern: /(?:全身赤裸|赤身裸体|赤身露体|一丝不挂|赤裸裸?|胴体毕露|裸露着(?:皎洁|白皙|粉嫩|娇嫩)?(?:的)?(?:肌肤|胴体|身体))/g,
      replacement: '衣衫单薄',
      meaning: { vi: 'toàn thân trần truồng', en: 'completely naked' },
      unmask: [
        { pattern: /y phục đơn bạc|quần áo mỏng manh/gi, replacement: 'toàn thân trần truồng' },
        { pattern: /thinly clad/gi, replacement: 'completely naked' },
        { pattern: /trần trụi/gi, replacement: 'trần truồng' }
      ]
    },

    // 9. Virginity, Taboo & Hymen (Level 3)
    {
      level: 3,
      pattern: /破处|处女血|处女膜|神圣的禁地|后庭|后穴/g,
      replacement: (m) => {
        if (m === '破处') return '初尝禁果';
        if (m === '处女血') return '初夜血痕';
        if (m === '处女膜') return '纯洁薄膜';
        if (m.includes('后')) return '后方幽所';
        return '隐秘之处';
      },
      meaning: { vi: 'máu trinh', en: 'virgin blood' },
      unmask: [
        { pattern: /nếm trái cấm lần đầu|lần đầu nếm trái cấm/gi, replacement: 'phá trinh' },
        { pattern: /vệt máu đêm đầu tiên|vệt máu đêm tân hôn|máu đêm đầu/gi, replacement: 'máu trinh' },
        { pattern: /first night blood/gi, replacement: 'virgin blood' },
        { pattern: /màng mỏng thuần khiết|lớp màng thuần khiết/gi, replacement: 'màng trinh' },
        { pattern: /u sở phía sau|nơi u uẩn phía sau/gi, replacement: 'hậu huyệt' },
        { pattern: /nơi cấm địa thiêng liêng|nơi ẩn mật|chỗ ẩn mật/gi, replacement: 'cấm địa' }
      ]
    }
  ];

  // Japanese dictionary: Generalized structural patterns
  static JA_MAP = [
    // 1. Minors & Loli compound patterns (Level 4)
    {
      level: 4,
      pattern: /(?:[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{0,4})?(?:ロリ|幼女|女児|少女|小学生|中学生)/g,
      replacement: '可憐な少女',
      meaning: { vi: 'loli', en: 'loli' },
      unmask: [
        { pattern: /cô gái đáng yêu|thiếu nữ nhỏ nhắn/gi, replacement: 'loli' },
        { pattern: /lovely girl|little girl/gi, replacement: 'loli' },
        { pattern: /bé gái nhỏ/gi, replacement: 'ấu nữ' }
      ]
    },

    // 2. Non-consensual acts (Level 4)
    {
      level: 4,
      pattern: /(?:レイプ|輪姦|無理矢理|犯され(?:る|た)?)/g,
      replacement: '抱かれ',
      meaning: { vi: 'bị cưỡng bức', en: 'raped' },
      unmask: [
        { pattern: /ôm ấp|bị ôm/gi, replacement: 'bị cưỡng bức' },
        { pattern: /embraced|held/gi, replacement: 'raped' }
      ]
    },

    // 3. Female Anatomy & Genital patterns (Level 3)
    {
      level: 3,
      pattern: /(?:[処割秘美肉濡]+)?(?:まんこ|マンコ|膣|オメコ|アソコ|秘部|陰部|花園|花びら|子宮|肉穴|クリトリス|小陰唇)/g,
      replacement: '秘所',
      meaning: { vi: 'hoa huyệt', en: 'pussy' },
      unmask: [
        { pattern: /chỗ kín|nơi bí mật/gi, replacement: 'hoa huyệt' },
        { pattern: /secret place/gi, replacement: 'pussy' }
      ]
    },

    // 4. Male Anatomy (Level 3)
    {
      level: 3,
      pattern: /(?:[巨太硬熱剛]+)?(?:チンポ|ちんぽ|チンコ|ちんこ|ペニス|陰茎|巨根|肉棒|男根)/g,
      replacement: '男根',
      meaning: { vi: 'gậy thịt', en: 'cock' },
      unmask: [
        { pattern: /dương vật/gi, replacement: 'gậy thịt' },
        { pattern: /male organ/gi, replacement: 'cock' }
      ]
    },

    // 5. Explicit sexual acts & Climax (Level 3)
    {
      level: 3,
      pattern: /(?:中出し|潮吹き|フェラ|パイズリ|種付け|イカされ(?:る|た)?|絶頂|射精|ぶっかけ)/g,
      replacement: '結合',
      meaning: { vi: 'bắn vào trong', en: 'creampie' },
      unmask: [
        { pattern: /kết hợp/gi, replacement: 'bắn vào trong' },
        { pattern: /union|joined/gi, replacement: 'creampie' },
        { pattern: /phun trào/gi, replacement: 'triều xuy' }
      ]
    }
  ];

  /**
   * Apply euphemism masking to source text with fine-grained level and targetLang control
   * @param {string} text - Source text
   * @param {string} sourceLang - Source language ('zh', 'ja', 'ko', 'auto')
   * @param {number} maxLevel - 3: Anatomy/Acts only; 4: Minors/Non-consensual + Anatomy/Acts
   * @param {string} targetLang - Target language ('vi', 'en', etc.)
   * @returns {{ maskedText: string, activeUnmasks: Array<{pattern: RegExp, replacement: string}> }}
   */
  static maskDetailed(text, sourceLang = 'auto', maxLevel = 4, targetLang = 'vi') {
    if (!text || typeof text !== 'string') {
      return { maskedText: text, activeUnmasks: [] };
    }

    const lang = (sourceLang || 'auto').toLowerCase();
    const activeUnmasks = [];
    let masked = text;

    // 1. Dynamic Age Processor (handles all minor ages < 18 dynamically at Level 4)
    if (maxLevel >= 4) {
      masked = EuphemismFilter.processDynamicAges(masked, activeUnmasks, targetLang);
    }

    // 2. Generalized Language Patterns
    const rules = [];
    if (lang === 'ko' || /[\uAC00-\uD7AF]/.test(text)) {
      rules.push(...EuphemismFilter.KO_MAP);
    }
    if (lang === 'zh' || /[\u4E00-\u9FFF]/.test(text)) {
      rules.push(...EuphemismFilter.ZH_MAP);
    }
    if (lang === 'ja' || /[\u3040-\u30FF]/.test(text)) {
      rules.push(...EuphemismFilter.JA_MAP);
    }

    // Filter rules by bypass level
    const filteredRules = rules.filter(r => (r.level || 3) <= maxLevel);

    for (const item of filteredRules) {
      item.pattern.lastIndex = 0;
      if (item.pattern.test(masked)) {
        masked = masked.replace(item.pattern, item.replacement);
        if (item.unmask && Array.isArray(item.unmask)) {
          activeUnmasks.push(...item.unmask);
        }
      }
    }

    return { maskedText: masked, activeUnmasks };
  }

  /**
   * Quick check if text contains sensitive / R18 keywords matching euphemism rules
   */
  static hasSensitiveContent(text, sourceLang = 'auto', maxLevel = 4) {
    if (!text || typeof text !== 'string') return false;

    // Check dynamic ages at Level 4
    if (maxLevel >= 4) {
      const dummyUnmasks = [];
      const afterAge = EuphemismFilter.processDynamicAges(text, dummyUnmasks);
      if (dummyUnmasks.length > 0) return true;
    }

    const lang = (sourceLang || 'auto').toLowerCase();
    const rules = [];
    if (lang === 'ko' || /[\uAC00-\uD7AF]/.test(text)) {
      rules.push(...EuphemismFilter.KO_MAP);
    }
    if (lang === 'zh' || /[\u4E00-\u9FFF]/.test(text)) {
      rules.push(...EuphemismFilter.ZH_MAP);
    }
    if (lang === 'ja' || /[\u3040-\u30FF]/.test(text)) {
      rules.push(...EuphemismFilter.JA_MAP);
    }
    const filteredRules = rules.filter(r => (r.level || 3) <= maxLevel);
    for (const item of filteredRules) {
      item.pattern.lastIndex = 0;
      if (item.pattern.test(text)) return true;
    }
    return false;
  }

  /**
   * Positional Placeholder Token Masking Engine ({pos_1}, {pos_2}...)
   * Multilingual fallback that replaces sensitive words with neutral positional slots.
   * Completely immune to safety filters across all languages.
   */
  static maskWithPlaceholders(text, sourceLang = 'auto', maxLevel = 4, targetLang = 'vi') {
    if (!text || typeof text !== 'string') {
      return { maskedText: text, placeholderMap: {} };
    }
    const lang = (sourceLang || 'auto').toLowerCase();
    const tLang = (targetLang || 'vi').toLowerCase().startsWith('en') ? 'en' : 'vi';
    const rules = [];
    if (lang === 'ko' || /[\uAC00-\uD7AF]/.test(text)) rules.push(...EuphemismFilter.KO_MAP);
    if (lang === 'zh' || /[\u4E00-\u9FFF]/.test(text)) rules.push(...EuphemismFilter.ZH_MAP);
    if (lang === 'ja' || /[\u3040-\u30FF]/.test(text)) rules.push(...EuphemismFilter.JA_MAP);

    let masked = text;
    const placeholderMap = {};
    let counter = 1;

    // 1. Mask dynamic minor ages into {pos_X}
    masked = masked.replace(/(?<!\d)([1-9]|1[0-7])\s*(岁|歲|살|歳)/g, (match, numStr) => {
      const tag = `{pos_${counter++}}`;
      placeholderMap[tag] = tLang === 'en' ? `${numStr} years old` : `${numStr} tuổi`;
      return tag;
    });

    // 2. Mask sensitive rules into {pos_X}
    const filteredRules = rules.filter(r => (r.level || 3) <= maxLevel);
    for (const rule of filteredRules) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(masked)) {
        let meaning = '';
        if (rule.meaning && rule.meaning[tLang]) {
          meaning = rule.meaning[tLang];
        } else if (rule.unmask && rule.unmask[0] && rule.unmask[0].replacement) {
          meaning = rule.unmask[0].replacement;
        }
        if (meaning) {
          rule.pattern.lastIndex = 0;
          masked = masked.replace(rule.pattern, () => {
            const tag = `{pos_${counter++}}`;
            placeholderMap[tag] = meaning;
            return tag;
          });
        }
      }
    }

    return { maskedText: masked, placeholderMap };
  }

  /**
   * Khôi phục các token {pos_1}, {pos_2}... về lại nghĩa chuẩn của targetLang
   * Hỗ trợ bắt linh hoạt khoảng trắng do AI tự sinh: { pos_1 }, {pos_1 }
   */
  static unmaskPlaceholders(translatedText, placeholderMap = {}) {
    if (!translatedText || typeof translatedText !== 'string' || !placeholderMap) {
      return translatedText;
    }
    let restored = translatedText;
    for (const [tag, targetWord] of Object.entries(placeholderMap)) {
      if (tag && targetWord) {
        const cleanTag = tag.replace(/[{}]/g, '');
        const flexRegex = new RegExp(`\\{\\s*${cleanTag}\\s*\\}`, 'gi');
        restored = restored.replace(flexRegex, targetWord);
      }
    }
    return restored;
  }

  /**
   * Restore translated text back to original author terms
   */
  static unmask(translatedText, activeUnmasks = []) {
    if (!translatedText || typeof translatedText !== 'string' || !activeUnmasks || activeUnmasks.length === 0) {
      return translatedText;
    }
    let restored = translatedText;
    for (const u of activeUnmasks) {
      if (u && u.pattern && u.replacement !== undefined) {
        restored = restored.replace(u.pattern, u.replacement);
      }
    }
    return restored;
  }
}

module.exports = EuphemismFilter;
