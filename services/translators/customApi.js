/**
 * Custom API Translation Driver
 * Supports both OpenAI-compatible endpoints (Ollama, LM Studio, vLLM, LocalAI, One-API)
 * and legacy translation endpoints (LibreTranslate, etc.)
 */

const openaiCompatible = require('./openaiCompatible');

async function translateCustomAPI(params) {
  const { text, sourceLang = 'auto', targetLang = 'vi', apiEndpoint, apiKey, model } = params;
  
  const endpoint = (apiEndpoint || '').trim();
  if (!endpoint) {
    throw new Error('Vui lòng nhập API Endpoint tùy chỉnh trong Cài đặt (Ví dụ: http://localhost:11434/v1 cho Ollama).');
  }

  // If endpoint is an LLM / OpenAI-compatible endpoint (Ollama, LM Studio, vLLM, LocalAI, etc.) or model is specified
  const isLikelyLLM = endpoint.includes('/v1') || 
                      endpoint.includes('/chat') || 
                      endpoint.includes('localhost') || 
                      endpoint.includes('127.0.0.1') || 
                      Boolean(model);

  if (isLikelyLLM) {
    return await openaiCompatible.translate({
      ...params,
      apiEndpoint: endpoint,
      apiProvider: 'custom'
    });
  }

  // Fallback for simple translation services (e.g. LibreTranslate)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': apiKey ? `Bearer ${apiKey}` : '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      q: text,
      source_lang: sourceLang,
      target_lang: targetLang,
      source: sourceLang,
      target: targetLang,
    })
  });
  
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Custom API Error (${response.status}): ${errText.substring(0, 150)}`);
  }

  const data = await response.json();
  return data.translatedText || data.translated_text || data.translation || data.result || data.text || JSON.stringify(data);
}

module.exports = {
  translate: translateCustomAPI,
};
