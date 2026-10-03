/**
 * DeepL Configuration & Models
 * 
 * TÀI LIỆU CHÍNH THỨC DEEPL API (BẮT BUỘC TRA CỨU TRƯỚC KHI CHỈNH SỬA):
 * Official DeepL API Documentation:
 * -> https://developers.deepl.com/docs/api-reference/translate
 */
const deeplConfig = {
  id: 'deepl',
  name: 'DeepL',
  badge: 'High Quality',
  badgeClass: 'paid',
  capabilities: {
    supportsModels: true,
    supportsApiKey: true,
    supportsLanguages: true,
    supportsReasoning: false,
    supportsSafety: false,
    supportsCustomEndpoint: false,
    supportsCustomPrompt: false,
    supportsGlossary: false,
    supportsContext: false,
    supportsMemory: false
  },
  models: [
    'quality_optimized',
    'latency_optimized',
    'prefer_quality_optimized'
  ],
  defaultConfig: {
    model: 'quality_optimized',
    chunkSize: 3000,
    enableChunking: true,
    requestDelay: 1000,
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

if (typeof window !== 'undefined') window.deeplConfig = deeplConfig;
if (typeof module !== 'undefined' && module.exports) module.exports = deeplConfig;
