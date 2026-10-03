/**
 * ZumiTranslator - Translation Workflow Controller
 * Guides user through the end-to-end novel translation lifecycle:
 * Step 1: Characters & Glossary Setup (Profiling)
 * Step 2: Chapter Selection & Translation (Execution)
 * Step 3: Foreign Word & Accuracy Inspection (Post-processing)
 * Step 4: Final Book Export (Delivery)
 */

const TranslationWorkflow = {
  init() {
    const step1 = document.getElementById('wfStepProfile');
    const step2 = document.getElementById('wfStepTranslate');
    const step3 = document.getElementById('wfStepInspect');
    const step4 = document.getElementById('wfStepExport');

    if (step1) {
      step1.addEventListener('click', () => {
        if (window.CharacterProfile) {
          CharacterProfile.toggleDrawer(true);
        }
      });
    }

    if (step2) {
      step2.addEventListener('click', () => {
        const section = document.getElementById('chapterListSection');
        if (section) {
          section.scrollIntoView({ behavior: 'smooth' });
        }
        const translateBtn = document.getElementById('translateFileBtn');
        if (translateBtn) translateBtn.focus();
      });
    }

    if (step3) {
      step3.addEventListener('click', () => {
        if (State.currentBook && window.Bookshelf) {
          Bookshelf.openInspector(State.currentBook);
        } else {
          Utils.showToast('Vui lòng mở một truyện trước.', 'info');
        }
      });
    }

    if (step4) {
      step4.addEventListener('click', () => {
        const exportBtn = document.getElementById('saveFileBtn');
        if (exportBtn && !exportBtn.classList.contains('hidden')) {
          exportBtn.click();
        } else if (UI.elements && UI.elements.exportModal) {
          UI.elements.exportModal.classList.remove('hidden');
        } else {
          Utils.showToast('Chưa có chương dịch nào để xuất.', 'info');
        }
      });
    }
  },

  update() {
    const book = State.currentBook;
    if (!book) return;

    // Step 1: Characters & Glossary Setup
    const chars = Array.isArray(book.characterProfiles) ? book.characterProfiles.filter(c => c && (c.originalName || c.translatedName)) : [];
    const gloss = Array.isArray(book.glossary) ? book.glossary.filter(g => g && (g.key || g.original)) : [];
    const step1El = document.getElementById('wfStepProfile');
    const sub1 = document.getElementById('wfProfileStatus');

    if (sub1) {
      sub1.textContent = `${chars.length} nhân vật · ${gloss.length} từ`;
    }
    if (step1El) {
      if (chars.length > 0 || gloss.length > 0) {
        step1El.classList.add('completed');
      } else {
        step1El.classList.remove('completed');
      }
    }

    // Step 2: Translation Execution
    const step2El = document.getElementById('wfStepTranslate');
    const sub2 = document.getElementById('wfTranslateStatus');
    const selectedCount = State.chapters ? State.chapters.filter(c => c.selected).length : 0;
    const finishedCount = Array.isArray(book.finishedChapters) ? book.finishedChapters.length : 0;
    const totalCount = State.chapters ? State.chapters.length : (book.totalChunks || 0);

    if (sub2) {
      if (State.isTranslating) {
        sub2.textContent = 'Đang dịch...';
      } else if (finishedCount > 0) {
        sub2.textContent = `Đã xong ${finishedCount}/${totalCount} chương`;
      } else {
        sub2.textContent = `${selectedCount} chương đã chọn`;
      }
    }
    if (step2El) {
      if (finishedCount > 0 && finishedCount >= totalCount) {
        step2El.classList.add('completed');
      } else {
        step2El.classList.remove('completed');
      }
    }

    // Step 3: Inspection
    const sub3 = document.getElementById('wfInspectStatus');
    if (sub3) {
      if (finishedCount > 0) {
        sub3.textContent = 'Sẵn sàng soát lỗi';
      } else {
        sub3.textContent = 'Trình Inspector';
      }
    }

    // Step 4: Export
    const step4El = document.getElementById('wfStepExport');
    const sub4 = document.getElementById('wfExportStatus');
    if (sub4) {
      if (finishedCount > 0) {
        sub4.textContent = 'Sẵn sàng xuất';
      } else {
        sub4.textContent = 'EPUB / TXT';
      }
    }
    if (step4El) {
      if (finishedCount > 0) {
        step4El.classList.add('active');
      } else {
        step4El.classList.remove('active');
      }
    }
  }
};

if (typeof window !== 'undefined') {
  window.TranslationWorkflow = TranslationWorkflow;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TranslationWorkflow;
}
