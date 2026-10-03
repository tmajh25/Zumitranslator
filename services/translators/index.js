/**
 * Translator Registry (Strategy Pattern)
 * Central dispatcher for all translation services
 */

const googleFree = require('./googleFree');
const googleCloud = require('./googleCloud');
const deepl = require('./deepl');
const gemini = require('./gemini');
const openaiCompatible = require('./openaiCompatible');
const customApi = require('./customApi');

class TranslatorRegistry {
  constructor() {
    this.drivers = new Map();
    this.registerDefaults();
  }

  registerDefaults() {
    this.register('google-free', googleFree);
    this.register('google', googleCloud);
    this.register('deepl', deepl);
    this.register('gemini', gemini);
    this.register('openai', openaiCompatible);
    this.register('groq', openaiCompatible);
    this.register('deepseek', openaiCompatible);
    this.register('openrouter', openaiCompatible);
    this.register('cerebras', openaiCompatible);
    this.register('custom', customApi);
  }

  register(name, driver) {
    this.drivers.set(name, driver);
  }

  get(name) {
    return this.drivers.get(name) || this.drivers.get('google-free');
  }

  async translate(params) {
    const provider = params.apiProvider || 'google-free';
    const driver = this.get(provider);
    
    if (!driver || typeof driver.translate !== 'function') {
      throw new Error(`Nhà cung cấp dịch "${provider}" chưa được hỗ trợ hoặc thiếu driver.`);
    }

    return await driver.translate(params);
  }
}

const defaultRegistry = new TranslatorRegistry();

module.exports = {
  TranslatorRegistry,
  translatorRegistry: defaultRegistry,
};
