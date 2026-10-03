/**
 * Progress Report Modal Component
 * Handles rendering the translation progress report modal and its user actions.
 * Extracted from progressDetector.js to adhere to Single Responsibility Principle (SRP).
 */

const ProgressReportModal = {
  render(report, { onSelectUntranslated, onSyncFinished } = {}) {
    const modal = document.getElementById('scanProgressModal');
    if (!modal) return;

    const percentEl = document.getElementById('scanProgressPercent');
    const fillEl = document.getElementById('scanProgressFill');
    const dominantSourceEl = document.getElementById('scanDominantSource');
    const totalEl = document.getElementById('scanTotalChapters');
    const translatedEl = document.getElementById('scanTranslatedCount');
    const untranslatedEl = document.getElementById('scanUntranslatedCount');

    if (percentEl) percentEl.textContent = `${report.percent}%`;
    if (fillEl) fillEl.style.width = `${report.percent}%`;
    if (dominantSourceEl) dominantSourceEl.textContent = `${report.dominantFlag} ${report.dominantSourceLang}`;
    if (totalEl) totalEl.textContent = report.total;
    if (translatedEl) translatedEl.textContent = report.translatedCount;
    if (untranslatedEl) untranslatedEl.textContent = report.untranslatedCount;

    // Advice message
    const adviceEl = document.getElementById('scanProgressAdvice');
    if (adviceEl) {
      if (report.percent >= 98) {
        adviceEl.textContent = 'Toàn bộ tác phẩm đã được dịch hoàn chỉnh. Bạn có thể xuất file hoặc đọc ngay.';
      } else if (report.translatedCount > 0 && report.untranslatedCount > 0) {
        adviceEl.textContent = `Google phát hiện truyện đã dịch trước ${report.translatedCount} chương. Nhấn "Chỉ chọn chương chưa dịch" để tiếp tục dịch các chương còn lại mà không tốn token AI.`;
      } else if (report.partialCount > 0) {
        adviceEl.textContent = `Có ${report.partialCount} chương dịch dở còn sót từ gốc. Bạn có thể dùng tính năng Tự động sửa để làm sạch.`;
      } else {
        adviceEl.textContent = `Google phát hiện nguyên tác là ${report.dominantSourceLang}. Toàn bộ chương đang sẵn sàng để dịch.`;
      }
    }

    // Action button: Select untranslated
    const btnSelectUntranslated = document.getElementById('scanBtnSelectUntranslated');
    if (btnSelectUntranslated) {
      btnSelectUntranslated.onclick = () => {
        if (typeof onSelectUntranslated === 'function') {
          onSelectUntranslated(report);
        }
        modal.classList.add('hidden');
      };
    }

    // Action button: Sync finished
    const btnSyncFinished = document.getElementById('scanBtnSyncFinished');
    if (btnSyncFinished) {
      btnSyncFinished.style.display = report.translatedCount > 0 ? 'inline-block' : 'none';
      btnSyncFinished.onclick = () => {
        if (typeof onSyncFinished === 'function') {
          onSyncFinished(report);
        }
        modal.classList.add('hidden');
      };
    }

    const closeBtn = document.getElementById('scanModalClose');
    const cancelBtn = document.getElementById('scanModalCancelBtn');
    if (closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');
    if (cancelBtn) cancelBtn.onclick = () => modal.classList.add('hidden');

    modal.classList.remove('hidden');
  }
};

if (typeof window !== 'undefined') {
  window.ProgressReportModal = ProgressReportModal;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProgressReportModal;
}
