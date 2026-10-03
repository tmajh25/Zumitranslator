/**
 * ZumiTranslator - Translation Context Service
 * Quản lý chuẩn hóa ngữ cảnh trước khi dịch: lọc thuật ngữ (glossary),
 * lọc hồ sơ nhân vật (character profile) thông minh theo từng chunk để tối ưu token.
 */

const TranslationContext = {
  textContainsTerm(text, lowerText, term) {
    if (!term || typeof term !== 'string') return false;
    const cleanTerm = term.trim();
    if (!cleanTerm) return false;

    const testToken = (t) => {
      const clean = t.trim();
      if (!clean) return false;

      const hasCJK = /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(clean);
      if (hasCJK) {
        return text.includes(clean);
      }

      if (clean.length <= 4 && /^[a-zA-Z0-9À-ỹ]+$/.test(clean)) {
        try {
          const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const reg = new RegExp(`(^|[^a-zA-Z0-9À-ỹ])${escaped}([^a-zA-Z0-9À-ỹ]|$)`, 'i');
          return reg.test(text);
        } catch (e) {
          return lowerText.includes(clean.toLowerCase());
        }
      }

      return lowerText.includes(clean.toLowerCase());
    };

    if (testToken(cleanTerm)) return true;

    if (/[\/|;,]/.test(cleanTerm)) {
      const parts = cleanTerm.split(/[\/|;,]+/).map(p => p.trim()).filter(Boolean);
      for (const part of parts) {
        if (testToken(part)) return true;
      }
    }

    if (/[\(\[\{（【]/.test(cleanTerm)) {
      const mainPart = cleanTerm.replace(/[\(\[\{（【][^\)\]\}）】]*[\)\]\}）】]/g, '').trim();
      if (mainPart && testToken(mainPart)) return true;

      const innerMatches = cleanTerm.match(/[\(\[\{（【]([^\)\]\}）】]+)[\)\]\}）】]/g);
      if (innerMatches) {
        for (const m of innerMatches) {
          const inner = m.slice(1, -1).trim();
          if (inner && testToken(inner)) return true;
        }
      }
    }

    return false;
  },

  isMainCharacter(profile) {
    if (!profile) return false;
    const rel = (profile.relationship || '').toLowerCase();
    const note = (profile.note || profile.notes || '').toLowerCase();
    const pro = (profile.pronouns || '').toLowerCase();
    const combined = `${rel} ${note} ${pro}`;
    return combined.includes('nam chính') || 
           combined.includes('nữ chính') || 
           combined.includes('nhân vật chính') || 
           combined.includes('người kể') || 
           combined.includes('người trần thuật') ||
           combined.includes('protagonist') ||
           combined.includes('main character') ||
           combined.includes('pov') ||
           combined.includes('mc');
  },

  filterRelevantCharacterProfiles(text, profiles) {
    if (!text || typeof text !== 'string' || !Array.isArray(profiles) || profiles.length === 0) {
      return profiles || [];
    }

    const enabledProfiles = profiles.filter(p => p && p.enabled !== false);
    if (enabledProfiles.length <= 6) {
      return enabledProfiles;
    }

    const lowerText = text.toLowerCase();
    const result = [];
    const addedIds = new Set();

    enabledProfiles.forEach(p => {
      const isMC = this.isMainCharacter(p);
      const orig = (p.speaker || p.originalName || '').trim();
      const trans = (p.listener || p.targetName || p.translatedName || '').trim();
      const isMentioned = (orig && this.textContainsTerm(text, lowerText, orig)) ||
                          (trans && this.textContainsTerm(text, lowerText, trans));

      if (isMC || isMentioned) {
        result.push(p);
        addedIds.add(p.id || orig || trans);
      }
    });

    if (result.length < 4) {
      for (const p of enabledProfiles) {
        if (!addedIds.has(p.id || p.originalName)) {
          result.push(p);
          addedIds.add(p.id || p.originalName);
          if (result.length >= 6) break;
        }
      }
    }

    return result;
  },

  filterRelevantGlossary(text, glossary) {
    if (!text || typeof text !== 'string' || !Array.isArray(glossary) || glossary.length === 0) {
      return glossary || [];
    }
    const lowerText = text.toLowerCase();
    return glossary.filter(item => {
      if (!item || item.enabled === false) return false;
      const k = (item.key || item.original || '').trim();
      const v = (item.value || item.translated || '').trim();
      if (k && this.textContainsTerm(text, lowerText, k)) return true;
      if (v && this.textContainsTerm(text, lowerText, v)) return true;
      return false;
    });
  },

  getActiveCharacterProfiles(text = null) {
    const book = State.currentBook;
    if (!book || !Array.isArray(book.characterProfiles)) return [];
    if (book.characterProfilesEnabled === false) return [];
    const all = book.characterProfiles.filter(p => p && p.enabled !== false && (p.speaker?.trim() || p.originalName?.trim() || p.listener?.trim() || p.translatedName?.trim()));
    if (!text) return all;
    return this.filterRelevantCharacterProfiles(text, all);
  },

  getActiveGlossary(text = null) {
    const s = State.settings || {};
    const globalGlossary = Array.isArray(s.glossary) ? s.glossary : [];
    const book = State.currentBook;
    const bookGlossary = (book && Array.isArray(book.glossary)) ? book.glossary : [];
    const isCharEnabled = !book || book.characterProfilesEnabled !== false;

    const activeCharKeys = new Set();
    if (isCharEnabled && Array.isArray(book?.characterProfiles)) {
      book.characterProfiles.forEach(char => {
        if (char && char.enabled !== false) {
          if (char.originalName) activeCharKeys.add(char.originalName.trim().toLowerCase());
        }
      });
    }

    const map = new Map();
    // 1. Global glossary as base
    globalGlossary.forEach(item => {
      if (!item || item.enabled === false) return;
      const k = (item.key || item.original || '').trim();
      const v = (item.value || item.translated || '').trim();
      if (k && (!isCharEnabled || !activeCharKeys.has(k.toLowerCase()))) {
        map.set(k.toLowerCase(), { key: k, value: v });
      }
    });

    // 2. Book glossary overrides and supplements
    if (!book || book.glossaryEnabled !== false) {
      bookGlossary.forEach(item => {
        if (!item || item.enabled === false) return;
        const k = (item.key || item.original || '').trim();
        const v = (item.value || item.translated || '').trim();
        if (k && (!isCharEnabled || !activeCharKeys.has(k.toLowerCase()))) {
          map.set(k.toLowerCase(), { key: k, value: v });
        }
      });
    }

    // 3. Fallback khi tắt Hồ sơ nhân vật
    if (!isCharEnabled && Array.isArray(book?.characterProfiles)) {
      book.characterProfiles.forEach(char => {
        if (char && char.enabled !== false) {
          const oName = (char.originalName || '').trim();
          const tName = (char.translatedName || '').trim();
          if (oName && tName) {
            map.set(oName.toLowerCase(), { key: oName, value: tName });

            if (/[\/|;,]/.test(oName)) {
              oName.split(/[\/|;,]+/).map(p => p.trim()).filter(Boolean).forEach(part => {
                if (part && !map.has(part.toLowerCase())) {
                  map.set(part.toLowerCase(), { key: part, value: tName });
                }
              });
            }
            if (/[\(\[\{（【]/.test(oName)) {
              const cleanMain = oName.replace(/[\(\[\{（【][^\)\]\}）】]*[\)\]\}）】]/g, '').trim();
              if (cleanMain && !map.has(cleanMain.toLowerCase())) {
                map.set(cleanMain.toLowerCase(), { key: cleanMain, value: tName });
              }
            }
          }
        }
      });
    }

    const all = Array.from(map.values());
    if (!text) return all;
    return this.filterRelevantGlossary(text, all);
  },

  getContext() {
    return '';
  },

  cleanTranslatedTitle(rawText, originalTitle = '') {
    if (!rawText) return originalTitle;
    let text = rawText.trim();

    const parenMatch = text.match(/\(((?:Chương|Hồi|Tiết|Phần|Chapter)\s*\d+[^)]*)\)/i);
    if (parenMatch) {
      return parenMatch[1].trim();
    }

    const quotedMatch = text.match(/["“]((?:Chương|Hồi|Tiết|Phần|Chapter)\s*\d+[^"”]*)["”]/i);
    if (quotedMatch) {
      return quotedMatch[1].trim();
    }

    text = text.replace(/^(?:Chào bạn|Tôi thấy|Tôi nhận thấy|Dưới đây là|Bản dịch|Tiêu đề)[^:\n]*[:\.\-]\s*/i, '').trim();

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let firstLine = lines[0] || text;

    firstLine = firstLine.replace(/^["'“”`*]+|["'“”`*]+$/g, '').trim();

    if (firstLine.length > 120) {
      firstLine = firstLine.substring(0, 120).trim() + '...';
    }

    return firstLine || originalTitle;
  }
};

if (typeof window !== 'undefined') {
  window.TranslationContext = TranslationContext;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TranslationContext;
}
