/**
 * CHAPTER PARSER & VALIDATOR MODULE
 * Responsible for:
 * 1. Splitting content into chapters (Regex patterns, Chapter break markers, and fallback slicing)
 * 2. Number extraction (Arabic and Chinese/Sino-Vietnamese numerals)
 * 3. Chapter title calculation and auto-numbering
 * 4. Missing chapter detection (physical gaps in original text + untranslated chapters)
 * 5. Chapter selection list rendering
 */

const ChapterParser = {
  setChapters(chapters) {
    State.chapters = chapters.map((c, index) => {
      let rawTitle = c.title || `Chương ${index + 1}`;
      if (rawTitle === 'Bìa & Minh họa') rawTitle = 'Cover';
      let origTitle = c.originalTitle || rawTitle;
      if (origTitle === 'Bìa & Minh họa') origTitle = 'Cover';
      const title = rawTitle;
      const numValue = this.extractNumFromTitle(title);
      const specialTitles = ['lời nói đầu', 'giới thiệu', 'mở đầu', 'kết thúc', 'ngoại truyện', 'vĩ thanh', 'lời tác giả', 'phụ lục', 'cover'];
      const isSpecial = specialTitles.some(s => title.toLowerCase().includes(s));
      return {
        id: index,
        title: title,
        originalTitle: origTitle,
        content: c.content || '',
        charCount: c.content ? c.content.length : 0,
        wordCount: c.content ? Utils.countWords(c.content) : 0,
        selected: c.selected !== undefined ? c.selected : false,
        shouldNumber: c.shouldNumber !== undefined ? c.shouldNumber : !isSpecial,
        num: numValue
      };
    });
    this.syncSavedSelection();
    this.autoDetectLanguageStatus();
    this.recalculateTitles();
    this.renderChapterList();
    if (typeof window !== 'undefined' && window.Translation && typeof window.Translation.resetFileUI === 'function') {
      window.Translation.resetFileUI();
    }
  },

  autoDetectLanguageStatus() {
    if (typeof window !== 'undefined' && window.ProgressDetector && typeof window.ProgressDetector.matchesTargetLanguage === 'function') {
      const targetLang = (State.settings && State.settings.targetLang) || 'vi';
      const targetInfo = ProgressDetector.getLangInfo(targetLang);

      const finishedMap = new Map();
      (State.finishedChapters || []).forEach(fc => {
        if (fc.sourceChapterId !== undefined) {
          finishedMap.set(fc.sourceChapterId, fc);
          finishedMap.set(String(fc.sourceChapterId), fc);
        }
        if (fc.id !== undefined) {
          finishedMap.set(fc.id, fc);
          finishedMap.set(String(fc.id), fc);
        }
      });

      State.chapters.forEach(ch => {
        const fc = finishedMap.get(ch.id) || finishedMap.get(String(ch.id));
        const textToCheck = (fc && fc.content && fc.content.trim()) 
          ? fc.content 
          : ((ch.content && ch.content.trim()) ? ch.content : '');
        const hasImg = /\[IMG:[^\]]+\]/.test(ch.content || '');
        if (!textToCheck && !hasImg) {
          ch._langEvaluation = {
            id: ch.id,
            status: 'empty',
            statusLabel: 'Chương trống',
            badgeClass: 'badge-empty',
            detectedLang: 'empty',
            langName: 'Trống',
            flag: '⚪',
            foreignCount: 0,
            isTranslated: false
          };
          return;
        }

        const isTarget = ProgressDetector.matchesTargetLanguage(textToCheck, targetLang);
        if (isTarget) {
          ch._langEvaluation = {
            id: ch.id,
            status: 'translated',
            statusLabel: targetInfo.name,
            badgeClass: 'badge-translated',
            detectedLang: targetLang,
            langName: targetInfo.name,
            flag: '🟢',
            foreignCount: 0,
            isTranslated: true
          };
        } else {
          const detected = ProgressDetector.detectLanguageOffline(textToCheck);
          const langInfo = ProgressDetector.getLangInfo(detected);
          ch._langEvaluation = {
            id: ch.id,
            status: 'untranslated',
            statusLabel: langInfo.name,
            badgeClass: 'badge-untranslated',
            detectedLang: detected,
            langName: langInfo.name,
            flag: langInfo.flag || '🌐',
            foreignCount: 0,
            isTranslated: false
          };
        }
      });
    }
  },

  processChapters(content) {
    State.chapters = [];
    const regex = /^\s*(Chương|Chapter|Tiết|Quyển|Tập|Vol|Volume|Phần|第)\s*([0-9\u2140-\u214f\u4e00-\u9fa5\u3040-\u30ff]+)\s*[:.-]?\s*(.*)$/gim;
    
    if (content.includes('---CHAPTER_BREAK---')) {
      const parts = content.split('---CHAPTER_BREAK---');
      parts.forEach((part, index) => {
        const trimmed = part.trim();
        if (!trimmed) return;
        const firstLine = trimmed.split('\n')[0].trim();
        const cleanTitle = firstLine.length < 100 ? firstLine : `Chương ${index + 1}`;
        const specialTitles = ['lời nói đầu', 'giới thiệu', 'mở đầu', 'kết thúc', 'ngoại truyện', 'vĩ thanh', 'lời tác giả', 'phụ lục'];
        const isSpecial = specialTitles.some(s => cleanTitle.toLowerCase().includes(s));
        
        const numValue = this.extractNumFromTitle(cleanTitle);

        State.chapters.push({
          id: index,
          title: cleanTitle,
          originalTitle: cleanTitle,
          content: trimmed,
          selected: true,
          shouldNumber: !isSpecial,
          num: numValue
        });
      });
    } else {
      const matches = [...content.matchAll(regex)];
      if (matches.length > 0) {
        matches.forEach((match, index) => {
          const start = match.index;
          const nextStart = matches[index + 1] ? matches[index + 1].index : content.length;
          const part = content.substring(start, nextStart).trim();
          if (part) {
            const fullMatch = match[0].trim();
            const numValue = this.extractNumFromTitle(fullMatch);

            State.chapters.push({
              id: index,
              title: fullMatch.substring(0, 80),
              originalTitle: fullMatch,
              content: part,
              selected: true,
              shouldNumber: !/^\s*(Chương|Chapter|Tiết|第|Phần)\s*[0-9\u4e00-\u9fa5]+/i.test(fullMatch),
              num: numValue
            });
          }
        });
      } else {
        this.fallbackSplit(content);
      }
    }
    
    this.syncSavedSelection();
    this.autoDetectLanguageStatus();
    this.recalculateTitles();
    this.renderChapterList();
    if (typeof window !== 'undefined' && window.Translation && typeof window.Translation.resetFileUI === 'function') {
      window.Translation.resetFileUI();
    }
  },

  checkMissingChapters() {
    if (State.chapters.length === 0) {
      Utils.showToast('Chưa có chương nào để kiểm tra!', 'info');
      return;
    }

    // 1. Kiểm tra đánh số vật lý (gaps trong file)
    const numbers = State.chapters
      .filter(ch => ch.num !== null)
      .map(ch => ch.num)
      .sort((a, b) => a - b);

    let gaps = [];
    let min = 0, max = 0;
    if (numbers.length >= 2) {
      min = numbers[0];
      max = numbers[numbers.length - 1];
      const numSet = new Set(numbers);
      for (let i = min; i <= max; i++) {
        if (!numSet.has(i)) gaps.push(i);
      }
    }

    // 2. Kiểm tra chương chưa dịch
    const untranslated = State.chapters.filter(ch => 
      !State.finishedChapters.some(fc => fc.sourceChapterId === ch.id)
    );

    // 3. Hiển thị báo cáo
    let reports = [];

    if (gaps.length > 0) {
      const gapMsg = gaps.length > 20 
        ? `Thiếu ${gaps.length} chương vật lý. Ví dụ: ${gaps.slice(0, 10).join(', ')}...`
        : `Các chương bị khuyết trong tệp (theo đánh số): ${gaps.join(', ')}`;
      reports.push(`THIẾU TRONG TỆP GỐC:\n${gapMsg}\n(Kiểm tra lại file đầu vào xem có bị sót chương không)`);
    } else if (numbers.length >= 2) {
      reports.push(`Tệp gốc đầy đủ các chương từ ${min} đến ${max}.`);
    } else {
      reports.push(`Không tìm thấy đánh số chương tự động để kiểm tra khuyết tệp.`);
    }

    if (untranslated.length > 0) {
      const untranslatedList = untranslated.length <= 15 
        ? `\nDanh sách: ${untranslated.map(u => u.title).join(', ')}`
        : `\nLưu ý: Các chương chưa có màu xanh ở danh sách là chưa dịch.`;
      
      reports.push(`CHƯA HOÀN THÀNH:\nCó ${untranslated.length}/${State.chapters.length} chương chưa được dịch.${untranslatedList}`);
    } else {
      reports.push(`Tất cả chương trong danh sách đã được dịch xong.`);
    }

    alert(`KẾT QUẢ KIỂM TRA CHƯƠNG THIẾU\n\n${reports.join('\n\n')}`);
  },

  parseChineseNumeral(str) {
    if (!str) return null;
    const digits = {
      '零': 0, '〇': 0,
      '一': 1, '壹': 1,
      '二': 2, '贰': 2, '两': 2,
      '三': 3, '叁': 3,
      '四': 4, '肆': 4,
      '五': 5, '伍': 5,
      '六': 6, '陆': 6,
      '七': 7, '柒': 7,
      '八': 8, '捌': 8,
      '九': 9, '玖': 9
    };
    const units = {
      '十': 10, '拾': 10,
      '百': 100, '佰': 100,
      '千': 1000, '仟': 1000,
      '万': 10000,
      '亿': 100000000
    };

    let total = 0;
    let section = 0;
    let currentNum = 0;
    let hasValid = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (digits[char] !== undefined) {
        currentNum = digits[char];
        hasValid = true;
      } else if (units[char] !== undefined) {
        const unit = units[char];
        hasValid = true;
        if (unit >= 10000) {
          section = (section + currentNum);
          if (section === 0 && (unit === 10000 || unit === 100000000)) section = 1;
          total += section * unit;
          section = 0;
          currentNum = 0;
        } else {
          if (currentNum === 0 && unit === 10 && (section === 0 || i === 0)) currentNum = 1;
          section += (currentNum === 0 && unit === 10 ? 1 : currentNum) * unit;
          currentNum = 0;
        }
      } else {
        break;
      }
    }
    total += section + currentNum;
    return hasValid ? total : null;
  },

  extractNumFromTitle(text) {
    if (!text) return null;
    const clean = text.trim();

    // 1. Chapter keyword followed by Arabic digits: Chương 12, Chapter 5, 第123章
    const prefixDigitMatch = clean.match(/(?:Chương|Chapter|Tiết|Quyển|Tập|Vol|Volume|Phần|Hồi|第)\s*(\d+)/i);
    if (prefixDigitMatch) return parseInt(prefixDigitMatch[1], 10);

    // 2. Chinese chapter pattern: 第...章/回/节 or Chinese numerals after 第
    const zhPrefixMatch = clean.match(/第\s*([0-9一二两三四五六七八九十百千万零〇壹贰叁肆伍陆柒捌玖拾佰仟]+)\s*[章回节集卷]?/);
    if (zhPrefixMatch) {
      const rawZh = zhPrefixMatch[1];
      if (/^\d+$/.test(rawZh)) return parseInt(rawZh, 10);
      const parsed = this.parseChineseNumeral(rawZh);
      if (parsed !== null) return parsed;
    }

    // 3. Standalone Chinese numerals with chapter suffix: 一百二十三章
    const zhSuffixMatch = clean.match(/([一二两三四五六七八九十百千万零〇壹贰叁肆伍陆柒捌玖拾佰仟]+)\s*[章回节集卷]/);
    if (zhSuffixMatch) {
      const parsed = this.parseChineseNumeral(zhSuffixMatch[1]);
      if (parsed !== null) return parsed;
    }

    // 4. Vietnamese words explicitly after Chương or Hồi: Chương nhất, Chương một, Chương hai mươi
    const vnWordMatch = clean.match(/(?:Chương|Hồi)\s+([a-zA-Zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]+)/i);
    if (vnWordMatch) {
      const word = vnWordMatch[1].trim().toLowerCase();
      const wordMap = {
        'nhất': 1, 'một': 1,
        'nhị': 2, 'hai': 2,
        'tam': 3, 'ba': 3,
        'tứ': 4, 'bốn': 4,
        'ngũ': 5, 'năm': 5,
        'lục': 6, 'sáu': 6,
        'thất': 7, 'bảy': 7,
        'bát': 8, 'tám': 8,
        'cửu': 9, 'chín': 9,
        'thập': 10, 'mười': 10,
        'mười một': 11, 'mười hai': 12, 'mười ba': 13, 'mười bốn': 14, 'mười lăm': 15,
        'hai mươi': 20, 'ba mươi': 30
      };
      const sortedWords = Object.keys(wordMap).sort((a, b) => b.length - a.length);
      for (const w of sortedWords) {
        if (word === w || word.startsWith(w + ' ') || word.startsWith(w + ':') || word.startsWith(w + '-')) {
          return wordMap[w];
        }
      }
    }

    // 5. Leading digit if starting title (e.g., "12. Tiêu đề" or "12 - Tiêu đề")
    const leadingDigitMatch = clean.match(/^(\d+)[\s.:-]/);
    if (leadingDigitMatch) return parseInt(leadingDigitMatch[1], 10);

    // 6. Fallback general digit
    const digitMatch = clean.match(/\d+/);
    if (digitMatch) return parseInt(digitMatch[0], 10);

    return null;
  },

  fallbackSplit(content) {
    const sectionSize = 10000;
    if (content.length > sectionSize * 1.5) {
      let currentPos = 0;
      let sectionIndex = 1;
      while (currentPos < content.length) {
        let endPos = currentPos + sectionSize;
        if (endPos < content.length) {
          const nextNewline = content.indexOf('\n', endPos);
          if (nextNewline !== -1 && nextNewline < endPos + 2000) endPos = nextNewline;
        } else endPos = content.length;
        
        const part = content.substring(currentPos, endPos).trim();
        if (part) {
          State.chapters.push({
            id: sectionIndex - 1,
            title: `Phần ${sectionIndex}`,
            originalTitle: `Phần ${sectionIndex}`,
            content: part,
            selected: true,
            shouldNumber: false
          });
          sectionIndex++;
        }
        currentPos = endPos;
      }
    } else {
      State.chapters.push({
        id: 0,
        title: 'Toàn bộ nội dung',
        originalTitle: 'Toàn bộ nội dung',
        content: content.trim(),
        selected: false,
        shouldNumber: false
      });
    }
  },

  syncSavedSelection() {
    if (State.currentBook && State.currentBook.chapters) {
      State.currentBook.chapters.forEach(saved => {
        const target = State.chapters.find(c => c.id === saved.id);
        if (target) {
          target.selected = saved.selected;
          if (saved.shouldNumber !== undefined) target.shouldNumber = saved.shouldNumber;
        }
      });
    }
  },

  recalculateTitles() {
    State.chapters.forEach(ch => {
      ch.title = ch.originalTitle;
      ch.displayNumber = null;
    });
  },

  renderChapterList() {
    if (typeof window !== 'undefined' && window.ChapterWorkspace) {
      window.ChapterWorkspace.render();
      return;
    }
    if (typeof UI === 'undefined' || !UI.$) return;
    const list = UI.$('#chapterList');
    if (State.chapters.length === 0) {
      UI.$('#chapterListSection').classList.add('hidden');
      return;
    }
    
    list.innerHTML = State.chapters.map(ch => {
      const fc = State.finishedChapters.find(f => f.sourceChapterId === ch.id);
      const isFinished = !!fc;
      let displayTitle = (isFinished && fc && fc.title) ? fc.title : ch.title;
      if (displayTitle && window.Translation && /^(?:Chào bạn|Tôi thấy|Tôi nhận thấy|Dưới đây là)/i.test(displayTitle)) {
        const cleaned = Translation.cleanTranslatedTitle(displayTitle, ch.title);
        if (cleaned && cleaned !== displayTitle) {
          displayTitle = cleaned;
          if (fc && fc.title) fc.title = cleaned;
          if (ch && ch.title) ch.title = cleaned;
        }
      }
      const isRenamed = displayTitle !== ch.title;
      const origSubtitle = isRenamed 
        ? `<div class="chapter-orig-subtitle" style="font-size: 11px; opacity: 0.6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 2px;" title="Tên gốc: ${ch.title}">${ch.title}</div>` 
        : '';
      // Check R18 content for chapter
      let isR18 = false;
      if (window.R18Detector) {
        const sourceLang = (State.settings && State.settings.sourceLang) || 'auto';
        isR18 = R18Detector.isChapterR18(ch, fc, sourceLang);
      }
      const r18Badge = isR18 ? (window.R18Detector ? R18Detector.getBadgeHtml() : '<span class="r18-badge-micro">18+</span>') : '';

      // Check Images in chapter
      const imgCount = (window.Utils && typeof Utils.countImages === 'function')
        ? (Utils.countImages(ch.content) || (fc && Utils.countImages(fc.content)) || 0)
        : 0;
      const imageBadge = imgCount > 0 ? Utils.getImageBadgeHtml(imgCount) : '';

      return `
        <div class="chapter-item ${ch.selected ? 'selected' : ''} ${isFinished ? 'is-translated' : 'is-untranslated'}" data-id="${ch.id}">
          <input type="checkbox" class="chapter-checkbox" ${ch.selected ? 'checked' : ''}>
          <div class="chapter-info" style="flex: 1; min-width: 0; overflow: hidden;">
            <div class="chapter-title-row" style="display: flex; align-items: center; justify-content: space-between; gap: 6px; min-width: 0; width: 100%;">
              <span class="chapter-title" title="${ch.title}" style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${displayTitle}</span>
              <div class="chapter-title-badges" style="display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;">
                ${imageBadge}
                ${r18Badge}
              </div>
            </div>
            ${origSubtitle}
            <span class="chapter-metadata">${Utils.formatWordCount(Utils.countWords(ch.content))}</span>
          </div>
        </div>
      `;
    }).join('');
    
    UI.$('#chapterListSection').classList.remove('hidden');
  }
};

if (typeof window !== 'undefined') {
  window.ChapterParser = ChapterParser;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChapterParser;
}
