/**
 * Google Free Translate Configuration
 * Edit this file to adjust default request delay, chunk size, etc.
 */
const googleFreeConfig = {
  id: 'google-free',
  name: 'Google Translate',
  badge: 'No Key',
  badgeClass: 'free',
  capabilities: {
    supportsModels: false,
    supportsApiKey: false,
    supportsLanguages: true,
    supportsReasoning: false,
    supportsSafety: false,
    supportsCustomEndpoint: false,
    supportsCustomPrompt: false,
    supportsGlossary: false,
    supportsContext: false,
    supportsMemory: false
  },
  models: [],
  defaultConfig: {
    model: '',
    chunkSize: 2500,
    enableChunking: true,
    requestDelay: 1500,
    enableDelay: true,
    enableMultiThreading: false,
    translationThreads: 1,
    temperature: 1.0,
    thinkingLevel: 'MEDIUM',
    safetySetting: 'BLOCK_MEDIUM_AND_ABOVE',
    customPrompt: '',
    customEndpoint: ''
  }
};

if (typeof window !== 'undefined') window.googleFreeConfig = googleFreeConfig;
if (typeof module !== 'undefined' && module.exports) module.exports = googleFreeConfig;
