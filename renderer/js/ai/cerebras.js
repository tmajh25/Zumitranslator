/**
 * Cerebras Configuration & Models
 * 
 * TÀI LIỆU CHÍNH THỨC CEREBRAS CLOUD API (BẮT BUỘC TRA CỨU TRƯỚC KHI CHỈNH SỬA):
 * Official Cerebras Documentation:
 * -> https://inference-docs.cerebras.ai/models
 * LƯU Ý CHO CÁC AGENT / AI BẢO TRÌ: KHÔNG tự ý xóa hoặc thay đổi model khi chưa tra cứu tài liệu chính thức.
 */
const cerebrasConfig = {
  id: 'cerebras',
  name: 'Cerebras',
  badge: 'Ultra-fast',
  badgeClass: 'paid',
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
    supportsMemory: false
  },
  models: [
    { id: 'llama3.1-70b', maxOutputTokens: 8192, contextTokens: 128000 },
    { id: 'llama3.1-8b', maxOutputTokens: 8192, contextTokens: 128000 },
    { id: 'gpt-oss-120b', maxOutputTokens: 8192, contextTokens: 128000 },
    { id: 'qwen-3.8-27b', maxOutputTokens: 8192, contextTokens: 128000 }
  ],
  defaultConfig: {
    model: 'llama3.1-70b',
    chunkSize: 3500,
    enableChunking: true,
    requestDelay: 1000,
    enableDelay: true,
    enableMultiThreading: false,
    translationThreads: 2,
    temperature: 0.6,
    thinkingLevel: 'MEDIUM',
    safetySetting: 'BLOCK_MEDIUM_AND_ABOVE',
    customPrompt: 'Bạn là một dịch giả văn học chuyên nghiệp. Hãy dịch đoạn văn sau sang tiếng Việt một cách tự nhiên, trôi chảy, giữ nguyên phong cách truyện. Chỉ trả về bản dịch.',
    customEndpoint: ''
  }
};

if (typeof window !== 'undefined') window.cerebrasConfig = cerebrasConfig;
if (typeof module !== 'undefined' && module.exports) module.exports = cerebrasConfig;
