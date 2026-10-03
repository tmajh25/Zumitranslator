/**
 * SETTINGS MODULE
 * Handles configuration UI and logic
 */

const Settings = {
  PROMPT_PRESETS: {
    literature: "Bạn là một dịch giả văn học chuyên nghiệp. Hãy dịch đoạn văn sau sang tiếng Việt một cách tự nhiên, trôi chảy, giữ nguyên phong cách truyện. Chỉ trả về bản dịch.",
    xianxia: "Bạn là dịch giả tiểu thuyết Tiên hiệp, Tu chân kỳ ảo. Hãy dịch đoạn văn sau sang tiếng Việt.\nYêu cầu:\n- Sử dụng thuật ngữ Hán Việt chuẩn xác cho cảnh giới, công pháp, linh bảo, đan dược, tông môn.\n- Xưng hô phù hợp: đạo hữu, tiền bối, vãn bối, sư huynh, sư muội, bổn toạ, tại hạ.\n- Văn phong hùng hồn, trang trọng, đậm chất huyền huyễn phương Đông.\n- Chỉ trả về bản dịch hoàn chỉnh.",
    romance: "Bạn là dịch giả tiểu thuyết Ngôn tình, Đô thị tình cảm. Hãy dịch đoạn văn sau sang tiếng Việt.\nYêu cầu:\n- Câu từ mượt mà, giàu cảm xúc, văn phong tinh tế, nhẹ nhàng.\n- Xưng hô linh hoạt, tự nhiên theo bối cảnh: chàng - nàng, anh - em, hắn - nàng, tôi - cô.\n- Giữ nguyên các ẩn ý ngọt ngào, hài hước hoặc lắng đọng của câu chuyện.\n- Chỉ trả về bản dịch.",
    wuxia: "Bạn là dịch giả tiểu thuyết Kiếm hiệp truyền thống. Hãy dịch đoạn văn sau sang tiếng Việt.\nYêu cầu:\n- Giữ phong vị hào sảng, giang hồ, nghĩa hiệp của võ lâm cổ phong.\n- Sử dụng xưng hô kiếm hiệp: huynh đệ, các hạ, tiểu đệ, chưởng môn, đại hiệp, bang chủ.\n- Dịch mượt mà các chiêu thức võ công, đao kiếm và màn giao đấu.\n- Chỉ trả về bản dịch.",
    lightnovel: "Bạn là dịch giả chuyên dịch Light Novel và văn học giải trí Nhật Bản. Hãy dịch đoạn văn sau sang tiếng Việt.\nYêu cầu:\n- Lời thoại sinh động, hài hước, bắt kịp xu hướng giới trẻ hiện đại.\n- Xưng hô thân thiện, dễ thương, tự nhiên theo tính cách từng nhân vật.\n- Nhịp truyện nhanh, lôi cuốn, dễ đọc.\n- Chỉ trả về bản dịch.",
    literal: "Bạn là một chuyên gia biên dịch trung lập và chính xác. Hãy dịch đoạn văn sau sang tiếng Việt.\nYêu cầu:\n- Dịch sát nghĩa từng câu chữ của văn bản gốc, trung thành tuyệt đối với cấu trúc câu và nội dung.\n- Không tự ý thêm bớt chi tiết, không phóng tác, không suy diễn cảm xúc.\n- Giữ nguyên đại từ nhân xưng và ngôi kể nguyên tác.\n- Chỉ trả về bản dịch chính xác."
  },

  init() {
    this.render();
    this.bindPromptControls();
    this.initSubtabs();
    this.updateProviderUI(State.settings.apiProvider);
  },

  render() {
    const s = State.settings;
    
    const setVal = (sel, val) => { const el = UI.$(sel); if (el) el.value = val; };
    const setChecked = (sel, val) => { const el = UI.$(sel); if (el) el.checked = !!val; };

    // Set field values safely
    setVal('#apiKeyInput', s.apiKey || '');
    setVal('#sourceLangSelect', s.sourceLang || 'auto');
    setVal('#targetLangSelect', s.targetLang || 'vi');
    setChecked('#enableChunking', s.enableChunking !== false);
    setVal('#chunkModeSelect', s.chunkMode || 'auto');
    setVal('#chunkSize', s.chunkSize || 3000);
    this.updateChunkUI(s.apiProvider, s.model);
    setChecked('#enableDelay', s.enableDelay !== false);
    UI.toggleHidden(UI.$('#requestDelayGroup'), s.enableDelay === false);

    setVal('#requestDelay', s.requestDelay === undefined ? 1000 : s.requestDelay);
    
    setChecked('#enableMultiThreading', !!s.enableMultiThreading);
    setVal('#translationThreads', s.translationThreads || 2);
    UI.toggleHidden(UI.$('#multiThreadSettings'), !s.enableMultiThreading);
    setChecked('#translateChapterTitles', s.translateChapterTitles !== false);
    setChecked('#autoScanChapters', !!s.autoScanChapters);
    setVal('#customPromptInput', s.customPrompt || '');
    setVal('#customEndpoint', s.customEndpoint || '');
    setVal('#thinkingLevelSelect', (s.thinkingLevel || 'medium').toLowerCase());
    setVal('#reasoningEffortSelect', s.reasoningEffort || 'medium');
    setVal('#reasoningModeSelect', s.reasoningMode || 'standard');

    const tempInput = UI.$('#temperatureInput');
    if (tempInput) {
      tempInput.value = s.temperature === undefined ? 1.0 : s.temperature;
      const tempVal = UI.$('#temperatureValue');
      if (tempVal) tempVal.textContent = tempInput.value;
    }
    setVal('#safetySettingSelect', s.safetySetting || 'BLOCK_MEDIUM_AND_ABOVE');
    setVal('#titleTranslationMode', s.titleTranslationMode || 'ai');
    UI.toggleHidden(UI.$('#titleTranslationModeSection'), s.translateChapterTitles === false);
    setVal('#profilerProviderSetting', s.profilerProvider || 'auto');
    if (window.CharacterProfile && CharacterProfile.updateProfilerModelDropdowns) {
      CharacterProfile.updateProfilerModelDropdowns(s.profilerProvider || 'auto');
    }
    setVal('#profilerModelSetting', s.profilerModel || 'auto');

    // Set provider active state
    UI.$$('.provider-card').forEach(card => {
      const radio = card.querySelector('input');
      if (radio.value === s.apiProvider) {
        radio.checked = true;
        card.classList.add('active');
        this.updateModels(s.apiProvider, s.model);
      } else {
        card.classList.remove('active');
      }
    });

    this.renderGlossary();
    this.renderKeyPool();
    this.updateThreadCompatibilityUI();
  },

  updateThreadCompatibilityUI() {
    // Multi-thread compatibility is now completely clean without context-aware conflicts
  },

  updateProviderUI(provider) {
    provider = provider || State.settings.apiProvider || 'google-free';
    
    // Capabilities from AIConfig
    const caps = (typeof AIConfig !== 'undefined') ? AIConfig.getCapabilities(provider) : {
      supportsApiKey: provider !== 'google-free',
      supportsModels: provider !== 'google-free',
      supportsReasoning: ['openai', 'gemini', 'groq', 'deepseek', 'openrouter', 'cerebras', 'custom'].includes(provider),
      supportsSafety: provider === 'gemini',
      supportsCustomEndpoint: provider === 'custom',
      supportsCustomPrompt: !['google-free', 'deepl'].includes(provider),
      supportsGlossary: !['google-free', 'deepl'].includes(provider),
      supportsMemory: !['google-free', 'deepl'].includes(provider),
      supportsLanguages: ['google-free', 'deepl'].includes(provider)
    };

    const supportsLanguages = caps.supportsLanguages !== undefined 
      ? !!caps.supportsLanguages 
      : ['google-free', 'deepl'].includes(provider);

    UI.toggleHidden(UI.$('#apiKeySection'), !caps.supportsApiKey);
    UI.toggleHidden(UI.$('#modelSection'), !caps.supportsModels);
    // Keep languageSection always visible in Translation Config
    UI.toggleHidden(UI.$('#languageSection'), false);
    UI.toggleHidden(UI.$('#customPromptSection'), !caps.supportsCustomPrompt);
    UI.toggleHidden(UI.$('#glossarySection'), !caps.supportsGlossary);
    UI.toggleHidden(UI.$('#customEndpointSection'), !caps.supportsCustomEndpoint);
    UI.toggleHidden(UI.$('#safetySettingSection'), !caps.supportsSafety);
    UI.toggleHidden(UI.$('#thinkingLevelSection'), !caps.supportsReasoning);
    UI.toggleHidden(UI.$('#temperatureSection'), !caps.supportsReasoning && !caps.supportsModels);
    UI.toggleHidden(UI.$('#memorySection'), !caps.supportsMemory);
    
    // Title translation mode is only relevant if titles are being translated
    UI.toggleHidden(UI.$('#titleTranslationModeSection'), !State.settings.translateChapterTitles);

    // Load full provider-specific config
    const config = State.getProviderConfig ? State.getProviderConfig(provider) : (State.settings.providerConfigs?.[provider] || {});
    
    // Synchronize ONLY provider-specific credentials/models to active State.settings
    State.settings.apiKey = config.apiKey || '';
    State.settings.model = config.model || '';
    State.settings.customEndpoint = config.customEndpoint || (provider === 'custom' ? 'http://localhost:11434/v1' : '');
    State.settings.temperature = config.temperature !== undefined ? config.temperature : 1.0;
    State.settings.thinkingLevel = config.thinkingLevel || 'MEDIUM';
    State.settings.reasoningEffort = config.reasoningEffort || 'medium';
    State.settings.reasoningMode = config.reasoningMode || 'standard';
    State.settings.safetySetting = config.safetySetting || 'BLOCK_NONE';
    State.settings.customPrompt = config.customPrompt || '';

    // Update UI fields
    const apiKeyInput = UI.$('#apiKeyInput');
    if (apiKeyInput) apiKeyInput.value = State.settings.apiKey;
    
    const customEndpoint = UI.$('#customEndpoint');
    if (customEndpoint) customEndpoint.value = State.settings.customEndpoint;

    const tempInput = UI.$('#temperatureInput');
    if (tempInput) {
      tempInput.value = State.settings.temperature;
      const tempVal = UI.$('#temperatureValue');
      if (tempVal) tempVal.textContent = State.settings.temperature;
    }

    const thinkingSelect = UI.$('#thinkingLevelSelect');
    if (thinkingSelect) thinkingSelect.value = (State.settings.thinkingLevel || 'medium').toLowerCase();

    const effortSelect = UI.$('#reasoningEffortSelect');
    if (effortSelect) effortSelect.value = State.settings.reasoningEffort;

    const modeSelect = UI.$('#reasoningModeSelect');
    if (modeSelect) modeSelect.value = State.settings.reasoningMode;

    const safetySelect = UI.$('#safetySettingSelect');
    if (safetySelect) safetySelect.value = State.settings.safetySetting;

    const promptInput = UI.$('#customPromptInput');
    if (promptInput) promptInput.value = State.settings.customPrompt;

    const chunkSize = UI.$('#chunkSize');
    if (chunkSize) chunkSize.value = State.settings.chunkSize || 3000;

    const chunkModeSelect = UI.$('#chunkModeSelect');
    if (chunkModeSelect) chunkModeSelect.value = State.settings.chunkMode || 'auto';

    const enableChunking = UI.$('#enableChunking');
    if (enableChunking) {
      enableChunking.checked = State.settings.enableChunking !== false;
    }
    this.updateChunkUI(provider, State.settings.model);

    const requestDelay = UI.$('#requestDelay');
    if (requestDelay) requestDelay.value = State.settings.requestDelay === undefined ? 1000 : State.settings.requestDelay;

    const enableDelay = UI.$('#enableDelay');
    if (enableDelay) {
      enableDelay.checked = State.settings.enableDelay !== false;
      UI.toggleHidden(UI.$('#requestDelayGroup'), State.settings.enableDelay === false);
    }

    const enableMulti = UI.$('#enableMultiThreading');
    if (enableMulti) {
      enableMulti.checked = !!State.settings.enableMultiThreading;
      UI.toggleHidden(UI.$('#multiThreadSettings'), !State.settings.enableMultiThreading);
    }

    const transThreads = UI.$('#translationThreads');
    if (transThreads) transThreads.value = State.settings.translationThreads || 2;

    // Update labels in headers
    const providerCard = UI.$(`.provider-card[data-provider="${provider}"]`);
    const providerName = providerCard?.querySelector('.provider-name')?.textContent || provider;

    const apiStatus = UI.$('#apiStatus span');
    if (apiStatus) apiStatus.textContent = providerName;
    const textProv = UI.$('#textProviderLabel');
    if (textProv) textProv.textContent = providerName;
    const fileProv = UI.$('#fileProviderLabel');
    if (fileProv) fileProv.textContent = providerName;
    
    // Update file header language label
    const fileLangs = UI.$('#fileLangsLabel');
    if (fileLangs) {
      if (supportsLanguages) {
        const s = (State.settings.sourceLang || 'auto').toUpperCase();
        const t = (State.settings.targetLang || 'vi').toUpperCase();
        fileLangs.textContent = `(${s} → ${t})`;
        fileLangs.style.display = 'inline';
      } else {
        fileLangs.textContent = '';
        fileLangs.style.display = 'none';
      }
    }
    
    // Update model dropdown
    this.updateModels(provider, State.settings.model);
    
    // Update Key Pool for this provider
    this.renderKeyPool(provider);

    // Update Fallback Chain UI
    this.renderFallbackUI(provider);

    // Update thread compatibility UI
    this.updateThreadCompatibilityUI();

    // Update quick prompt buttons visibility & labels
    UI.toggleHidden(UI.$('#textQuickPromptBtn'), !caps.supportsCustomPrompt);
    UI.toggleHidden(UI.$('#fileQuickPromptBtn'), !caps.supportsCustomPrompt);
    const promptBadge = UI.$('#promptProviderBadge');
    if (promptBadge) promptBadge.textContent = `${providerName} Prompt`;
    const modelBadge = UI.$('#modelProviderBadge');
    if (modelBadge) modelBadge.textContent = providerName;
    const endpointBadge = UI.$('#endpointProviderBadge');
    if (endpointBadge) endpointBadge.textContent = providerName;
    let promptVal = State.settings.customPrompt || '';
    if (promptVal.includes('{{source}}') || promptVal.includes('{{target}}')) {
      promptVal = promptVal.replace(/từ\s*\{\{source\}\}\s*sang\s*\{\{target\}\}/gi, 'sang tiếng Việt')
                           .replace(/from\s*\{\{source\}\}\s*to\s*\{\{target\}\}/gi, 'into Vietnamese')
                           .replace(/\{\{source\}\}/g, '')
                           .replace(/\{\{target\}\}/g, 'tiếng Việt');
      State.settings.customPrompt = promptVal;
      State.saveSettings({ customPrompt: promptVal });
    }
    const pInput = UI.$('#customPromptInput');
    if (pInput) pInput.value = promptVal;
    const tInput = UI.$('#textInlinePromptInput');
    if (tInput) tInput.value = promptVal;
    const fInput = UI.$('#fileInlinePromptInput');
    if (fInput) fInput.value = promptVal;
    this.updatePromptCharCount();
  },

  updateModels(provider, selectedModel) {
    const modelSelect = UI.$('#modelSelect');
    if (!modelSelect) return;
    modelSelect.innerHTML = '<option value="">-- Click chọn model --</option>';
    
    let models = (typeof AIConfig !== 'undefined') ? AIConfig.getModels(provider) : [];

    if (selectedModel && !models.includes(selectedModel)) {
      models.unshift(selectedModel);
    }

    models.forEach(m => {
      const option = document.createElement('option');
      option.value = m;
      option.textContent = m;
      if (m === selectedModel) option.selected = true;
      modelSelect.appendChild(option);
    });

    const customModelRow = UI.$('#customModelInputRow');
    const customModelInput = UI.$('#customModelInput');
    if (customModelRow) {
      UI.toggleHidden(customModelRow, provider !== 'custom');
      if (customModelInput) {
        customModelInput.value = selectedModel || '';
      }
    }

    this.updateReasoningUI(provider, selectedModel);
    this.updateChunkUI(provider, selectedModel);
    this.renderFallbackUI(provider);
  },

  updateReasoningUI(provider, model) {
    provider = provider || State.settings.apiProvider || 'google-free';
    model = model || State.settings.model || '';

    const isOpenAI = (provider === 'openai');
    UI.toggleHidden(UI.$('#openaiReasoningSection'), !isOpenAI);

    if (isOpenAI) {
      UI.toggleHidden(UI.$('#thinkingLevelSection'), true);
      
      const noneOpt = UI.$('#reasoningEffortNoneOpt');
      const hint = UI.$('#openaiReasoningHint');
      const isAstra = model.includes('gpt-6-astra');
      const isGpt56 = model.includes('gpt-5.6');

      if (noneOpt) {
        noneOpt.disabled = isAstra;
        noneOpt.textContent = isAstra 
          ? 'none (Không hỗ trợ trên GPT-6 Astra - Trả về lỗi 400)' 
          : 'none - Không suy luận (Nhanh nhất, tiết kiệm token)';
      }

      const effortSelect = UI.$('#reasoningEffortSelect');
      if (isAstra && (State.settings.reasoningEffort === 'none' || effortSelect?.value === 'none')) {
        State.settings.reasoningEffort = 'low';
        State.saveSettings({ reasoningEffort: 'low' });
        if (effortSelect) effortSelect.value = 'low';
      }

      // Show reasoning mode for GPT-5.6
      const modeRow = UI.$('#reasoningModeRow');
      if (modeRow) {
        UI.toggleHidden(modeRow, !isGpt56);
      }

      if (hint) {
        if (isAstra) {
          hint.innerHTML = '<strong>GPT-6 Astra:</strong> Mô hình tư duy tối tân của OpenAI. <em>Không hỗ trợ mức "none"</em> (tự động chuyển sang low để tránh lỗi HTTP 400). Hỗ trợ lên đến 1.05M tokens context & 128K tokens output.';
        } else if (isGpt56) {
          hint.innerHTML = `<strong>GPT-5.6 (${model}):</strong> Hỗ trợ cả <code>standard</code> và <code>pro</code> reasoning modes. Mặc định reasoning.effort là <code>medium</code>.`;
        } else {
          hint.innerHTML = '<strong>OpenAI Reasoning:</strong> Tham số <code>reasoning_effort</code> điều hướng mức độ tư duy. Chọn <code>low/minimal</code> để tăng tốc, hoặc <code>medium/high/xhigh/max</code> để bản dịch văn học tinh tế nhất.';
        }
      }
    } else {
      const caps = (typeof AIConfig !== 'undefined') ? AIConfig.getCapabilities(provider) : {};
      const shouldShow = !!caps.supportsReasoning;
      UI.toggleHidden(UI.$('#thinkingLevelSection'), !shouldShow);

      if (shouldShow) {
        const titleEl = UI.$('#thinkingLevelTitle');
        const badgeEl = UI.$('#thinkingLevelBadge');
        const labelEl = UI.$('#thinkingLevelLabel');
        const hintEl = UI.$('#thinkingLevelHint');
        const selectEl = UI.$('#thinkingLevelSelect');

        if (provider === 'deepseek') {
          if (titleEl) titleEl.textContent = 'Thinking Mode & Effort (DeepSeek)';
          if (badgeEl) badgeEl.textContent = 'DeepSeek';
          if (labelEl) labelEl.textContent = 'Mức độ suy luận (thinking / reasoning_effort):';
          if (hintEl) {
            hintEl.innerHTML = '<strong>DeepSeek Thinking Mode:</strong> DeepSeek hỗ trợ <code>thinking: { type: "enabled/disabled" }</code> và <code>reasoning_effort: "low" | "high" | "max"</code>. Mặc định là <code>high</code>. Chọn <code>none</code> để tắt suy luận giúp dịch nhanh nhất.';
          }
          if (selectEl) {
            selectEl.innerHTML = `
              <option value="none">none - Tắt Thinking Mode (Dịch nhanh nhất, tiết kiệm token)</option>
              <option value="low">low - Thấp (Suy luận nhanh, tiết kiệm token)</option>
              <option value="high" selected>high - Cao (Mặc định DeepSeek, cân bằng chất lượng & tốc độ)</option>
              <option value="max">max - Tối đa (Tư duy toàn diện & chuyên sâu nhất)</option>
            `;
            const current = (State.settings.thinkingLevel || 'high').toLowerCase();
            if (current === 'medium' || current === 'high') {
              selectEl.value = 'high';
            } else if (current === 'minimal' || current === 'none' || current === 'disabled' || current === 'off') {
              selectEl.value = 'none';
            } else if (current === 'max' || current === 'ultra') {
              selectEl.value = 'max';
            } else {
              selectEl.value = 'low';
            }
          }
        } else if (provider === 'gemini') {
          if (titleEl) titleEl.textContent = 'Thinking Level (Mức độ suy luận Gemini)';
          if (badgeEl) badgeEl.textContent = 'Gemini';
          if (labelEl) labelEl.textContent = 'Mức độ tư duy (generation_config.thinking_level):';
          if (hintEl) {
            hintEl.innerHTML = '<strong>Google Gemini:</strong> Cấu hình <code>thinking_level</code> cho các model Gemini 3.8 Flash, 3.7, 2.5 Pro/Flash. Giúp kiểm soát chi phí, độ trễ và chất lượng dịch thuật văn học.';
          }
          if (selectEl) {
            selectEl.innerHTML = `
              <option value="minimal">minimal - Tối thiểu (Nhanh nhất, giảm độ trễ)</option>
              <option value="low">low - Thấp (Tối ưu tốc độ & chi phí)</option>
              <option value="medium" selected>medium - Cân bằng (Mặc định)</option>
              <option value="high">high - Cao (Suy luận chuyên sâu nhất)</option>
            `;
            selectEl.value = (State.settings.thinkingLevel || 'medium').toLowerCase();
          }
        } else {
          const provObj = (typeof AIConfig !== 'undefined') ? AIConfig.getProvider(provider) : {};
          const pName = provObj.name || provider;
          if (titleEl) titleEl.textContent = `Thinking Level (Mức độ suy luận ${pName})`;
          if (badgeEl) badgeEl.textContent = pName;
          if (labelEl) labelEl.textContent = 'Mức độ tư duy / suy luận:';
          if (hintEl) {
            hintEl.innerHTML = `<strong>${pName}:</strong> Cấu hình mức độ suy luận cho mô hình để cân bằng tốc độ, chi phí và chất lượng dịch thuật.`;
          }
          if (selectEl) {
            selectEl.innerHTML = `
              <option value="minimal">minimal - Tối thiểu (Nhanh nhất)</option>
              <option value="low">low - Thấp (Tối ưu tốc độ & chi phí)</option>
              <option value="medium" selected>medium - Cân bằng (Mặc định)</option>
              <option value="high">high - Cao (Suy luận chuyên sâu)</option>
            `;
            selectEl.value = (State.settings.thinkingLevel || 'medium').toLowerCase();
          }
        }
      }
    }
  },

  updateChunkUI(provider, model) {
    const s = State.settings;
    provider = provider || s.apiProvider || 'gemini';
    model = model || s.model || '';

    const isEnabled = s.enableChunking !== false;
    const chunkMode = s.chunkMode || 'auto';
    const isManual = (chunkMode === 'manual');

    const container = UI.$('#chunkSettingsContainer');
    if (container) UI.toggleHidden(container, !isEnabled);

    const autoBanner = UI.$('#chunkAutoInfoBanner');
    const manualGroup = UI.$('#chunkManualGroup');
    if (autoBanner) UI.toggleHidden(autoBanner, isManual);
    if (manualGroup) UI.toggleHidden(manualGroup, !isManual);

    // Update dynamic token information in banner
    if (typeof AIConfig !== 'undefined' && typeof AIConfig.getSafeChunkLimit === 'function') {
      const info = AIConfig.getSafeChunkLimit(provider, model);
      const modelBadge = UI.$('#chunkModelBadge');
      const tokenBadge = UI.$('#chunkTokenLimitBadge');
      const autoDesc = UI.$('#chunkAutoDesc');
      const pObj = AIConfig.getProvider(provider);
      const pName = pObj.name || provider;

      if (modelBadge) modelBadge.textContent = `Model: ${pName} (${model || 'Mặc định'})`;
      if (tokenBadge) {
        tokenBadge.textContent = (provider === 'google-free' || provider === 'deepl')
          ? `Giới hạn: ${info.maxOutputTokens.toLocaleString()} ký tự`
          : `Max Output: ${info.maxOutputTokens.toLocaleString()} tokens`;
      }
      if (autoDesc) {
        if (provider === 'google-free' || provider === 'deepl') {
          autoDesc.innerHTML = `Hệ thống tự động cắt đoạn tối đa <strong>${info.limitChars.toLocaleString()} ký tự</strong> để đảm bảo không bị quá tải máy chủ dịch web của ${pName}.`;
        } else {
          autoDesc.innerHTML = `Hệ thống tự động tính toán giới hạn an toàn <strong>~${Math.round(info.limitChars / 4.5).toLocaleString()} từ (~${info.limitChars.toLocaleString()} ký tự)</strong>. Bản dịch tiếng Việt được đảm bảo trọn vẹn trong <strong>${info.maxOutputTokens.toLocaleString()} output tokens</strong> tối đa của model AI, tránh đứt đoạn giữa chừng.`;
        }
      }
    }
  },

  renderGlossary() {
    const list = UI.$('#glossaryList');
    if (!list) return;
    list.innerHTML = '';
    
    (State.settings.glossary || []).forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'glossary-item';
      div.innerHTML = `
        <input type="text" class="glossary-key" value="${item.key}" placeholder="Thuật ngữ, địa danh, tên gốc (VD: 丹田, 青云门...)">
        <input type="text" class="glossary-value" value="${item.value}" data-prev-value="${item.value}" placeholder="Dịch nghĩa chuẩn (VD: đan điền, Thanh Vân Môn...)">
        <button class="icon-btn remove-glossary" data-index="${index}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      `;
      list.appendChild(div);
    });
  },

  getProcessedPrompt() {
    let prompt = State.settings.customPrompt;
    if (!prompt || !prompt.trim()) {
      prompt = this.PROMPT_PRESETS.literature;
    }
    
    const langNames = this.getLanguageNames(State.settings.sourceLang, State.settings.targetLang);
    let finalPrompt = prompt.replace(/\{\{source\}\}/g, langNames.source).replace(/\{\{target\}\}/g, langNames.target);
    if (!finalPrompt.includes('[[IMG_')) {
      finalPrompt += '\nLưu ý: Nếu trong văn bản có chứa thẻ giữ chỗ hình ảnh dạng [[IMG_0]], [[IMG_1]], hãy giữ nguyên vẹn thẻ này tại đúng vị trí trong bản dịch, không dịch và không xóa.';
    }
    return finalPrompt;
  },

  getLanguageNames(source, target) {
    const langMap = {
      'auto': 'Tự nhận diện',
      'vi': 'Tiếng Việt',
      'en': 'Tiếng Anh',
      'ja': 'Tiếng Nhật',
      'ko': 'Tiếng Hàn',
      'zh-CN': 'Tiếng Trung (Giản)',
      'zh-TW': 'Tiếng Trung (Phồn)',
      'fr': 'Tiếng Pháp',
      'de': 'Tiếng Đức',
      'es': 'Tiếng Tây Ban Nha'
    };
    return {
      source: langMap[source] || source,
      target: langMap[target] || target
    };
  },

  // ===== AI PROMPT CUSTOMIZER & PRESETS =====
  setPrompt(text, skipActiveInput = null) {
    State.settings.customPrompt = text;
    State.saveSettings({ customPrompt: text });

    const inputs = [
      UI.$('#customPromptInput'),
      UI.$('#textInlinePromptInput'),
      UI.$('#fileInlinePromptInput')
    ];
    inputs.forEach(input => {
      if (input && input !== skipActiveInput && input.value !== text) {
        input.value = text;
      }
    });

    this.updatePromptCharCount();
  },

  resetPrompt(provider) {
    provider = provider || State.settings.apiProvider || 'gemini';
    const defConfig = (typeof AIConfig !== 'undefined') ? AIConfig.getDefaultConfig(provider) : {};
    const defPrompt = defConfig.customPrompt || this.PROMPT_PRESETS.literature;
    
    this.setPrompt(defPrompt);
    Utils.showToast('Đã khôi phục lệnh dịch thuật mặc định!', 'info');
  },

  insertPromptTag(tag) {
    const mainInput = UI.$('#customPromptInput');
    if (!mainInput) return;
    
    const start = mainInput.selectionStart !== undefined ? mainInput.selectionStart : mainInput.value.length;
    const end = mainInput.selectionEnd !== undefined ? mainInput.selectionEnd : mainInput.value.length;
    const text = mainInput.value;
    const nextVal = text.substring(0, start) + tag + text.substring(end);
    
    this.setPrompt(nextVal);
    mainInput.focus();
    mainInput.setSelectionRange(start + tag.length, start + tag.length);
  },

  updatePromptCharCount() {
    const el = UI.$('#promptCharCount');
    if (!el) return;
    const text = (State.settings.customPrompt || '').trim();
    if (!text) {
      el.textContent = '0 từ (0 ký tự)';
      return;
    }
    const words = text.split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    el.textContent = `${words} từ (${chars} ký tự)`;
  },

  bindPromptControls() {
    // Sync all prompt textareas
    ['#customPromptInput', '#textInlinePromptInput', '#fileInlinePromptInput'].forEach(selector => {
      const input = UI.$(selector);
      if (input) {
        input.addEventListener('input', (e) => {
          this.setPrompt(e.target.value, e.target);
        });
      }
    });

    // Reset prompt buttons
    ['#resetPromptBtn', '#textPromptResetBtn', '#filePromptResetBtn'].forEach(selector => {
      const btn = UI.$(selector);
      if (btn) {
        btn.addEventListener('click', () => {
          this.resetPrompt(State.settings.apiProvider);
        });
      }
    });

    // Genre preset buttons in settings
    UI.$$('.prompt-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const presetKey = btn.getAttribute('data-preset');
        if (presetKey && this.PROMPT_PRESETS[presetKey]) {
          this.setPrompt(this.PROMPT_PRESETS[presetKey]);
          Utils.showToast(`Đã áp dụng mẫu: ${btn.textContent.trim()}`, 'success');
        }
      });
    });


    // Quick prompt toggle in Text Translation
    const textQuickBtn = UI.$('#textQuickPromptBtn');
    const textPromptBar = UI.$('#textInlinePromptBar');
    const closeTextPromptBtn = UI.$('#closeTextPromptBtn');
    if (textQuickBtn && textPromptBar) {
      textQuickBtn.addEventListener('click', () => {
        const isHidden = textPromptBar.classList.contains('hidden');
        UI.toggleHidden(textPromptBar, !isHidden);
        if (isHidden) {
          const inp = UI.$('#textInlinePromptInput');
          if (inp) inp.focus();
        }
      });
    }
    if (closeTextPromptBtn && textPromptBar) {
      closeTextPromptBtn.addEventListener('click', () => {
        UI.toggleHidden(textPromptBar, true);
      });
    }

    // Quick prompt toggle in File Translation
    const fileQuickBtn = UI.$('#fileQuickPromptBtn');
    const filePromptBar = UI.$('#fileInlinePromptBar');
    const closeFilePromptBtn = UI.$('#closeFilePromptBtn');
    if (fileQuickBtn && filePromptBar) {
      fileQuickBtn.addEventListener('click', () => {
        const isHidden = filePromptBar.classList.contains('hidden');
        UI.toggleHidden(filePromptBar, !isHidden);
        if (isHidden) {
          const inp = UI.$('#fileInlinePromptInput');
          if (inp) inp.focus();
        }
      });
    }
    if (closeFilePromptBtn && filePromptBar) {
      closeFilePromptBtn.addEventListener('click', () => {
        UI.toggleHidden(filePromptBar, true);
      });
    }
  },

  // ===== KEY POOL & ADD KEY MANAGEMENT (Delegated to KeyPool module) =====
  getKeyList(provider) {
    return KeyPool.getKeyList(provider);
  },

  syncKeysToState(provider, explicitKeys) {
    return KeyPool.syncKeysToState(provider, explicitKeys);
  },

  renderKeyPool(provider) {
    return KeyPool.renderKeyPool(provider);
  },

  addKey(rawInput) {
    return KeyPool.addKey(rawInput);
  },

  removeKey(index) {
    return KeyPool.removeKey(index);
  },

  testKey(index) {
    return KeyPool.testKey(index);
  },

  testAllKeys() {
    return KeyPool.testAllKeys();
  },

  initSubtabs() {
    const tabBtns = document.querySelectorAll('.settings-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const subtab = btn.dataset.subtab;
        const targetPanel = btn.dataset.targetPanel;
        if (subtab && typeof UI !== 'undefined' && UI.showSettingsSubtab) {
          UI.showPanel('settings');
          UI.showSettingsSubtab(subtab);
        } else if (targetPanel && typeof UI !== 'undefined' && UI.showPanel) {
          UI.showPanel(targetPanel);
        }
      });
    });

    // Restore last active subtab from localStorage or default to 'ai'
    const savedSubtab = localStorage.getItem('active_settings_subtab') || 'ai';
    if (typeof UI !== 'undefined' && UI.showSettingsSubtab) {
      UI.showSettingsSubtab(savedSubtab);
    }
  },

  populateChainAddModelDropdown(provider) {
    return (window.FallbackChainUI || FallbackChainUI).populateChainAddModelDropdown(provider);
  },

  renderFallbackUI() {
    return (window.FallbackChainUI || FallbackChainUI).renderFallbackUI();
  },

  populateProfilerAddModelDropdown(provider) {
    return (window.FallbackChainUI || FallbackChainUI).populateProfilerAddModelDropdown(provider);
  },

  renderProfilerFallbackUI() {
    return (window.FallbackChainUI || FallbackChainUI).renderProfilerFallbackUI();
  }
};

window.Settings = Settings;
