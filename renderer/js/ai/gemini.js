/**
 * Google Gemini Configuration & Models
 * 
 * TÀI LIỆU CHÍNH THỨC CÁC MODEL GOOGLE GEMINI (BẮT BUỘC TRA CỨU TRƯỚC KHI SỬA HOẶC XÓA):
 * Official Google Gemini Models Documentation:
 * -> https://ai.google.dev/gemini-api/docs/models
 * Danh sách model chính thức bao gồm:
 * - Gemini 3: gemini-3.8-flash, gemini-3.7-flash, gemini-3.6-flash, gemini-3.5-flash, gemini-3.5-flash-lite, gemini-3.1-pro-preview, gemini-3.1-flash-lite, gemini-3-flash-preview
 * - Gemini 2.5: gemini-2.5-flash, gemini-2.5-pro, gemini-2.5-flash-lite
 * - Gemini 2.0 & 1.5: gemini-2.0-flash, gemini-2.0-flash-lite, gemini-1.5-flash, gemini-1.5-pro, gemini-flash-latest
 * LƯU Ý CHO CÁC AGENT / AI BẢO TRÌ: KHÔNG tự ý xóa, hạ cấp hoặc thay thế các model trên khi chưa kiểm tra tài liệu chính thức từ link trên!
 * Supports system_instruction, multimodal, and streaming
 */
const geminiConfig = {
  id: 'gemini',
  name: 'Google Gemini',
  badge: 'AI',
  badgeClass: 'ai',
  capabilities: {
    supportsModels: true,
    supportsApiKey: true,
    supportsLanguages: false,
    supportsReasoning: true,
    supportsSafety: true,
    supportsCustomEndpoint: false,
    supportsCustomPrompt: true,
    supportsGlossary: true,
    supportsContext: true,
    supportsMemory: true
  },
  models: [
    { id: 'gemini-3.8-flash', maxOutputTokens: 65536, contextTokens: 1000000 },
    { id: 'gemini-3.7-flash', maxOutputTokens: 65536, contextTokens: 1000000 },
    { id: 'gemini-3.6-flash', maxOutputTokens: 65536, contextTokens: 1000000 },
    { id: 'gemini-3.5-flash', maxOutputTokens: 65536, contextTokens: 1000000 },
    { id: 'gemini-3.5-flash-lite', maxOutputTokens: 65536, contextTokens: 1000000 },
    { id: 'gemini-3.1-pro-preview', maxOutputTokens: 65536, contextTokens: 2000000 },
    { id: 'gemini-3.1-flash-lite', maxOutputTokens: 65536, contextTokens: 1000000 },
    { id: 'gemini-3-flash-preview', maxOutputTokens: 65536, contextTokens: 1000000 },
    { id: 'gemini-2.5-flash', maxOutputTokens: 65536, contextTokens: 1000000 },
    { id: 'gemini-2.5-pro', maxOutputTokens: 65536, contextTokens: 2000000 },
    { id: 'gemini-2.5-flash-lite', maxOutputTokens: 65536, contextTokens: 1000000 },
    { id: 'gemini-2.0-flash', maxOutputTokens: 8192, contextTokens: 1000000 },
    { id: 'gemini-2.0-flash-lite', maxOutputTokens: 8192, contextTokens: 1000000 },
    { id: 'gemini-1.5-flash', maxOutputTokens: 8192, contextTokens: 1000000 },
    { id: 'gemini-1.5-pro', maxOutputTokens: 8192, contextTokens: 2000000 },
    { id: 'gemini-flash-latest', maxOutputTokens: 65536, contextTokens: 1000000 }
  ],
  defaultConfig: {
    model: 'gemini-3.8-flash',
    chunkSize: 6000,
    enableChunking: true,
    requestDelay: 3500, // Cooldown for 15 RPM Free Tier
    enableDelay: true,
    enableMultiThreading: false,
    translationThreads: 1,
    temperature: 1.0,
    thinkingLevel: 'medium', // minimal, low, medium, high
    safetySetting: 'BLOCK_NONE',
    customPrompt: 'Bạn là một dịch giả văn học chuyên nghiệp. Hãy dịch đoạn văn sau sang tiếng Việt một cách tự nhiên, trôi chảy, giữ nguyên phong cách truyện. Chỉ trả về bản dịch.',
    customEndpoint: ''
  },
  thinkingLevels: ['minimal', 'low', 'medium', 'high'],
  apiRevisions: ['2026-05-20', 'v1beta']
};

if (typeof window !== 'undefined') window.geminiConfig = geminiConfig;
if (typeof module !== 'undefined' && module.exports) module.exports = geminiConfig;
