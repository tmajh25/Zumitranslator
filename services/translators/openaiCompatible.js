/**
 * OpenAI-Compatible Chat Completions Driver
 * Used for OpenAI, Groq, DeepSeek, OpenRouter, Cerebras, etc.
 * Supports Multi-Key Pool & Auto-Rotation on 429/503
 * Follows SOLID principles:
 * - SRP: Delegates prompt building to PromptBuilder & cleaning to ResponseCleaner
 * - OCP: Delegates payload formatting to PayloadAdapterRegistry
 */

const { parseApiKeys } = require('./baseTranslator');
const PromptBuilder = require('./promptBuilder');
const ResponseCleaner = require('./responseCleaner');
const { payloadAdapterRegistry } = require('./payloadAdapters');

const DEFAULT_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  cerebras: 'https://api.cerebras.ai/v1/chat/completions',
  custom: 'http://localhost:11434/v1/chat/completions'
};

const keyIndexByProvider = {};

async function translateOpenAICompatible({
  text,
  sourceLang = 'auto',
  targetLang = 'vi',
  customPrompt,
  apiKey,
  model,
  apiEndpoint,
  apiProvider = 'openai',
  thinkingLevel = 'MEDIUM',
  reasoningEffort = 'medium',
  reasoningMode = 'standard',
  temperature = 1.0,
  glossary = [],
  characterProfiles = [],
  context = '',
  bookMemory = '',
  abortSignal = null
}) {
  let endpoint = (apiEndpoint || '').trim() || DEFAULT_ENDPOINTS[apiProvider] || 'https://api.openai.com/v1/chat/completions';
  if (endpoint && !endpoint.includes('/chat/completions') && !endpoint.includes('/v1/responses')) {
    endpoint = endpoint.replace(/\/+$/, '') + (endpoint.endsWith('/v1') ? '/chat/completions' : '/v1/chat/completions');
  }
  const keys = parseApiKeys(apiKey);

  if (keys.length === 0 && apiProvider !== 'custom') {
    throw new Error(`Vui lòng nhập API Key cho ${apiProvider.toUpperCase()} trong Cài đặt.`);
  }

  if (keyIndexByProvider[apiProvider] === undefined) {
    keyIndexByProvider[apiProvider] = 0;
  }

  // SRP: Build instructions & user content via PromptBuilder
  const instructions = PromptBuilder.buildSystemInstruction({
    customPrompt,
    sourceLang,
    targetLang,
    glossary,
    characterProfiles,
    bookMemory,
    context,
    text
  });

  const userContent = PromptBuilder.buildUserContent({ text, context });

  const messages = [
    { role: 'system', content: instructions },
    { role: 'user', content: userContent }
  ];

  // OCP: Resolve specialized adapter from registry to build provider-specific payload
  const adapter = payloadAdapterRegistry.getAdapter({ apiProvider, model, endpoint });
  const body = adapter.buildPayload({
    model,
    messages,
    temperature,
    thinkingLevel,
    reasoningEffort,
    reasoningMode,
    endpoint
  });

  const effectiveKeys = keys.length > 0 ? keys : [''];
  const triedKeyIndices = new Set();
  const maxRetriesPerKey = 3;
  let response;

  while (triedKeyIndices.size < effectiveKeys.length) {
    const keyIdx = keyIndexByProvider[apiProvider] % effectiveKeys.length;
    triedKeyIndices.add(keyIdx);
    const activeKey = effectiveKeys[keyIdx];
    const keyNum = keyIdx + 1;

    let keyRetryCount = 0;
    let switchKey = false;

    while (keyRetryCount <= maxRetriesPerKey) {
      if (abortSignal && abortSignal.aborted) {
        throw new Error('Dịch đã bị hủy');
      }

      const controller = new AbortController();
      const onAbort = () => controller.abort();
      if (abortSignal) {
        abortSignal.addEventListener('abort', onAbort, { once: true });
      }
      const timeoutId = setTimeout(() => controller.abort(), 50000);

      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': activeKey ? `Bearer ${activeKey}` : '',
            'Content-Type': 'application/json',
            ...(endpoint.includes('openrouter') ? { 'HTTP-Referer': 'https://smart-translator.app', 'X-Title': 'Smart Translator' } : {})
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (abortSignal) abortSignal.removeEventListener('abort', onAbort);
        
        if (response.ok) break;
        
        // Fatal key error: 401, 403 -> chuyển key ngay lập tức không cần đợi 3 lần
        if (response.status === 401 || response.status === 403) {
          console.warn(`[${apiProvider.toUpperCase()}] HTTP ${response.status}: Key #${keyNum}/${effectiveKeys.length} bi tu choi xac thuc. Doi key ngay...`);
          switchKey = true;
          break;
        }

        // Lỗi 429 (Rate Limit), 503 (Quá tải), 500/502/504 (Server Error) -> Thử lại 3 lần trên cùng key này, mỗi lần cách 3s
        if (response.status === 429 || response.status === 503 || response.status >= 500) {
          if (abortSignal && abortSignal.aborted) throw new Error('Dịch đã bị hủy');
          keyRetryCount++;
          if (keyRetryCount <= maxRetriesPerKey) {
            console.warn(`[${apiProvider.toUpperCase()}] Key #${keyNum}/${effectiveKeys.length} gap HTTP ${response.status}. Thu lai lan ${keyRetryCount}/${maxRetriesPerKey} sau 3s...`);
            await new Promise(r => setTimeout(r, 3000));
            if (abortSignal && abortSignal.aborted) throw new Error('Dịch đã bị hủy');
            continue;
          } else {
            console.warn(`[${apiProvider.toUpperCase()}] Key #${keyNum}/${effectiveKeys.length} da thu lai du ${maxRetriesPerKey} lan (HTTP ${response.status}). Tien hanh chuyen key tiep theo...`);
            switchKey = true;
            break;
          }
        }

        // Lỗi client khác (VD 400 Bad Request)
        break;
      } catch (networkErr) {
        clearTimeout(timeoutId);
        if (abortSignal) abortSignal.removeEventListener('abort', onAbort);
        if (abortSignal && abortSignal.aborted) {
          throw new Error('Dịch đã bị hủy');
        }
        keyRetryCount++;
        if (keyRetryCount <= maxRetriesPerKey) {
          console.warn(`[${apiProvider.toUpperCase()}] Loi mang/timeout Key #${keyNum}/${effectiveKeys.length} (${networkErr.message}). Thu lai lan ${keyRetryCount}/${maxRetriesPerKey} sau 3s...`);
          await new Promise(r => setTimeout(r, 3000));
          if (abortSignal && abortSignal.aborted) throw new Error('Dịch đã bị hủy');
          continue;
        } else {
          console.warn(`[${apiProvider.toUpperCase()}] Key #${keyNum}/${effectiveKeys.length} loi ket noi sau ${maxRetriesPerKey} lan thu. Tien hanh chuyen key tiep theo...`);
          switchKey = true;
          break;
        }
      }
    }

    if (response && response.ok) {
      break;
    }

    if (switchKey || !response || !response.ok) {
      if (effectiveKeys.length > 1) {
        keyIndexByProvider[apiProvider] = (keyIndexByProvider[apiProvider] + 1) % effectiveKeys.length;
        const nextKeyNum = (keyIndexByProvider[apiProvider] % effectiveKeys.length) + 1;
        if (triedKeyIndices.size < effectiveKeys.length) {
          console.log(`[${apiProvider.toUpperCase()}] Doi sang Key #${nextKeyNum}/${effectiveKeys.length}...`);
          await new Promise(r => setTimeout(r, 300));
          continue;
        } else {
          console.warn(`[${apiProvider.toUpperCase()}] Tat ca ${effectiveKeys.length} API Key deu da thu du lan ma van that bai.`);
          break;
        }
      } else {
        break;
      }
    }
  }

  if (!response.ok) {
    let errorMsg = response.statusText;
    try {
      const errData = await response.json();
      if (errData && errData.error) {
        errorMsg = typeof errData.error === 'string' ? errData.error : (errData.error.message || JSON.stringify(errData.error));
      }
    } catch (_) {}

    if (response.status === 503) {
      errorMsg = `Lỗi 503: Server API (${endpoint}) đang bận. Hãy thử lại hoặc nhập nhiều API Key để tự động xoay tua.`;
    }
    if (response.status === 429) {
      errorMsg = `Lỗi 429: Đã vượt quá giới hạn request (Rate Limit). Hãy thêm nhiều API Key (phân cách bằng dấu phẩy) trong Cài đặt để tự động chuyển key.`;
    }
    throw new Error(`API Error (${response.status}): ${errorMsg}`);
  }
  
  const data = await response.json();
  if (data.error) {
    const errorMsg = typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
    throw new Error(`API Error: ${errorMsg}`);
  }
  
  const choice = data.choices && data.choices[0];
  const message = choice && choice.message;
  const content = message ? (message.content || message.reasoning_content) : null;

  if (!choice || !message || !content) {
    throw new Error('Không có phản hồi từ API (Choices empty). Có thể do API Key hết hạn hoặc quota.');
  }
  
  // SRP: Delegate response cleaning (CoT stripping) to ResponseCleaner
  return ResponseCleaner.clean(content);
}

module.exports = {
  translate: translateOpenAICompatible,
  DEFAULT_ENDPOINTS
};
