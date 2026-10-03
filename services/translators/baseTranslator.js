/**
 * Base Translator utilities and shared language mappings
 */

const LANG_MAP = {
  'auto': 'auto-detect',
  'vi': 'Vietnamese',
  'en': 'English',
  'ja': 'Japanese',
  'ko': 'Korean',
  'zh': 'Chinese',
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  'fr': 'French',
  'de': 'German',
  'es': 'Spanish',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'th': 'Thai',
  'id': 'Indonesian',
  'ar': 'Arabic',
  'hi': 'Hindi',
  'it': 'Italian',
};

function getLanguageNames(sourceLang, targetLang) {
  return {
    source: LANG_MAP[sourceLang] || sourceLang,
    target: LANG_MAP[targetLang] || targetLang,
  };
}

function parseApiKeys(apiKeyInput) {
  if (!apiKeyInput) return [];
  if (Array.isArray(apiKeyInput)) {
    return apiKeyInput
      .map(item => (typeof item === 'string' ? item : item?.key || '').replace(/\s+/g, ''))
      .filter(k => k && k !== '[object Object]');
  }
  if (typeof apiKeyInput === 'object' && apiKeyInput.key) {
    return [String(apiKeyInput.key).replace(/\s+/g, '')].filter(Boolean);
  }
  if (typeof apiKeyInput !== 'string') return [];
  return apiKeyInput
    .split(/[\r\n,;]+/)
    .map(k => k.replace(/\s+/g, ''))
    .filter(k => k && k !== '[object Object]');
}

module.exports = {
  LANG_MAP,
  getLanguageNames,
  parseApiKeys,
};
