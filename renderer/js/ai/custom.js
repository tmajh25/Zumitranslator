/**
 * Custom API / Ollama / Local Model Configuration
 * Edit this file to configure default local models or custom endpoints
 */
const customConfig = {
  id: 'custom',
  name: 'Custom API',
  badge: 'Custom',
  badgeClass: 'custom',
  capabilities: {
    supportsModels: true,
    supportsApiKey: true,
    supportsLanguages: false,
    supportsReasoning: true,
    supportsSafety: false,
    supportsCustomEndpoint: true,
    supportsCustomPrompt: true,
    supportsGlossary: true,
    supportsContext: true,
    supportsMemory: true
  },
  models: [
    {
      id: 'qwen2.5:7b',
      name: 'Qwen 2.5 7B (Khuyên dùng dịch thuật / Ollama)',
      maxOutputTokens: 8192,
      contextTokens: 32768
    },
    {
      id: 'qwen2.5:14b',
      name: 'Qwen 2.5 14B (Bản dịch văn học mượt mà)',
      maxOutputTokens: 8192,
      contextTokens: 32768
    },
    {
      id: 'deepseek-r1:8b',
      name: 'DeepSeek-R1 8B (Mô hình suy luận Local)',
      maxOutputTokens: 8192,
      contextTokens: 32768
    },
    {
      id: 'deepseek-r1:14b',
      name: 'DeepSeek-R1 14B (Tư duy & ngữ cảnh sâu)',
      maxOutputTokens: 8192,
      contextTokens: 32768
    },
    {
      id: 'llama-3.1-8b',
      name: 'Llama 3.1 8B (Meta AI phổ biến)',
      maxOutputTokens: 8192,
      contextTokens: 128000
    },
    {
      id: 'llama-3.3-70b',
      name: 'Llama 3.3 70B (Mô hình lớn chất lượng cao)',
      maxOutputTokens: 8192,
      contextTokens: 128000
    },
    {
      id: 'mistral:7b',
      name: 'Mistral 7B (Nhanh và ổn định)',
      maxOutputTokens: 8192,
      contextTokens: 32768
    }
  ],
  defaultConfig: {
    model: 'qwen2.5:7b',
    chunkSize: 3500,
    enableChunking: true,
    requestDelay: 500,
    enableDelay: true,
    enableMultiThreading: false,
    translationThreads: 2,
    temperature: 0.7,
    thinkingLevel: 'MEDIUM',
    safetySetting: 'BLOCK_MEDIUM_AND_ABOVE',
    customPrompt: 'Bạn là một dịch giả văn học chuyên nghiệp. Hãy dịch đoạn văn sau sang tiếng Việt một cách tự nhiên, trôi chảy, giữ nguyên phong cách truyện. Chỉ trả về bản dịch.',
    customEndpoint: 'http://localhost:11434/v1'
  }
};

if (typeof window !== 'undefined') window.customConfig = customConfig;
if (typeof module !== 'undefined' && module.exports) module.exports = customConfig;
