/**
 * Groq Cloud Configuration & Models
 * 
 * TÀI LIỆU CHÍNH THỨC GROQ CLOUD API (BẮT BUỘC TRA CỨU TRƯỚC KHI CHỈNH SỬA):
 * Official Groq Documentation:
 * -> https://console.groq.com/docs/models
 * LƯU Ý CHO CÁC AGENT / AI BẢO TRÌ: KHÔNG tự ý xóa hoặc thay đổi model khi chưa tra cứu tài liệu chính thức.
 */
const groqConfig = {
  id: 'groq',
  name: 'Groq Cloud',
  badge: 'Fast',
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
    { id: 'llama-3.3-70b-versatile', maxOutputTokens: 8192, contextTokens: 128000 },
    { id: 'llama-3.1-8b-instant', maxOutputTokens: 8192, contextTokens: 128000 },
    { id: 'deepseek-r1-distill-llama-70b', maxOutputTokens: 8192, contextTokens: 128000 },
    { id: 'mixtral-8x7b-32768', maxOutputTokens: 8192, contextTokens: 32768 },
    { id: 'qwen/qwen3.8-27b', maxOutputTokens: 8192, contextTokens: 128000 },
    { id: 'openai/gpt-oss-120b', maxOutputTokens: 8192, contextTokens: 128000 },
    { id: 'openai/gpt-oss-20b', maxOutputTokens: 8192, contextTokens: 128000 },
    { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', maxOutputTokens: 8192, contextTokens: 128000 },
    { id: 'allam-2-7b', maxOutputTokens: 8192, contextTokens: 128000 }
  ],
  defaultConfig: {
    model: 'llama-3.3-70b-versatile',
    chunkSize: 2500, // Strict TPM limit on Groq Free Tier
    enableChunking: true,
    requestDelay: 2500,
    enableDelay: true,
    enableMultiThreading: false,
    translationThreads: 1,
    temperature: 0.6,
    thinkingLevel: 'MEDIUM',
    safetySetting: 'BLOCK_MEDIUM_AND_ABOVE',
    customPrompt: 'Bạn là một dịch giả văn học chuyên nghiệp. Hãy dịch đoạn văn sau sang tiếng Việt một cách tự nhiên, trôi chảy, giữ nguyên phong cách truyện. Chỉ trả về bản dịch.',
    customEndpoint: ''
  }
};

if (typeof window !== 'undefined') window.groqConfig = groqConfig;
if (typeof module !== 'undefined' && module.exports) module.exports = groqConfig;
