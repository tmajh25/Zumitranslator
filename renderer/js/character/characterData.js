/**
 * ZumiTranslator - Character Data Service
 * Quản lý dữ liệu nhân vật, chuẩn hóa tên, xưng hô hai chiều và gom cụm đại từ
 */

const CharacterData = {
  splitTerms(str) {
    if (!str || typeof str !== 'string') return [];
    const terms = [];
    let cur = '';
    let depth = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);

      if (depth === 0 && (ch === '/' || ch === ';' || ch === ',')) {
        if (cur.trim()) terms.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    if (cur.trim()) terms.push(cur.trim());
    return terms;
  },

  cleanSingleToken(tok) {
    if (!tok || typeof tok !== 'string') return '';
    let str = tok.trim();
    if (!str) return '';

    const foreignCharRegex = /[\uac00-\ud7af\u1100-\u11ff\u4e00-\u9fff\u3040-\u30ff]/;
    if (!foreignCharRegex.test(str)) {
      return str;
    }

    // 1. Parentheses: "선배 (Tiền bối)", "Tiền bối (선배)", "senior (선배)", "[선배] Tiền bối"
    const parenMatch = str.match(/[([{\u3010]([^)\]}\u3011]+)[)\]}\u3011]/);
    if (parenMatch) {
      const inside = parenMatch[1].trim();
      const outside = str.replace(/[([{\u3010][^)\]}\u3011]*[)\]}\u3011]/g, '').trim();

      if (!foreignCharRegex.test(inside) && /[a-zA-ZÀ-ỹ]/.test(inside)) {
        return inside;
      }
      if (!foreignCharRegex.test(outside) && /[a-zA-ZÀ-ỹ]/.test(outside)) {
        return outside;
      }
    }

    // 2. Loại bỏ các ký tự gốc ngoại ngữ nếu trong chuỗi đã có sẵn phần chữ dịch (Latin/Việt/Anh)
    const stripped = str.replace(/[\uac00-\ud7af\u1100-\u11ff\u4e00-\u9fff\u3040-\u30ff]/g, '').replace(/[()[\]{}]/g, '').trim();
    if (stripped && /[a-zA-ZÀ-ỹ]/.test(stripped)) {
      return stripped;
    }

    return str;
  },

  cleanToTargetLanguage(term) {
    if (!term || typeof term !== 'string') return '';
    let str = term.trim();
    if (!str) return '';

    const foreignCharRegex = /[\uac00-\ud7af\u1100-\u11ff\u4e00-\u9fff\u3040-\u30ff]/;
    if (!foreignCharRegex.test(str)) {
      return str;
    }

    // Split tokens by / , ; |
    const tokens = str.split(/[/;,|]+/).map(t => t.trim()).filter(Boolean);
    const cleanTokens = [];

    tokens.forEach(tok => {
      const cleaned = this.cleanSingleToken(tok);
      if (cleaned) {
        cleanTokens.push(cleaned);
      }
    });

    return cleanTokens.length > 0 ? cleanTokens.join(' / ') : str;
  },

  dedupeTerms(terms) {
    if (!Array.isArray(terms)) return [];
    const unique = [];
    terms.forEach(t => {
      const targetLangT = this.cleanToTargetLanguage(t);
      const subTerms = this.splitTerms(targetLangT);
      subTerms.forEach(rawT => {
        const cleanT = (rawT || '').trim();
        if (!cleanT) return;
        const norm = cleanT.toLowerCase();
        const existingIdx = unique.findIndex(u => u.toLowerCase() === norm);
        if (existingIdx !== -1) {
          if (cleanT.length > unique[existingIdx].length) unique[existingIdx] = cleanT;
        } else {
          const subsumedBy = unique.findIndex(u => {
            const uNorm = u.toLowerCase();
            return uNorm.includes(norm) && (uNorm.includes('(') || uNorm.includes(' '));
          });
          if (subsumedBy !== -1) return;

          const subsumes = unique.findIndex(u => {
            const uNorm = u.toLowerCase();
            return norm.includes(uNorm) && (cleanT.includes('(') || cleanT.includes(' '));
          });
          if (subsumes !== -1) {
            unique[subsumes] = cleanT;
            return;
          }
          unique.push(cleanT);
        }
      });
    });
    return unique;
  },

  extractTargetKeywords(str) {
    if (!str || typeof str !== 'string') return [];
    const parts = [];
    const parenMatches = str.match(/\(([^)]+)\)/g) || [];
    parenMatches.forEach(m => {
      const clean = m.replace(/[()]/g, '').trim().toLowerCase();
      if (clean) parts.push(clean);
    });
    const withoutParens = str.replace(/\([^)]*\)/g, ' ');
    withoutParens.split(/[/;,|]+/).forEach(s => {
      const clean = s.trim().toLowerCase();
      if (clean) parts.push(clean);
    });
    const full = str.trim().toLowerCase();
    if (full) parts.push(full);
    return Array.from(new Set(parts));
  },

  areTargetsEquivalent(t1, t2) {
    if (!t1 || !t2) return false;
    const n1 = t1.trim().toLowerCase();
    const n2 = t2.trim().toLowerCase();
    if (n1 === n2) return true;

    if (n1.length >= 2 && n2.length >= 2) {
      if (n1.includes(n2) || n2.includes(n1)) return true;
    }

    const k1 = this.extractTargetKeywords(t1);
    const k2 = this.extractTargetKeywords(t2);

    for (const p1 of k1) {
      if (!p1 || p1.length < 2) continue;
      for (const p2 of k2) {
        if (!p2 || p2.length < 2) continue;
        if (p1 === p2) return true;
        if (p1.length >= 2 && p2.length >= 2 && (p1.includes(p2) || p2.includes(p1))) return true;
      }
    }

    return false;
  },

  cleanTargetName(targetStr) {
    if (!targetStr || typeof targetStr !== 'string') return '';
    let str = targetStr.trim();
    if (!str) return '';

    // 1. Loại bỏ tên gốc nước ngoài trong ngoặc
    const parenMatch = str.match(/^([^(]+?)\s*[(（]([가-힣\u1100-\u11ff\u4e00-\u9fff\u3040-\u30ff\s]+)[)）]$/);
    if (parenMatch) {
      const transPart = parenMatch[1].trim();
      if (transPart && /[a-zA-ZÀ-ỹ]/.test(transPart)) {
        str = transPart;
      }
    }

    // 2. Loại bỏ định dạng ngược
    const revParenMatch = str.match(/^[(（]([가-힣\u1100-\u11ff\u4e00-\u9fff\u3040-\u30ff\s]+)[)）]\s*(.+)$/);
    if (revParenMatch) {
      const transPart = revParenMatch[2].trim();
      if (transPart && /[a-zA-ZÀ-ỹ]/.test(transPart)) {
        str = transPart;
      }
    }

    // 3. Đối chiếu với danh sách nhân vật đã có trong truyện để chuẩn hóa thành Tên dịch thuần túy
    const partner = this.findPartnerCharacter(null, str);
    if (partner) {
      const pTrans = (partner.translatedName || partner.listener || '').trim();
      if (pTrans) {
        str = pTrans;
      }
    }

    return str;
  },

  consolidatePronounRules(rules) {
    if (!Array.isArray(rules) || rules.length === 0) return [{ target: '', self: '', others: '' }];

    const consolidated = [];
    const hadEmpty = rules.some(r => r && !r.target && !r.self && !r.others);

    rules.forEach(rule => {
      if (!rule || (!rule.target && !rule.self && !rule.others)) return;

      const cleanTarget = this.cleanTargetName(rule.target || '');

      const matchIdx = consolidated.findIndex(c => this.areTargetsEquivalent(c.target, cleanTarget));
      if (matchIdx !== -1) {
        const existing = consolidated[matchIdx];
        if (cleanTarget && (!existing.target || (!cleanTarget.includes('(') && existing.target.includes('(')))) {
          existing.target = cleanTarget;
        }

        const s1 = this.splitTerms(existing.self || '');
        const s2 = this.splitTerms(rule.self || '');
        existing.self = this.dedupeTerms([...s1, ...s2]).join(' / ');

        const o1 = this.splitTerms(existing.others || '');
        const o2 = this.splitTerms(rule.others || '');
        existing.others = this.dedupeTerms([...o1, ...o2]).join(' / ');
      } else {
        consolidated.push({
          target: cleanTarget,
          self: this.dedupeTerms(this.splitTerms(rule.self || '')).join(' / '),
          others: this.dedupeTerms(this.splitTerms(rule.others || '')).join(' / ')
        });
      }
    });

    // Transitive merge pass
    for (let i = 0; i < consolidated.length; i++) {
      for (let j = i + 1; j < consolidated.length; j++) {
        if (this.areTargetsEquivalent(consolidated[i].target, consolidated[j].target)) {
          if (!consolidated[j].target.includes('(') && consolidated[i].target.includes('(')) {
            consolidated[i].target = consolidated[j].target;
          }
          const s1 = this.splitTerms(consolidated[i].self);
          const s2 = this.splitTerms(consolidated[j].self);
          consolidated[i].self = this.dedupeTerms([...s1, ...s2]).join(' / ');

          const o1 = this.splitTerms(consolidated[i].others);
          const o2 = this.splitTerms(consolidated[j].others);
          consolidated[i].others = this.dedupeTerms([...o1, ...o2]).join(' / ');

          consolidated.splice(j, 1);
          j--;
        }
      }
    }

    if (hadEmpty && !consolidated.some(r => !r.target && !r.self && !r.others)) {
      consolidated.push({ target: '', self: '', others: '' });
    }

    return consolidated.length > 0 ? consolidated : [{ target: '', self: '', others: '' }];
  },

  getCharacterCanonicalName(c) {
    if (!c) return '';
    const trans = (c.translatedName || c.listener || '').trim();
    const orig = (c.originalName || c.speaker || '').trim();
    return trans || orig || '';
  },

  findPartnerCharacter(sourceChar, targetStr) {
    if (!targetStr || typeof targetStr !== 'string') return null;
    const book = typeof State !== 'undefined' ? State.currentBook : null;
    if (!book || !Array.isArray(book.characterProfiles)) return null;

    return book.characterProfiles.find(c => {
      if (c === sourceChar) return false;
      const cTrans = (c.translatedName || c.listener || '').trim();
      const cOrig = (c.originalName || c.speaker || '').trim();
      const cCanon = this.getCharacterCanonicalName(c);
      return this.areTargetsEquivalent(targetStr, cTrans) ||
             this.areTargetsEquivalent(targetStr, cOrig) ||
             this.areTargetsEquivalent(targetStr, cCanon);
    }) || null;
  },

  syncTwoWayPronounRule(sourceChar, rule) {
    if (!sourceChar || !rule || !rule.target) return null;
    const book = typeof State !== 'undefined' ? State.currentBook : null;
    if (!book || !Array.isArray(book.characterProfiles)) return null;

    const partnerChar = this.findPartnerCharacter(sourceChar, rule.target);
    if (!partnerChar) return null;

    const sourceCanon = this.getCharacterCanonicalName(sourceChar);
    if (!sourceCanon) return null;

    const partnerRules = this.getPronounRules(partnerChar);

    let partnerRule = partnerRules.find(r => r.target && (
      this.areTargetsEquivalent(r.target, sourceChar.translatedName) ||
      this.areTargetsEquivalent(r.target, sourceChar.originalName) ||
      this.areTargetsEquivalent(r.target, sourceCanon)
    ));

    const incomingSelf = (rule.others || '').trim();
    const incomingOthers = (rule.self || '').trim();

    let partnerChanged = false;

    if (partnerRule) {
      if (incomingSelf) {
        const s1 = this.splitTerms(partnerRule.self || '');
        const s2 = this.splitTerms(incomingSelf);
        const mergedSelf = this.dedupeTerms([...s1, ...s2]).join(' / ');
        if (mergedSelf !== partnerRule.self) {
          partnerRule.self = mergedSelf;
          partnerChanged = true;
        }
      }
      if (incomingOthers) {
        const o1 = this.splitTerms(partnerRule.others || '');
        const o2 = this.splitTerms(incomingOthers);
        const mergedOthers = this.dedupeTerms([...o1, ...o2]).join(' / ');
        if (mergedOthers !== partnerRule.others) {
          partnerRule.others = mergedOthers;
          partnerChanged = true;
        }
      }
    } else if (incomingSelf || incomingOthers) {
      if (partnerRules.length === 1 && !partnerRules[0].target && !partnerRules[0].self && !partnerRules[0].others) {
        partnerRules[0] = {
          target: sourceCanon,
          self: incomingSelf,
          others: incomingOthers
        };
      } else {
        partnerRules.push({
          target: sourceCanon,
          self: incomingSelf,
          others: incomingOthers
        });
      }
      partnerChanged = true;
    }

    if (partnerChanged) {
      partnerChar.pronounRules = this.consolidatePronounRules(partnerRules);
      this.syncPronounsString(partnerChar);
      return partnerChar;
    }
    return null;
  },

  updatePartnerRowSubtableDOM(tableBody, partnerChar) {
    if (!tableBody || !partnerChar || typeof State === 'undefined' || !State.currentBook) return;
    const list = (window.CharacterProfile && typeof window.CharacterProfile.getCharacterProfiles === 'function')
      ? window.CharacterProfile.getCharacterProfiles()
      : (State.currentBook.characterProfiles || []);
    const pIndex = list.indexOf(partnerChar);
    if (pIndex === -1) return;

    const partnerRow = tableBody.querySelector(`tr[data-index="${pIndex}"]`);
    if (!partnerRow) return;

    const pRules = this.getPronounRules(partnerChar);
    const pSubBody = partnerRow.querySelector('.pronoun-subtable-body');
    if (!pSubBody) return;

    const pDatalistId = `partnerDatalist_${pIndex}`;
    pSubBody.innerHTML = pRules.map((r, rIdx) => `
      <tr data-sub-index="${rIdx}">
        <td style="width: 31%;">
          <input type="text" list="${pDatalistId}" class="sub-input sub-target" value="${Utils.escapeHtml(r.target || '')}" placeholder="Chọn nhân vật hoặc nhập...">
        </td>
        <td style="width: 31%;">
          <input type="text" class="sub-input sub-self" value="${Utils.escapeHtml(r.self || '')}" placeholder="VD: tôi / đệ">
        </td>
        <td style="width: 32%;">
          <input type="text" class="sub-input sub-others" value="${Utils.escapeHtml(r.others || '')}" placeholder="VD: y sư / huynh">
        </td>
        <td style="width: 6%; text-align: center;">
          <button type="button" class="sub-del-btn" title="Xóa dòng xưng hô này">✕</button>
        </td>
      </tr>
    `).join('');
  },

  getPronounRules(char) {
    if (!char) return [{ target: '', self: '', others: '' }];
    if (Array.isArray(char.pronounRules) && char.pronounRules.length > 0) {
      char.pronounRules = this.consolidatePronounRules(char.pronounRules);
      return char.pronounRules;
    }
    const rules = [];
    if (char.pronouns && typeof char.pronouns === 'string') {
      const lines = char.pronouns.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
      lines.forEach(line => {
        const clean = line.replace(/^[-*•\s\d.)]+/, '').trim();
        const multiMatch = clean.match(/^Với\s+([^:]+):(?:\s*Tự xưng:\s*([^|]+))?(?:\|\s*Gọi đối phương:\s*(.+))?/i);
        if (multiMatch) {
          rules.push({
            target: (multiMatch[1] || '').trim(),
            self: (multiMatch[2] || '').trim(),
            others: (multiMatch[3] || '').trim()
          });
          return;
        }

        const colonIdx = clean.indexOf(':');
        if (colonIdx > 0) {
          const key = clean.substring(0, colonIdx).trim().toLowerCase();
          const val = clean.substring(colonIdx + 1).trim();
          if (/^(tự xưng|xưng)/i.test(key)) {
            if (rules.length === 0) rules.push({ target: char.listener || char.translatedName || '', self: '', others: '' });
            rules[0].self = val;
          } else if (/^(gọi|đối phương)/i.test(key)) {
            if (rules.length === 0) rules.push({ target: char.listener || char.translatedName || '', self: '', others: '' });
            rules[0].others = val;
          }
        }
      });
    }

    if (rules.length === 0) {
      const { self, others } = this.parsePronounsPair(char.pronouns || '');
      rules.push({
        target: char.listener || '',
        self: self || '',
        others: others || ''
      });
    }

    char.pronounRules = this.consolidatePronounRules(rules);
    return char.pronounRules;
  },

  syncPronounsString(char) {
    if (!char) return;
    if (!Array.isArray(char.pronounRules) || char.pronounRules.length === 0) {
      char.pronouns = '';
      return;
    }
    char.pronouns = char.pronounRules
      .filter(r => r && (r.target || r.self || r.others))
      .map(r => {
        const parts = [];
        if (r.target) parts.push(`Với ${r.target}:`);
        if (r.self) parts.push(`Tự xưng: ${r.self}`);
        if (r.others) parts.push(`Gọi đối phương: ${r.others}`);
        return `- ${parts.join(' | ')}`;
      })
      .join('\n');

    if (char.pronounRules[0]) {
      if (!char.listener && char.pronounRules[0].target) {
        char.listener = char.pronounRules[0].target;
      }
    }
  },

  parsePronounsPair(pronounsStr) {
    let self = '';
    let others = '';
    if (!pronounsStr || typeof pronounsStr !== 'string') return { self, others };

    const rawLines = pronounsStr.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
    const selfTerms = [];
    const otherTerms = [];

    rawLines.forEach(line => {
      const clean = line.replace(/^[-*•\s\d.)]+/, '').trim();
      if (!clean) return;

      const colonIdx = clean.indexOf(':');
      if (colonIdx > 0) {
        const rawKey = clean.substring(0, colonIdx).trim().toLowerCase();
        const valStr = clean.substring(colonIdx + 1).trim();
        const terms = this.splitTerms(valStr);

        if (/^(tự xưng|xưng|tự gọi|xưng mình)/i.test(rawKey)) {
          selfTerms.push(...terms);
        } else {
          otherTerms.push(...terms);
        }
      } else {
        if (/^(tôi|ta|tớ|em|anh|chị|mình|tại hạ|tiểu đệ|bản tọa|lão phu)$/i.test(clean)) {
          selfTerms.push(clean);
        } else {
          otherTerms.push(clean);
        }
      }
    });

    self = this.dedupeTerms(selfTerms).join(' / ');
    others = this.dedupeTerms(otherTerms).join(' / ');

    return { self, others };
  },

  formatPronounsPair(self, others) {
    const lines = [];
    const cleanSelf = (self || '').trim();
    const cleanOthers = (others || '').trim();
    if (cleanSelf) lines.push(`- Tự xưng: ${cleanSelf}`);
    if (cleanOthers) lines.push(`- Gọi đối phương: ${cleanOthers}`);
    return lines.join('\n');
  },

  cleanAndConsolidatePronouns(pronounsStr) {
    if (!pronounsStr || typeof pronounsStr !== 'string') return '';
    const { self, others } = this.parsePronounsPair(pronounsStr);
    return this.formatPronounsPair(self, others);
  },

  cleanAndConsolidateRelationship(relStr) {
    if (!relStr || typeof relStr !== 'string') return '';
    const rawLines = relStr.split('\n').map(l => l.trim()).filter(Boolean);
    if (rawLines.length === 0) return '';
    const unique = [];
    rawLines.forEach(line => {
      const clean = line.replace(/^[-*•\s\d.)]+/, '').trim();
      if (!clean) return;
      const norm = clean.toLowerCase();
      const existingIdx = unique.findIndex(u => u.toLowerCase() === norm);
      if (existingIdx !== -1) {
        if (clean.length > unique[existingIdx].length) unique[existingIdx] = clean;
      } else {
        const subsumedBy = unique.findIndex(u => u.toLowerCase().includes(norm) && (u.includes('(') || u.includes(' ')));
        if (subsumedBy !== -1) return;
        const subsumes = unique.findIndex(u => norm.includes(u.toLowerCase()) && (clean.includes('(') || clean.includes(' ')));
        if (subsumes !== -1) {
          unique[subsumes] = clean;
          return;
        }
        unique.push(clean);
      }
    });
    return unique.map(u => `- ${u}`).join('\n');
  },

  sanitizeAllProfiles(book) {
    if (!book || !Array.isArray(book.characterProfiles)) return false;
    let changed = false;

    book.characterProfiles.forEach(c => {
      if (!c) return;
      if (Array.isArray(c.pronounRules) && c.pronounRules.length > 0) {
        const before = JSON.stringify(c.pronounRules);
        c.pronounRules = this.consolidatePronounRules(c.pronounRules);
        if (JSON.stringify(c.pronounRules) !== before) {
          this.syncPronounsString(c);
          changed = true;
        }
      }
      if (c.pronouns) {
        const cleaned = this.cleanAndConsolidatePronouns(c.pronouns);
        if (cleaned !== c.pronouns) {
          c.pronouns = cleaned;
          changed = true;
        }
      }
      if (c.relationship) {
        const cleaned = this.cleanAndConsolidateRelationship(c.relationship);
        if (cleaned !== c.relationship) {
          c.relationship = cleaned;
          changed = true;
        }
      }
    });

    if (changed) {
      if (typeof State !== 'undefined' && State.saveBooks) {
        State.saveBooks();
      }
    }
    return changed;
  }
};

if (typeof window !== 'undefined') {
  window.CharacterData = CharacterData;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CharacterData;
}
