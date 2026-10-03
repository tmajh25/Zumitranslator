/**
 * ZumiTranslator - Settings Fallback Chain UI Controller
 * Manages rendering, reordering, adding and deleting model fallback chips
 */

const FallbackChainUI = {
  provNames: {
    'gemini': 'Google Gemini',
    'openai': 'OpenAI',
    'groq': 'Groq Cloud',
    'deepseek': 'DeepSeek',
    'openrouter': 'OpenRouter',
    'cerebras': 'Cerebras',
    'google-free': 'Google Translate (Free)',
    'custom': 'Custom API'
  },

  populateChainAddModelDropdown(provider) {
    const modelSelect = UI.$('#chainAddModelSelect');
    if (!modelSelect) return;
    const allModels = (typeof AIConfig !== 'undefined') ? AIConfig.getModels(provider) : [];
    modelSelect.innerHTML = allModels.map(m => `<option value="${m}">${m}</option>`).join('');
  },

  renderFallbackUI() {
    const s = State.settings;
    const fallbackSection = UI.$('#fallbackSection');
    if (!fallbackSection) return;

    UI.toggleHidden(fallbackSection, false);

    const enableFallbackCb = UI.$('#enableFallback');
    if (enableFallbackCb) enableFallbackCb.checked = s.enableFallback !== false;

    const fallbackToGoogleFreeCb = UI.$('#fallbackToGoogleFree');
    if (fallbackToGoogleFreeCb) fallbackToGoogleFreeCb.checked = s.fallbackToGoogleFree !== false;

    // Get active unified interleaved fallback chain
    const chain = (typeof State !== 'undefined' && State.getFallbackChain)
      ? State.getFallbackChain()
      : [];

    const flowContainer = UI.$('#fallbackChainFlow');
    if (flowContainer) {
      if (chain.length === 0) {
        flowContainer.innerHTML = '<span style="color: var(--text-secondary); font-size: 12px; font-style: italic;">Chưa có AI nào trong chuỗi.</span>';
      } else {
        flowContainer.innerHTML = chain.map((step, idx) => {
          const isMain = idx === 0;
          const provName = this.provNames[step.provider] || step.provider;
          const canMoveLeft = idx > 0;
          const canMoveRight = idx < chain.length - 1;
          const provCfg = (typeof State !== 'undefined' && State.getProviderConfig) ? State.getProviderConfig(step.provider) : {};
          const hasKey = step.provider === 'google-free' || !!(provCfg.apiKey || (Array.isArray(provCfg.apiKeys) && provCfg.apiKeys.length > 0));

          if (isMain) {
            return `
              <div class="fallback-chip main-model" title="AI & Model chính đang chọn">
                <span>1. ${provName}: <strong>${step.model}</strong> <small style="opacity: 0.8">${chain.length === 1 ? '(Đơn lẻ)' : '(Chính)'}</small>${!hasKey ? ' <small style="opacity: 0.7; color: var(--text-warning);">(Chưa có Key)</small>' : ''}</span>
              </div>
            `;
          }

          return `
            <span class="fallback-arrow">→</span>
            <div class="fallback-chip" title="Dự phòng bước ${idx + 1}">
              ${canMoveLeft ? `<button type="button" class="order-btn" data-action="left" data-idx="${idx}" title="Ưu tiên cao hơn">‹</button>` : ''}
              <span>${idx + 1}. ${provName}: <strong>${step.model}</strong>${!hasKey ? ' <small style="opacity: 0.7; color: var(--text-warning);">(Chưa có Key)</small>' : ''}</span>
              ${canMoveRight ? `<button type="button" class="order-btn" data-action="right" data-idx="${idx}" title="Ưu tiên thấp hơn">›</button>` : ''}
              <button type="button" class="remove-chip-btn" data-idx="${idx}" title="Xóa khỏi chuỗi">&times;</button>
            </div>
          `;
        }).join('');

        // Bind delete button
        flowContainer.querySelectorAll('.remove-chip-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.idx, 10);
            if (idx > 0 && idx < chain.length) {
              chain.splice(idx, 1);
              State.saveSettings({ unifiedFallbackChain: chain });
              this.renderFallbackUI();
            }
          });
        });

        // Bind order buttons (‹ and ›)
        flowContainer.querySelectorAll('.order-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            const idx = parseInt(btn.dataset.idx, 10);

            if (action === 'left' && idx > 0) {
              const temp = chain[idx];
              chain[idx] = chain[idx - 1];
              chain[idx - 1] = temp;

              // If swapped with index 0, promote to main active provider & model
              if (idx === 1) {
                State.saveSettings({
                  apiProvider: chain[0].provider,
                  model: chain[0].model,
                  unifiedFallbackChain: chain
                });
                if (typeof UI !== 'undefined' && UI.$('#apiProvider')) {
                  UI.$('#apiProvider').value = chain[0].provider;
                }
                if (typeof UI !== 'undefined' && UI.$('#modelSelect')) {
                  UI.$('#modelSelect').value = chain[0].model;
                }
              } else {
                State.saveSettings({ unifiedFallbackChain: chain });
              }
              this.renderFallbackUI();
            } else if (action === 'right' && idx < chain.length - 1) {
              const temp = chain[idx];
              chain[idx] = chain[idx + 1];
              chain[idx + 1] = temp;
              State.saveSettings({ unifiedFallbackChain: chain });
              this.renderFallbackUI();
            }
          });
        });
      }
    }

    const addProvSelect = UI.$('#chainAddProviderSelect');
    if (addProvSelect) {
      this.populateChainAddModelDropdown(addProvSelect.value);
    }

    this.renderProfilerFallbackUI();
  },

  populateProfilerAddModelDropdown(provider) {
    const modelSelect = UI.$('#chainAddProfilerModelSelect');
    if (!modelSelect) return;
    const allModels = (typeof AIConfig !== 'undefined') ? AIConfig.getModels(provider) : [];
    modelSelect.innerHTML = allModels.map(m => `<option value="${m}">${m}</option>`).join('');
  },

  renderProfilerFallbackUI() {
    const wrap = UI.$('#profilerFallbackWrap');
    if (!wrap) return;

    const chain = (typeof State !== 'undefined' && State.getProfilerFallbackChain)
      ? State.getProfilerFallbackChain()
      : [];

    const flowContainer = UI.$('#profilerFallbackChainFlow');
    if (flowContainer) {
      if (chain.length === 0) {
        flowContainer.innerHTML = '<span style="color: var(--text-secondary); font-size: 12px; font-style: italic;">Chưa có AI nào trong chuỗi quét.</span>';
      } else {
        flowContainer.innerHTML = chain.map((step, idx) => {
          const isMain = idx === 0;
          const provName = this.provNames[step.provider] || step.provider;
          const canMoveLeft = idx > 0;
          const canMoveRight = idx < chain.length - 1;
          const provCfg = (typeof State !== 'undefined' && State.getProviderConfig) ? State.getProviderConfig(step.provider) : {};
          const hasKey = !!(provCfg.apiKey || (Array.isArray(provCfg.apiKeys) && provCfg.apiKeys.length > 0));

          if (isMain) {
            return `
              <div class="fallback-chip main-model" title="AI & Model quét chính đang chọn">
                <span>1. ${provName}: <strong>${step.model || 'Auto'}</strong> <small style="opacity: 0.8">${chain.length === 1 ? '(Đơn lẻ)' : '(Chính)'}</small>${!hasKey ? ' <small style="opacity: 0.7; color: var(--text-warning);">(Chưa có Key)</small>' : ''}</span>
              </div>
            `;
          }

          return `
            <span class="fallback-arrow">→</span>
            <div class="fallback-chip" title="Dự phòng quét bước ${idx + 1}">
              ${canMoveLeft ? `<button type="button" class="order-btn" data-action="left" data-idx="${idx}" title="Ưu tiên cao hơn">‹</button>` : ''}
              <span>${idx + 1}. ${provName}: <strong>${step.model}</strong>${!hasKey ? ' <small style="opacity: 0.7; color: var(--text-warning);">(Chưa có Key)</small>' : ''}</span>
              ${canMoveRight ? `<button type="button" class="order-btn" data-action="right" data-idx="${idx}" title="Ưu tiên thấp hơn">›</button>` : ''}
              <button type="button" class="remove-chip-btn" data-idx="${idx}" title="Xóa khỏi chuỗi quét">&times;</button>
            </div>
          `;
        }).join('');

        // Bind delete button
        flowContainer.querySelectorAll('.remove-chip-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.idx, 10);
            if (idx > 0 && idx < chain.length) {
              chain.splice(idx, 1);
              State.saveSettings({ profilerFallbackChain: chain });
              this.renderProfilerFallbackUI();
            }
          });
        });

        // Bind order buttons
        flowContainer.querySelectorAll('.order-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            const idx = parseInt(btn.dataset.idx, 10);

            if (action === 'left' && idx > 0) {
              const temp = chain[idx];
              chain[idx] = chain[idx - 1];
              chain[idx - 1] = temp;

              if (idx === 1) {
                State.saveSettings({
                  profilerProvider: chain[0].provider,
                  profilerModel: chain[0].model,
                  profilerFallbackChain: chain
                });
                const profProvSel = UI.$('#profilerProviderSetting');
                if (profProvSel) profProvSel.value = chain[0].provider;
                if (window.CharacterProfile && CharacterProfile.updateProfilerModelDropdowns) {
                  CharacterProfile.updateProfilerModelDropdowns(chain[0].provider);
                }
              } else {
                State.saveSettings({ profilerFallbackChain: chain });
              }
              this.renderProfilerFallbackUI();
            } else if (action === 'right' && idx < chain.length - 1) {
              const temp = chain[idx];
              chain[idx] = chain[idx + 1];
              chain[idx + 1] = temp;
              State.saveSettings({ profilerFallbackChain: chain });
              this.renderProfilerFallbackUI();
            }
          });
        });
      }
    }

    const addProvSelect = UI.$('#chainAddProfilerProviderSelect');
    if (addProvSelect) {
      this.populateProfilerAddModelDropdown(addProvSelect.value);
    }
  }
};

if (typeof window !== 'undefined') {
  window.FallbackChainUI = FallbackChainUI;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FallbackChainUI;
}
