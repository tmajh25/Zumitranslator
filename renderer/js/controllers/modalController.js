/**
 * MODAL CONTROLLER (SRP)
 * Manages modal dialogs (chapter preview modal, foreign character highlighting, clipboard copy)
 */

const ModalController = {
  init() {
    window.showChapterModal = this.showChapterModal.bind(this);
    window.hideModal = this.hideModal.bind(this);

    const closeBtn = UI.$('#closeModal');
    if (closeBtn) closeBtn.addEventListener('click', () => this.hideModal());

    const closeFooterBtn = UI.$('#closeModalBtn');
    if (closeFooterBtn) closeFooterBtn.addEventListener('click', () => this.hideModal());
    
    const copyBtn = UI.$('#copyChapterBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const modalBody = UI.$('#modalBody');
        const text = modalBody ? modalBody.innerText : '';
        await navigator.clipboard.writeText(text);
        Utils.showToast('Đã sao chép!', 'success');
      });
    }

    let viewingSource = false;
    const viewSourceBtn = UI.$('#viewSourceBtn');
    if (viewSourceBtn) {
      viewSourceBtn.addEventListener('click', () => {
        const modal = UI.$('#viewChapterModal');
        if (!modal) return;
        const idx = parseInt(modal.dataset.currentIdx);
        const ch = State.finishedChapters[idx];
        if (!ch) return;

        viewingSource = !viewingSource;
        const modalBody = UI.$('#modalBody');
        if (modalBody) {
          modalBody.innerText = viewingSource ? ch.sourceContent : ch.content;
        }
        viewSourceBtn.textContent = viewingSource ? 'Xem bản dịch' : 'Xem gốc';
      });
    }
  },

  showChapterModal(chapter) {
    if (!chapter) return;
    const modalTitle = UI.$('#modalTitle');
    const modalBody = UI.$('#modalBody');
    const modal = UI.$('#viewChapterModal');
    if (!modal) return;

    if (modalTitle) modalTitle.textContent = chapter.title;

    const detector = window.ForeignDetector;
    if (detector && detector.detect(chapter.content).hasForeign) {
      // Escape HTML first to prevent XSS, then highlight foreign characters
      const escaped = chapter.content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      if (modalBody) modalBody.innerHTML = detector.highlightHtml(escaped);
    } else {
      if (modalBody) modalBody.innerText = chapter.content;
    }

    modal.classList.remove('hidden');
    modal.dataset.currentIdx = State.finishedChapters.indexOf(chapter);
  },

  hideModal() {
    const modal = UI.$('#viewChapterModal');
    if (modal) modal.classList.add('hidden');
    const viewSourceBtn = UI.$('#viewSourceBtn');
    if (viewSourceBtn) viewSourceBtn.textContent = 'Xem gốc';
  }
};

window.ModalController = ModalController;
