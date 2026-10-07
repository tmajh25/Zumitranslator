/**
 * Translation Pipeline Component (Single Responsibility: Visual Workflow State)
 * Quản lý trực quan hóa 4 ô quy trình dịch:
 *   1. scan: Quét nhân vật & Từ điển
 *   2. title: Dịch tiêu đề chương
 *   3. translate: Dịch nội dung AI
 *   4. finalize: Ghép nối & Lưu trữ
 */

const TranslationPipeline = {
  steps: ['scan', 'title', 'translate', 'finalize'],

  reset() {
    this.steps.forEach(s => {
      this.setCardState(s, 'idle', 'Chờ');
    });
    const badge = document.getElementById('progressStatusBadge');
    if (badge) {
      badge.textContent = 'CHUẨN BỊ';
      badge.className = 'progress-status-badge';
    }
    const modelTag = document.getElementById('progressActiveModel');
    if (modelTag) modelTag.textContent = '';
  },

  setStep(activeStep, desc = '', modelName = '') {
    const badge = document.getElementById('progressStatusBadge');
    const order = ['scan', 'title', 'translate', 'finalize'];
    const activeIdx = order.indexOf(activeStep);

    order.forEach((step, idx) => {
      if (activeStep === 'complete') {
        this.setCardState(step, 'completed', 'Xong');
      } else if (idx < activeIdx) {
        this.setCardState(step, 'completed', 'Xong');
      } else if (idx === activeIdx) {
        this.setCardState(step, 'active', 'Đang xử lý', desc);
      } else {
        this.setCardState(step, 'idle', 'Chờ');
      }
    });

    if (badge) {
      badge.className = 'progress-status-badge';
      if (activeStep === 'complete') {
        badge.textContent = 'HOÀN THÀNH';
        badge.classList.add('badge-success');
      } else if (activeStep === 'scan') {
        badge.textContent = 'QUÉT HỒ SƠ';
        badge.classList.add('badge-active');
      } else if (activeStep === 'title') {
        badge.textContent = 'DỊCH TIÊU ĐỀ';
        badge.classList.add('badge-active');
      } else if (activeStep === 'translate') {
        badge.textContent = 'DỊCH NỘI DUNG';
        badge.classList.add('badge-active');
      } else if (activeStep === 'finalize') {
        badge.textContent = 'LƯU TRỮ';
        badge.classList.add('badge-active');
      }
    }

    if (modelName) {
      const modelTag = document.getElementById('progressActiveModel');
      if (modelTag) modelTag.textContent = `Model: ${modelName}`;
    }
  },

  setCardState(step, state, statusText, customDesc = null) {
    const card = document.getElementById(`pipeStep${this.capitalize(step)}`);
    const statusEl = document.getElementById(`pipeStep${this.capitalize(step)}Status`);
    const descEl = document.getElementById(`pipeStep${this.capitalize(step)}Desc`);

    if (!card) return;
    card.classList.remove('active', 'completed', 'skipped');
    if (state !== 'idle') {
      card.classList.add(state);
    }
    if (statusEl) statusEl.textContent = statusText;
    if (customDesc && descEl) {
      descEl.textContent = customDesc;
    } else if (descEl) {
      descEl.textContent = this.getDefaultDesc(step);
    }
  },

  getDefaultDesc(step) {
    switch (step) {
      case 'scan':
        return 'Nhận diện vai xưng hô & ngữ cảnh';
      case 'title':
        return 'Chuẩn hóa tên chương nguyên tác';
      case 'translate':
        return 'Xoay tua model & khớp xưng hô';
      case 'finalize':
        return 'Tự động đồng bộ vào thư viện';
      default:
        return '';
    }
  },

  capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
};

if (typeof window !== 'undefined') {
  window.TranslationPipeline = TranslationPipeline;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TranslationPipeline;
}
