/**
 * DeepSeek Configuration & Models
 * 
 * TÀI LIỆU CHÍNH THỨC DEEPSEEK API (BẮT BUỘC TRA CỨU TRƯỚC KHI CHỈNH SỬA):
 * Official DeepSeek Documentation:
 * -> https://api-docs.deepseek.com/
 * -> https://platform.deepseek.com/
 * LƯU Ý CHO CÁC AGENT / AI BẢO TRÌ: KHÔNG tự ý xóa hoặc thay đổi model khi chưa tra cứu tài liệu chính thức.
 */
const deepseekConfig = {
  id: 'deepseek',
  name: 'DeepSeek',
  badge: 'Cheap',
  badgeClass: 'ai',
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
    {
      id: 'deepseek-flash',
      name: 'DeepSeek-V4.1-Flash',
      maxOutputTokens: 384000,
      contextTokens: 1000000
    },
    {
      id: 'deepseek-v4-pro',
      name: 'DeepSeek-V4-Pro-0813',
      maxOutputTokens: 384000,
      contextTokens: 1000000
    }
  ],
  defaultConfig: {
    model: 'deepseek-flash',
    chunkSize: 4000,
    enableChunking: true,
    requestDelay: 800,
    enableDelay: true,
    enableMultiThreading: false,
    translationThreads: 2,
    temperature: 0.6,
    thinkingLevel: 'HIGH',
    safetySetting: 'BLOCK_MEDIUM_AND_ABOVE',
    customPrompt: 'Bạn là một dịch giả văn học chuyên nghiệp. Hãy dịch đoạn văn sau sang tiếng Việt một cách tự nhiên, trôi chảy, giữ nguyên phong cách truyện. Chỉ trả về bản dịch.',
    customEndpoint: ''
  }
};

if (typeof window !== 'undefined') window.deepseekConfig = deepseekConfig;
if (typeof module !== 'undefined' && module.exports) module.exports = deepseekConfig;
