/**
 * OpenRouter Configuration & Models
 * 
 * TÀI LIỆU CHÍNH THỨC OPENROUTER (BẮT BUỘC TRA CỨU TRƯỚC KHI CHỈNH SỬA):
 * Official OpenRouter Models Documentation:
 * -> https://openrouter.ai/models
 * LƯU Ý CHO CÁC AGENT / AI BẢO TRÌ: KHÔNG tự ý xóa hoặc thay đổi model khi chưa tra cứu tài liệu chính thức.
 */
const openrouterConfig = {
  id: 'openrouter',
  name: 'OpenRouter',
  badge: 'Aggregator',
  badgeClass: 'custom',
  capabilities: {
    supportsModels: true,
    supportsApiKey: true,
    supportsLanguages: false,
    supportsReasoning: true,
    supportsSafety: false,
    supportsCustomEndpoint: false,
    supportsCustomPrompt: true,
    supportsGlossary: true,
    supportsContext: true,
    supportsMemory: true
  },
  models: [
    { id: 'deepseek/deepseek-r1', maxOutputTokens: 16384, contextTokens: 128000 },
    { id: 'deepseek/deepseek-chat', maxOutputTokens: 8192, contextTokens: 128000 },
    { id: 'anthropic/claude-3.5-sonnet', maxOutputTokens: 8192, contextTokens: 200000 },
    { id: 'meta-llama/llama-3.3-70b-instruct', maxOutputTokens: 8192, contextTokens: 128000 },
    { id: 'google/gemini-2.5-flash', maxOutputTokens: 65536, contextTokens: 1000000 },
    { id: 'google/gemma-4-26b-a4b-it:free', maxOutputTokens: 8192, contextTokens: 128000 },
    { id: 'google/gemma-4-31b-it:free', maxOutputTokens: 8192, contextTokens: 128000 },
    { id: 'qwen/qwen3.8-27b:free', maxOutputTokens: 8192, contextTokens: 128000 }
  ],
  defaultConfig: {
    model: 'google/gemma-4-26b-a4b-it:free',
    chunkSize: 4000,
    enableChunking: true,
    requestDelay: 1000,
    enableDelay: true,
    enableMultiThreading: false,
    translationThreads: 2,
    temperature: 0.7,
    thinkingLevel: 'MEDIUM',
    safetySetting: 'BLOCK_MEDIUM_AND_ABOVE',
    customPrompt: 'Bạn là một dịch giả văn học chuyên nghiệp. Hãy dịch đoạn văn sau sang tiếng Việt một cách tự nhiên, trôi chảy, giữ nguyên phong cách truyện. Chỉ trả về bản dịch.',
    customEndpoint: ''
  }
};

if (typeof window !== 'undefined') window.openrouterConfig = openrouterConfig;
if (typeof module !== 'undefined' && module.exports) module.exports = openrouterConfig;
