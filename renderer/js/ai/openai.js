/**
 * OpenAI Configuration & Models
 * 
 * TÀI LIỆU CHÍNH THỨC OPENAI API (BẮT BUỘC TRA CỨU TRƯỚC KHI CHỈNH SỬA):
 * Official OpenAI Models Documentation:
 * -> https://platform.openai.com/docs/models
 * LƯU Ý CHO CÁC AGENT / AI BẢO TRÌ: KHÔNG tự ý xóa hoặc thay đổi model khi chưa tra cứu tài liệu chính thức.
 */
const openaiConfig = {
  id: 'openai',
  name: 'OpenAI',
  badge: 'AI',
  badgeClass: 'ai',
  capabilities: {
    supportsModels: true,
    supportsApiKey: true,
    supportsLanguages: false,
    supportsReasoning: true,
    supportsReasoningEffort: true,
    supportsReasoningMode: true,
    supportsSafety: false,
    supportsCustomEndpoint: false,
    supportsCustomPrompt: true,
    supportsGlossary: true,
    supportsContext: true,
    supportsMemory: true
  },
  models: [
    { id: 'gpt-6-astra', maxOutputTokens: 128000, contextTokens: 1050000 },
    { id: 'gpt-5.6-sol', maxOutputTokens: 128000, contextTokens: 1000000 },
    { id: 'gpt-5.6', maxOutputTokens: 128000, contextTokens: 1000000 },
    { id: 'gpt-5.6-terra', maxOutputTokens: 128000, contextTokens: 1000000 },
    { id: 'gpt-5.6-luna', maxOutputTokens: 128000, contextTokens: 1000000 },
    { id: 'gpt-5.5', maxOutputTokens: 65536, contextTokens: 500000 },
    { id: 'gpt-5.4', maxOutputTokens: 65536, contextTokens: 500000 },
    { id: 'gpt-5.2', maxOutputTokens: 65536, contextTokens: 256000 },
    { id: 'gpt-5.1', maxOutputTokens: 65536, contextTokens: 256000 },
    { id: 'gpt-5', maxOutputTokens: 65536, contextTokens: 256000 },
    { id: 'gpt-5-mini', maxOutputTokens: 32768, contextTokens: 128000 },
    { id: 'o3', maxOutputTokens: 100000, contextTokens: 200000 },
    { id: 'o3-mini', maxOutputTokens: 100000, contextTokens: 200000 },
    { id: 'o1', maxOutputTokens: 100000, contextTokens: 200000 },
    { id: 'o1-mini', maxOutputTokens: 65536, contextTokens: 128000 },
    { id: 'gpt-4.1', maxOutputTokens: 16384, contextTokens: 128000 },
    { id: 'gpt-4o', maxOutputTokens: 16384, contextTokens: 128000 },
    { id: 'gpt-4o-mini', maxOutputTokens: 16384, contextTokens: 128000 }
  ],
  defaultConfig: {
    model: 'gpt-5.6-sol',
    chunkSize: 4500,
    enableChunking: true,
    requestDelay: 500,
    enableDelay: true,
    enableMultiThreading: false,
    translationThreads: 2,
    temperature: 0.7,
    reasoningEffort: 'medium', // none, minimal, low, medium, high, xhigh, max
    reasoningMode: 'standard', // standard, pro (for GPT-5.6 Responses API)
    thinkingLevel: 'MEDIUM',
    safetySetting: 'BLOCK_MEDIUM_AND_ABOVE',
    customPrompt: 'Bạn là một dịch giả văn học chuyên nghiệp. Hãy dịch đoạn văn sau sang tiếng Việt một cách tự nhiên, trôi chảy, giữ nguyên phong cách truyện. Chỉ trả về bản dịch.',
    customEndpoint: ''
  },
  reasoningEfforts: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
  reasoningModes: ['standard', 'pro'],
  modelRules: {
    'gpt-6-astra': {
      disallowedEfforts: ['none'],
      fallbackEffort: 'low',
      note: 'GPT-6 Astra không hỗ trợ mức reasoning.effort "none" (sẽ trả về lỗi HTTP 400). Khuyến nghị dùng low, medium, high, xhigh hoặc max.'
    },
    'gpt-5.6-sol': { supportsModes: true, defaultEffort: 'medium' },
    'gpt-5.6': { supportsModes: true, defaultEffort: 'medium' },
    'gpt-5.6-terra': { supportsModes: true, defaultEffort: 'medium' },
    'gpt-5.6-luna': { supportsModes: true, defaultEffort: 'medium' },
    'gpt-5.5': { defaultEffort: 'medium' }
  }
};

if (typeof window !== 'undefined') window.openaiConfig = openaiConfig;
if (typeof module !== 'undefined' && module.exports) module.exports = openaiConfig;
