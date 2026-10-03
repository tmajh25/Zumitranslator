/**
 * TEXT CONTROLLER (SRP)
 * Manages text translation UI, inputs, clipboard paste/copy, and word counters
 */

const TextController = {
  init() {
    const { sourceText, targetText, translateTextBtn, sourceCharCount, targetCharCount } = UI.elements;
    if (!sourceText || !targetText) return;

    sourceText.addEventListener('input', () => {
      sourceCharCount.textContent = Utils.formatWordCount(Utils.countWords(sourceText.value));
    });

    const clearBtn = UI.$('#clearSource');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        sourceText.value = '';
        targetText.value = '';
        sourceCharCount.textContent = '0 từ';
        targetCharCount.textContent = '0 từ';
      });
    }

    const pasteBtn = UI.$('#pasteSource');
    if (pasteBtn) {
      pasteBtn.addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          sourceText.value = text;
          sourceCharCount.textContent = Utils.formatWordCount(Utils.countWords(text));
        } catch (e) {
          Utils.showToast('Không thể dán từ clipboard', 'error');
        }
      });
    }

    const copyBtn = UI.$('#copyTarget');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        if (!targetText.value) return;
        try {
          await navigator.clipboard.writeText(targetText.value);
          Utils.showToast('Đã sao chép bản dịch!', 'success');
        } catch (e) {
          Utils.showToast('Không thể sao chép', 'error');
        }
      });
    }

    if (translateTextBtn) {
      translateTextBtn.addEventListener('click', async () => {
        const text = sourceText.value.trim();
        if (!text) {
          Utils.showToast('Vui lòng nhập văn bản cần dịch', 'info');
          return;
        }

        UI.updateButtonLoading(translateTextBtn, true);
        
        try {
          const result = await Translation.translateText(text);
          targetText.value = result;
          targetCharCount.textContent = Utils.formatWordCount(Utils.countWords(result));
          Utils.showToast('Dịch thành công!', 'success');
        } catch (err) {
          Utils.showToast(`Lỗi dịch: ${err.message}`, 'error');
        } finally {
          UI.updateButtonLoading(translateTextBtn, false);
        }
      });
    }
  }
};

window.TextController = TextController;
