/**
 * AI PROVIDERS & MODELS CONFIGURATION
 * Centralized entry point aggregating all separate AI provider modules from ./ai/
 */
(() => {
  if (typeof window !== 'undefined' && window.AIConfig) {
    return;
  }

  const _getAIConfig = () => {
    if (typeof window !== 'undefined' && window.AIConfig) {
      return window.AIConfig;
    }
    if (typeof require !== 'undefined') {
      try {
        return require('./ai/index');
      } catch (e) {
        try {
          return require('./renderer/js/ai/index');
        } catch (err) {
          // fallback
        }
      }
    }
    return null;
  };

  const loaded = _getAIConfig();
  if (loaded) {
    if (typeof window !== 'undefined') window.AIConfig = loaded;
    if (typeof module !== 'undefined' && module.exports) module.exports = loaded;
  }
})();
