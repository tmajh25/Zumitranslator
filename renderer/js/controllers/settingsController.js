/**
 * SETTINGS CONTROLLER (SRP)
 * Manages settings event listeners, inputs, glossary list, and key pool interactions
 */

const SettingsController = {
  init() {
    this.setupProviderCards();
    this.setupSettingInputs();
    this.setupGlossaryEvents();
    this.setupKeyPoolEvents();
  },

  setupProviderCards() {
    UI.elements.apiProviderCards.forEach(card => {
      card.addEventListener('click', () => {
        const provider = card.querySelector('input').value;
        State.switchProvider(provider);
        if (typeof Translation !== 'undefined' && typeof Translation.resetFallbackSession === 'function') {
          Translation.resetFallbackSession();
        }
        Settings.updateProviderUI(provider);
        
        UI.elements.apiProviderCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      });
    });
  },

  setupSettingInputs() {
    const bindLive = (selector, handler, isDebounced = false) => {
      const el = UI.$(selector);
      if (!el) return;
      let timer = null;
      el.addEventListener('change', handler);
      el.addEventListener('input', (e) => {
        if (isDebounced) {
          clearTimeout(timer);
          timer = setTimeout(() => handler(e), 250);
        } else {
          handler(e);
        }
      });
    };

    bindLive('#apiKeyInput', (e) => State.saveSettings({ apiKey: e.target.value }));
    
    bindLive('#modelSelect', (e) => {
      State.saveSettings({ model: e.target.value });
      if (typeof Translation !== 'undefined' && typeof Translation.resetFallbackSession === 'function') {
        Translation.resetFallbackSession();
      }
      Settings.updateReasoningUI(State.settings.apiProvider, e.target.value);
      Settings.updateChunkUI(State.settings.apiProvider, e.target.value);
      const customModelInput = UI.$('#customModelInput');
      if (customModelInput) customModelInput.value = e.target.value;
    });

    bindLive('#customModelInput', (e) => {
      const val = e.target.value.trim();
      if (val) {
        State.saveSettings({ model: val });
        if (typeof Translation !== 'undefined' && typeof Translation.resetFallbackSession === 'function') {
          Translation.resetFallbackSession();
        }
        Settings.updateChunkUI(State.settings.apiProvider, val);
        const modelSelect = UI.$('#modelSelect');
        if (modelSelect) {
          let exists = false;
          for (let i = 0; i < modelSelect.options.length; i++) {
            if (modelSelect.options[i].value === val) {
              modelSelect.selectedIndex = i;
              exists = true;
              break;
            }
          }
          if (!exists) {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            opt.selected = true;
            modelSelect.insertBefore(opt, modelSelect.options[1] || null);
          }
        }
      }
    }, true);

    bindLive('#reasoningEffortSelect', (e) => {
      const val = e.target.value;
      if (State.settings.model?.includes('gpt-6-astra') && val === 'none') {
        Utils.showToast('GPT-6 Astra không hỗ trợ mức "none" (trả về lỗi 400). Đã tự động chọn "low".', 'warning');
        e.target.value = 'low';
        State.saveSettings({ reasoningEffort: 'low' });
        return;
      }
      State.saveSettings({ reasoningEffort: val });
    });

    bindLive('#reasoningModeSelect', (e) => {
      State.saveSettings({ reasoningMode: e.target.value });
    });

    bindLive('#sourceLangSelect', (e) => {
      State.saveSettings({ sourceLang: e.target.value });
      Settings.updateProviderUI(State.settings.apiProvider);

      // Re-evaluate R18 status according to explicitly specified language
      if (Array.isArray(State.chapters) && State.chapters.length > 0) {
        State.chapters.forEach(ch => {
          delete ch._isR18;
        });
        if (window.ChapterParser && typeof window.ChapterParser.renderChapterList === 'function') {
          ChapterParser.renderChapterList();
        }
      }
      if (window.Bookshelf && typeof window.Bookshelf.renderChapterList === 'function') {
        Bookshelf.renderChapterList();
      }
    });

    bindLive('#targetLangSelect', (e) => {
      State.saveSettings({ targetLang: e.target.value });
      Settings.updateProviderUI(State.settings.apiProvider);

      // Re-evaluate language status when target language changes
      if (Array.isArray(State.chapters) && State.chapters.length > 0) {
        State.chapters.forEach(ch => {
          delete ch._langEvaluation;
        });
        if (window.ChapterParser && typeof window.ChapterParser.autoDetectLanguageStatus === 'function') {
          ChapterParser.autoDetectLanguageStatus();
        }
        if (window.ChapterWorkspace && typeof window.ChapterWorkspace.render === 'function') {
          ChapterWorkspace.render();
        }
      }
      if (window.Bookshelf && typeof window.Bookshelf.render === 'function') {
        Bookshelf.render();
      }
    });

    bindLive('#chunkSize', (e) => {
      const val = parseInt(e.target.value);
      if (!isNaN(val) && val > 0) State.saveSettings({ chunkSize: val });
    }, true);

    bindLive('#requestDelay', (e) => {
      const val = parseInt(e.target.value);
      if (!isNaN(val) && val >= 0) State.saveSettings({ requestDelay: val });
    }, true);

    bindLive('#enableMultiThreading', (e) => {
      State.saveSettings({ enableMultiThreading: e.target.checked });
      UI.toggleHidden(UI.$('#multiThreadSettings'), !e.target.checked);
      Settings.updateThreadCompatibilityUI();
    });

    bindLive('#translationThreads', (e) => {
      const val = parseInt(e.target.value);
      if (!isNaN(val) && val >= 1) State.saveSettings({ translationThreads: val });
    }, true);

    bindLive('#translateChapterTitles', (e) => {
      State.saveSettings({ translateChapterTitles: e.target.checked });
      UI.toggleHidden(UI.$('#titleTranslationModeSection'), !e.target.checked);
    });

    bindLive('#autoScanChapters', (e) => State.saveSettings({ autoScanChapters: e.target.checked }));
    bindLive('#enableFallback', (e) => State.saveSettings({ enableFallback: e.target.checked }));
    bindLive('#enableCrossProviderFallback', (e) => State.saveSettings({ enableCrossProviderFallback: e.target.checked }));
    bindLive('#fallbackToGoogleFree', (e) => State.saveSettings({ fallbackToGoogleFree: e.target.checked }));

    const chainAddProviderSelect = UI.$('#chainAddProviderSelect');
    if (chainAddProviderSelect) {
      chainAddProviderSelect.addEventListener('change', (e) => {
        if (window.Settings && Settings.populateChainAddModelDropdown) {
          Settings.populateChainAddModelDropdown(e.target.value);
        }
      });
    }

    const chainAddStepBtn = UI.$('#chainAddStepBtn');
    if (chainAddStepBtn) {
      chainAddStepBtn.addEventListener('click', () => {
        const provSelect = UI.$('#chainAddProviderSelect');
        const modelSelect = UI.$('#chainAddModelSelect');
        if (!provSelect || !modelSelect || !modelSelect.value) return;

        const chain = (typeof State !== 'undefined' && State.getFallbackChain) ? State.getFallbackChain() : [];
        chain.push({
          provider: provSelect.value,
          model: modelSelect.value
        });
        State.saveSettings({ unifiedFallbackChain: chain });
        if (window.Settings && Settings.renderFallbackUI) {
          Settings.renderFallbackUI();
        }
        Utils.showToast(`Đã thêm ${provSelect.value.toUpperCase()} (${modelSelect.value}) vào chuỗi xoay tua!`, 'success');
      });
    }

    const resetModelFallbackBtn = UI.$('#resetModelFallbackBtn');
    if (resetModelFallbackBtn) {
      resetModelFallbackBtn.addEventListener('click', () => {
        State.saveSettings({ unifiedFallbackChain: null });
        if (window.Settings && Settings.renderFallbackUI) {
          Settings.renderFallbackUI();
        }
        Utils.showToast('Đã khôi phục chuỗi AI xoay tua mặc định!', 'info');
      });
    }

    const clearModelFallbackBtn = UI.$('#clearModelFallbackBtn');
    if (clearModelFallbackBtn) {
      clearModelFallbackBtn.addEventListener('click', () => {
        const chain = (typeof State !== 'undefined' && State.getFallbackChain) ? State.getFallbackChain() : [];
        const singleChain = chain.slice(0, 1);
        State.saveSettings({ unifiedFallbackChain: singleChain });
        if (window.Settings && Settings.renderFallbackUI) {
          Settings.renderFallbackUI();
        }
        Utils.showToast('Đã chuyển sang chế độ dùng AI đơn lẻ (không dự phòng).', 'info');
      });
    }

    bindLive('#titleTranslationMode', (e) => State.saveSettings({ titleTranslationMode: e.target.value }));
    bindLive('#customPromptInput', (e) => State.saveSettings({ customPrompt: e.target.value }), true);

    bindLive('#profilerProviderSetting', (e) => {
      State.saveSettings({ profilerProvider: e.target.value });
      const charSelect = document.getElementById('characterScanProviderSelect');
      if (charSelect) charSelect.value = e.target.value;
      const glossSelect = document.getElementById('glossaryScanProviderSelect');
      if (glossSelect) glossSelect.value = e.target.value;
      if (window.CharacterProfile && CharacterProfile.updateProfilerModelDropdowns) {
        CharacterProfile.updateProfilerModelDropdowns(e.target.value);
      }
      if (window.Settings && Settings.renderProfilerFallbackUI) {
        Settings.renderProfilerFallbackUI();
      }
    });

    bindLive('#profilerModelSetting', (e) => {
      if (window.CharacterProfile && CharacterProfile.onProfilerModelChange) {
        CharacterProfile.onProfilerModelChange(e.target.value);
      } else {
        State.saveSettings({ profilerModel: e.target.value });
      }
      if (window.Settings && Settings.renderProfilerFallbackUI) {
        Settings.renderProfilerFallbackUI();
      }
    });

    const chainAddProfilerProviderSelect = UI.$('#chainAddProfilerProviderSelect');
    if (chainAddProfilerProviderSelect) {
      chainAddProfilerProviderSelect.addEventListener('change', (e) => {
        if (window.Settings && Settings.populateProfilerAddModelDropdown) {
          Settings.populateProfilerAddModelDropdown(e.target.value);
        }
      });
    }

    const chainAddProfilerStepBtn = UI.$('#chainAddProfilerStepBtn');
    if (chainAddProfilerStepBtn) {
      chainAddProfilerStepBtn.addEventListener('click', () => {
        const provSelect = UI.$('#chainAddProfilerProviderSelect');
        const modelSelect = UI.$('#chainAddProfilerModelSelect');
        if (!provSelect || !modelSelect || !modelSelect.value) return;

        const chain = (typeof State !== 'undefined' && State.getProfilerFallbackChain) ? State.getProfilerFallbackChain() : [];
        chain.push({
          provider: provSelect.value,
          model: modelSelect.value
        });
        State.saveSettings({ profilerFallbackChain: chain });
        if (window.Settings && Settings.renderProfilerFallbackUI) {
          Settings.renderProfilerFallbackUI();
        }
        Utils.showToast(`Đã thêm ${provSelect.value.toUpperCase()} (${modelSelect.value}) vào chuỗi xoay tua Quét!`, 'success');
      });
    }

    const resetProfilerFallbackBtn = UI.$('#resetProfilerFallbackBtn');
    if (resetProfilerFallbackBtn) {
      resetProfilerFallbackBtn.addEventListener('click', () => {
        State.saveSettings({ profilerFallbackChain: null });
        if (window.Settings && Settings.renderProfilerFallbackUI) {
          Settings.renderProfilerFallbackUI();
        }
        Utils.showToast('Đã khôi phục chuỗi xoay tua Quét mặc định!', 'info');
      });
    }

    const clearProfilerFallbackBtn = UI.$('#clearProfilerFallbackBtn');
    if (clearProfilerFallbackBtn) {
      clearProfilerFallbackBtn.addEventListener('click', () => {
        const chain = (typeof State !== 'undefined' && State.getProfilerFallbackChain) ? State.getProfilerFallbackChain() : [];
        const singleChain = chain.slice(0, 1);
        State.saveSettings({ profilerFallbackChain: singleChain });
        if (window.Settings && Settings.renderProfilerFallbackUI) {
          Settings.renderProfilerFallbackUI();
        }
        Utils.showToast('Đã chuyển AI quét sang dùng đơn lẻ (không dự phòng).', 'info');
      });
    }

    bindLive('#customEndpoint', (e) => State.saveSettings({ customEndpoint: e.target.value }), true);
    bindLive('#thinkingLevelSelect', (e) => State.saveSettings({ thinkingLevel: e.target.value }));

    const tempInput = UI.$('#temperatureInput');
    if (tempInput) {
      tempInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        const display = UI.$('#temperatureValue');
        if (display) display.textContent = val;
        State.saveSettings({ temperature: val });
      });
      tempInput.addEventListener('change', (e) => {
        State.saveSettings({ temperature: parseFloat(e.target.value) });
      });
    }

    bindLive('#safetySettingSelect', (e) => State.saveSettings({ safetySetting: e.target.value }));
    
    bindLive('#enableChunking', (e) => {
      State.saveSettings({ enableChunking: e.target.checked });
      UI.toggleHidden(UI.$('#chunkSettingsContainer'), !e.target.checked);
      if (window.Settings && Settings.updateChunkUI) Settings.updateChunkUI();
    });

    bindLive('#chunkModeSelect', (e) => {
      State.saveSettings({ chunkMode: e.target.value });
      if (window.Settings && Settings.updateChunkUI) Settings.updateChunkUI();
    });

    bindLive('#enableDelay', (e) => {
      State.saveSettings({ enableDelay: e.target.checked });
      UI.toggleHidden(UI.$('#requestDelayGroup'), !e.target.checked);
    });

    // Manual Save Button
    const manualSaveBtn = UI.$('#manualSaveSettingsBtn');
    if (manualSaveBtn) {
      manualSaveBtn.addEventListener('click', () => {
        const newApiKeyInput = UI.$('#newApiKeyInput');
        if (newApiKeyInput && newApiKeyInput.value.trim()) {
          KeyPool.addKey(newApiKeyInput.value.trim());
          newApiKeyInput.value = '';
        }
        State.saveSettings({});
        Utils.showToast('Đã lưu toàn bộ cấu hình thành công!', 'success');
      });
    }
  },

  setupGlossaryEvents() {
    const addGlossaryBtn = UI.$('#addGlossaryItem');
    if (addGlossaryBtn) {
      addGlossaryBtn.addEventListener('click', () => {
        const g = State.settings.glossary || [];
        g.push({ key: '', value: '' });
        State.saveSettings({ glossary: g });
        Settings.renderGlossary();
      });
    }

    const glossaryList = UI.$('#glossaryList');
    if (glossaryList) {
      glossaryList.addEventListener('focusin', (e) => {
        if (e.target.classList.contains('glossary-value')) {
          e.target.dataset.prevValue = e.target.value.trim();
        }
      });

      glossaryList.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.classList.contains('glossary-value')) {
          e.target.blur();
        }
      });

      glossaryList.addEventListener('input', (e) => {
        const item = e.target.closest('.glossary-item');
        if (!item) return;
        const removeBtn = item.querySelector('.remove-glossary');
        if (!removeBtn) return;
        const index = parseInt(removeBtn.dataset.index);
        const g = State.settings.glossary;
        if (e.target.classList.contains('glossary-key')) g[index].key = e.target.value;
        if (e.target.classList.contains('glossary-value')) g[index].value = e.target.value;
        State.saveSettings({ glossary: g });
      });

      glossaryList.addEventListener('change', (e) => {
        if (e.target.classList.contains('glossary-value')) {
          const oldVal = (e.target.dataset.prevValue || '').trim();
          const newVal = e.target.value.trim();
          e.target.dataset.prevValue = newVal;
          if (oldVal && newVal && oldVal !== newVal) {
            if (window.BookGlossary && typeof BookGlossary.promptAndReplaceStoryText === 'function') {
              BookGlossary.promptAndReplaceStoryText(oldVal, newVal);
            }
          }
        }
      });

      glossaryList.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-glossary');
        if (removeBtn) {
          const index = parseInt(removeBtn.dataset.index);
          const g = State.settings.glossary;
          g.splice(index, 1);
          State.saveSettings({ glossary: g });
          Settings.renderGlossary();
        }
      });
    }
  },

  setupKeyPoolEvents() {
    const addKeyBtn = UI.$('#addKeyBtn');
    const newApiKeyInput = UI.$('#newApiKeyInput');
    const keyPoolList = UI.$('#keyPoolList');

    if (addKeyBtn && newApiKeyInput) {
      const commitNewKey = () => {
        const val = newApiKeyInput.value.trim();
        if (val) {
          KeyPool.addKey(val);
          newApiKeyInput.value = '';
        }
      };

      addKeyBtn.addEventListener('click', commitNewKey);

      newApiKeyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitNewKey();
        }
      });

      // Automatically add key on blur if user pasted/typed and navigated away
      newApiKeyInput.addEventListener('blur', () => {
        commitNewKey();
      });
    }

    if (keyPoolList) {
      keyPoolList.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const row = btn.closest('.key-item-row');
        if (!row) return;
        const idx = parseInt(btn.dataset.index !== undefined ? btn.dataset.index : row.dataset.index);

        if (btn.classList.contains('delete-btn')) {
          if (confirm(`Bạn có chắc muốn xóa Key ${idx + 1} không?`)) {
            KeyPool.removeKey(idx);
          }
        } else if (btn.classList.contains('test-btn')) {
          KeyPool.testKey(idx);
        } else if (btn.classList.contains('toggle-visibility-btn')) {
          const textEl = row.querySelector('.key-text');
          if (textEl) {
            const isRevealed = textEl.dataset.revealed === 'true';
            const raw = textEl.dataset.raw;
            if (isRevealed) {
              const isShort = raw.length < 10;
              textEl.textContent = isShort ? '••••••••' : `${raw.slice(0, 6)}••••••••${raw.slice(-4)}`;
              textEl.dataset.revealed = 'false';
              btn.textContent = 'Hiện';
            } else {
              textEl.textContent = raw;
              textEl.dataset.revealed = 'true';
              btn.textContent = 'Ẩn';
            }
          }
        }
      });
    }
  }
};

window.SettingsController = SettingsController;
