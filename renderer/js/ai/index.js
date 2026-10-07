/**
 * Central AI Config Registry
 * Aggregates all provider-specific configuration files.
 * Each AI has its own dedicated file in this folder for easy adjustment.
 */
(() => {
  const _loadConfig = (winKey, relPath) => {
    if (typeof window !== 'undefined' && window[winKey]) return window[winKey];
    if (typeof require !== 'undefined') {
      try { return require(relPath); } catch (e) { /* ignore */ }
    }
    return {};
  };

  const AI_PROVIDERS = {
    'gemini': _loadConfig('geminiConfig', './gemini'),
    'openai': _loadConfig('openaiConfig', './openai'),
    'deepseek': _loadConfig('deepseekConfig', './deepseek'),
    'groq': _loadConfig('groqConfig', './groq'),
    'cerebras': _loadConfig('cerebrasConfig', './cerebras'),
    'openrouter': _loadConfig('openrouterConfig', './openrouter'),
    'google-free': _loadConfig('googleFreeConfig', './googleFree'),
    'deepl': _loadConfig('deeplConfig', './deepl'),
    'custom': _loadConfig('customConfig', './custom')
  };

  const configRegistry = {
    providers: AI_PROVIDERS,

    getProvider(providerId) {
      const id = providerId || 'google-free';
      return this.providers[id] || this.providers['gemini'] || {};
    },

    getModels(providerId) {
      const p = this.getProvider(providerId);
      if (!p || !p.models) return [];
      return p.models.map(m => (typeof m === 'string' ? m : m.id));
    },

    getModelSpec(providerId, modelName) {
      const p = this.getProvider(providerId);
      if (!p || !p.models) return null;
      const target = (modelName || '').toLowerCase().trim();
      for (const m of p.models) {
        const id = (typeof m === 'string' ? m : m.id || '').toLowerCase().trim();
        if (id === target) {
          return typeof m === 'object' ? m : { id: m };
        }
      }
      return null;
    },

    getDefaultConfig(providerId) {
      const p = this.getProvider(providerId);
      return { ...((p && p.defaultConfig) || {}) };
    },

    getCapabilities(providerId) {
      const p = this.getProvider(providerId);
      return { ...((p && p.capabilities) || {}) };
    },

    isReasoningSupported(providerId) {
      const p = this.getProvider(providerId);
      return !!(p && p.capabilities?.supportsReasoning);
    },

    isLanguagesSupported(providerId) {
      const p = this.getProvider(providerId);
      return !!(p && p.capabilities?.supportsLanguages);
    },

    getMaxOutputTokens(providerId, modelName) {
      const p = (providerId || '').toLowerCase();
      if (p === 'google-free') return 3500;
      if (p === 'deepl') return 5000;

      // Read explicit specification defined on the model
      const spec = this.getModelSpec(providerId, modelName);
      if (spec && typeof spec.maxOutputTokens === 'number') {
        return spec.maxOutputTokens;
      }

      return 8192;
    },

    getSafeChunkLimit(providerId, modelName, sampleText = '') {
      const p = (providerId || '').toLowerCase();
      if (p === 'google-free') {
        return {
          maxOutputTokens: 3500,
          safeTokenBudget: 3000,
          limitChars: 3000,
          isCJK: false
        };
      }
      if (p === 'deepl') {
        return {
          maxOutputTokens: 5000,
          safeTokenBudget: 4500,
          limitChars: 4500,
          isCJK: false
        };
      }

      const maxTokens = this.getMaxOutputTokens(providerId, modelName);
      // Safety budget: 80% to reserve 20% for formatting, reasoning/thinking, prompts, glossary
      const safeTokenBudget = Math.floor(maxTokens * 0.80);

      // Check if text is predominantly CJK (Chinese, Japanese, Korean)
      const isCJK = sampleText ? /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(sampleText) : false;

      let limitChars;
      if (isCJK) {
        // CJK: 1 CJK char translates to roughly ~1.8 - 2.2 Vietnamese output tokens
        limitChars = Math.floor(safeTokenBudget / 2.0);
      } else {
        // Western (English, French, etc.): 1 word translates to ~1.4 - 1.6 output tokens (~4.5 chars/word)
        limitChars = Math.floor((safeTokenBudget / 1.5) * 5);
      }

      // Tự động tính kích thước chunk hoàn toàn theo maxOutputTokens an toàn của Model
      limitChars = Math.max(1500, limitChars);

      return {
        maxOutputTokens: maxTokens,
        safeTokenBudget,
        limitChars,
        isCJK
      };
    }
  };

  if (typeof window !== 'undefined') {
    window.AIConfig = configRegistry;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = configRegistry;
  }
})();
