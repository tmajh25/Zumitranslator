/**
 * DeepL Translation API (Free and Pro)
 * 
 * TÀI LIỆU CHÍNH THỨC DEEPL API (BẮT BUỘC TRA CỨU TRƯỚC KHI CHỈNH SỬA):
 * Official DeepL API Documentation:
 * -> https://developers.deepl.com/docs/api-reference/translate
 * LƯU Ý: DeepL hỗ trợ model_type: 'quality_optimized', 'latency_optimized', 'prefer_quality_optimized'.
 */

async function translateDeepL({ text, sourceLang = 'auto', targetLang = 'vi', apiKey, model = 'quality_optimized', abortSignal = null }) {
  if (!apiKey) {
    throw new Error('Vui lòng nhập API Key cho DeepL trong Cài đặt.');
  }

  const isFreePlan = apiKey.endsWith(':fx');
  const baseUrl = isFreePlan 
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';
  
  const modelType = ['quality_optimized', 'latency_optimized', 'prefer_quality_optimized'].includes(model) 
    ? model 
    : 'quality_optimized';

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [text],
      source_lang: sourceLang === 'auto' ? undefined : sourceLang.toUpperCase(),
      target_lang: targetLang.toUpperCase(),
      model_type: modelType
    }),
    signal: abortSignal || undefined
  });
  
  const data = await response.json();
  if (data.message) throw new Error(data.message);
  return data.translations[0].text;
}

module.exports = {
  translate: translateDeepL,
};
