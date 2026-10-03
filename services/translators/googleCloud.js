/**
 * Google Cloud Translation API v2
 * 
 * TÀI LIỆU CHÍNH THỨC GOOGLE CLOUD TRANSLATION:
 * Official Google Cloud Translation Documentation:
 * -> https://cloud.google.com/translate/docs
 */

async function translateGoogleCloud({ text, sourceLang = 'auto', targetLang = 'vi', apiKey, abortSignal = null }) {
  if (!apiKey) {
    throw new Error('Vui lòng nhập API Key cho Google Cloud Translation trong Cài đặt.');
  }

  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source: sourceLang === 'auto' ? undefined : sourceLang,
      target: targetLang,
      format: 'text'
    }),
    signal: abortSignal || undefined
  });
  
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.data.translations[0].translatedText;
}

module.exports = {
  translate: translateGoogleCloud,
};
