/**
 * STATE MODULE
 * Manages application state and local storage
 */

const State = {
  currentFile: null,
  isTranslating: false,
  cancelRequested: false,
  translatedContent: '',
  chapters: [],
  books: [],
  currentBook: null,
  settings: {},
  finishedChapters: [],

  init() {
    this.books = this.loadBooks();
    this.settings = this.loadSettings();
    this.loadBooksFromDiskAsync();

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        if (this._saveBooksTimer) {
          clearTimeout(this._saveBooksTimer);
          this.saveBooks(true);
        }
      });
    }
  },

  // --- Books Management ---
  loadBooks() {
    const saved = localStorage.getItem('zumi_books');
    if (saved) {
      try { return JSON.parse(saved); } catch(e) { return []; }
    }
    return [];
  },

  async loadBooksFromDiskAsync() {
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.loadBooksFromDisk === 'function') {
      try {
        const res = await window.electronAPI.loadBooksFromDisk();
        if (res && res.success && Array.isArray(res.books) && res.books.length > 0) {
          this.books = res.books;
          if (this.currentBook) {
            const found = this.books.find(b => b.filePath === this.currentBook.filePath);
            if (found) this.currentBook = found;
          }
          if (typeof Bookshelf !== 'undefined' && typeof Bookshelf.renderBookshelf === 'function') {
            Bookshelf.renderBookshelf();
          }
        } else if (this.books && this.books.length > 0) {
          // Tự động sao lưu dữ liệu từ localStorage sang đĩa ở lần chạy đầu tiên
          await window.electronAPI.saveBooksToDisk(this.books);
        }
      } catch (err) {
        console.warn('Lỗi đọc sách từ đĩa:', err);
      }
    }
  },

  saveBooks(immediate = false) {
    if (this._saveBooksTimer) {
      clearTimeout(this._saveBooksTimer);
      this._saveBooksTimer = null;
    }

    const doSave = () => {
      // 1. Ưu tiên lưu trực tiếp ra đĩa (Atomic write qua BookStorage)
      if (typeof window !== 'undefined' && window.electronAPI) {
        if (typeof window.electronAPI.saveBooksToDisk === 'function') {
          window.electronAPI.saveBooksToDisk(this.books).catch(err => {
            console.error('Lỗi khi lưu sách ra đĩa:', err);
          });
        }
      }

      // 2. Dự phòng trong localStorage (nếu dung lượng cho phép)
      try {
        localStorage.setItem('zumi_books', JSON.stringify(this.books));
      } catch (e) {
        // Khi vượt quá 5MB của localStorage, dữ liệu sách vẫn an toàn 100% trên đĩa
      }
    };

    if (immediate) {
      doSave();
    } else {
      this._saveBooksTimer = setTimeout(doSave, 1500);
    }
  },

  saveCurrentBook(immediate = false) {
    if (!this.currentBook) return this.saveBooks(immediate);

    if (this._saveCurrentTimer) {
      clearTimeout(this._saveCurrentTimer);
      this._saveCurrentTimer = null;
    }

    const doSave = () => {
      if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.saveSingleBookToDisk === 'function') {
        window.electronAPI.saveSingleBookToDisk(this.currentBook).catch(err => {
          console.error('Lỗi khi lưu sách hiện tại:', err);
        });
      }
    };

    if (immediate) {
      doSave();
    } else {
      this._saveCurrentTimer = setTimeout(doSave, 1200);
    }
  },

  deleteBook(path) {
    this.books = this.books.filter(b => b.filePath !== path);
    this.saveBooks();
  },

  // Default provider-specific profiles retrieved from centralized AIConfig module
  getProviderDefaults(provider) {
    if (typeof AIConfig !== 'undefined') {
      return AIConfig.getDefaultConfig(provider);
    }
    try {
      const aiCfg = require('./aiConfig');
      return aiCfg.getDefaultConfig(provider);
    } catch (e) {
      return {};
    }
  },

  getProviderConfig(provider) {
    const p = provider || this.settings?.apiProvider || 'google-free';
    if (!this.settings) this.settings = {};
    if (!this.settings.providerConfigs) this.settings.providerConfigs = {};
    const defaults = this.getProviderDefaults(p) || {};
    const existing = this.settings.providerConfigs[p] || {};
    
    // Only return provider specific keys
    const providerSpecificKeys = [
      'apiKey', 'apiKeys', 'model', 'customEndpoint', 'temperature',
      'thinkingLevel', 'reasoningEffort', 'reasoningMode', 'safetySetting', 'customPrompt'
    ];
    const res = {};
    providerSpecificKeys.forEach(k => {
      if (existing[k] !== undefined) {
        res[k] = existing[k];
      } else if (defaults[k] !== undefined) {
        res[k] = defaults[k];
      }
    });
    return res;
  },

  switchProvider(newProvider) {
    this.settings.apiProvider = newProvider;
    const config = this.getProviderConfig(newProvider);
    const providerSpecificKeys = [
      'apiKey', 'apiKeys', 'model', 'customEndpoint', 'temperature',
      'thinkingLevel', 'reasoningEffort', 'reasoningMode', 'safetySetting', 'customPrompt'
    ];
    providerSpecificKeys.forEach(k => {
      if (config[k] !== undefined) {
        this.settings[k] = config[k];
      }
    });
    this.saveSettings({ apiProvider: newProvider });
  },

  // --- Settings Management ---
  loadSettings() {
    const defaultSettings = {
      apiProvider: 'google-free',
      apiKey: '',
      model: '',
      customEndpoint: '',
      providerConfigs: {}, // To store full provider profiles: { [provider]: { model, apiKey, ... } }
      sourceLang: 'auto',
      targetLang: 'vi',
      chunkSize: 3000,
      chunkMode: 'auto', // 'auto' (dựa theo max output token của model AI) hoặc 'manual'
      requestDelay: 1000,
      thinkingLevel: 'MEDIUM',
      reasoningEffort: 'medium',
      reasoningMode: 'standard',
      safetySetting: 'BLOCK_MEDIUM_AND_ABOVE',
      customPrompt: '',
      translateChapterTitles: true,
      titleTranslationMode: 'ai',
      enableMultiThreading: false,
      translationThreads: 2,
      enableChunking: true,
      enableDelay: true,
      temperature: 1.0,
      profilerProvider: 'auto',
      profilerModel: 'auto',
      autoScanChapters: false,
      glossary: [],
      enableFallback: true,
      providerModelFallbacks: {}, // Dynamically resolved from AIConfig models
      enableCrossProviderFallback: true,
      crossProviderOrder: (typeof AIConfig !== 'undefined' && AIConfig.providers)
        ? Object.keys(AIConfig.providers).filter(p => !['deepl', 'custom'].includes(p))
        : ['gemini', 'groq', 'deepseek', 'openai', 'openrouter', 'cerebras', 'google-free'],
      fallbackToGoogleFree: true,
      appearance: {
        theme: 'light',
        accent: 'indigo',
        font: 'system',
        fontSize: 'medium',
        radius: 'subtle',
        reduceMotion: false,
        compactMode: false
      }
    };

    let saved = localStorage.getItem('zumi_settings');
    
    // Migration: Check for older keys if the new one doesn't exist
    if (!saved) {
      const legacyKeys = ['settings', 'translator_settings', 'zumi_config', 'config'];
      for (const key of legacyKeys) {
        const legacyData = localStorage.getItem(key);
        if (legacyData) {
          saved = legacyData;
          localStorage.setItem('zumi_settings', saved); // Migrate to new key
          console.log(`Migrated settings from legacy key: ${key}`);
          break;
        }
      }
    }

    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        // Handle legacy field names
        if (parsed.prompt && !parsed.customPrompt) parsed.customPrompt = parsed.prompt;
        if (parsed.api_key && !parsed.apiKey) parsed.apiKey = parsed.api_key;
        if (parsed.provider && !parsed.apiProvider) parsed.apiProvider = parsed.provider;
        
        const merged = { ...defaultSettings, ...parsed };
        
        // Initialize providerConfigs if missing
        if (!merged.providerConfigs) merged.providerConfigs = {};
        
        // Merge active provider's specific profile without overwriting global translation settings
        const activeProvider = merged.apiProvider || 'google-free';
        const providerDefaults = this.getProviderDefaults(activeProvider) || {};
        const existingProviderConfig = merged.providerConfigs[activeProvider] || {};
        
        const providerSpecificKeys = [
          'apiKey', 'apiKeys', 'model', 'customEndpoint', 'temperature',
          'thinkingLevel', 'reasoningEffort', 'reasoningMode', 'safetySetting', 'customPrompt'
        ];
        
        providerSpecificKeys.forEach(k => {
          if (existingProviderConfig[k] !== undefined) {
            merged[k] = existingProviderConfig[k];
          } else if (merged[k] === undefined || (merged[k] === '' && providerDefaults[k])) {
            merged[k] = providerDefaults[k];
          }
        });
        
        return merged; 
      } catch(e) { 
        return defaultSettings; 
      }
    }

    const defaultProviderConfig = this.getProviderDefaults('google-free');
    return { ...defaultSettings, ...defaultProviderConfig };
  },

  getFallbackModels(provider, excludeModel = null) {
    const allModels = (typeof AIConfig !== 'undefined') ? AIConfig.getModels(provider) : [];
    if (!allModels || allModels.length === 0) return [];

    const configured = this.settings?.providerModelFallbacks?.[provider];
    if (Array.isArray(configured)) {
      // Return strictly the models configured by the user, preserving choice to have zero fallbacks (single model standing alone)
      return configured.filter(m => allModels.includes(m) && m !== excludeModel);
    }

    if (provider === 'gemini') {
      const preferred = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];
      const candidates = preferred.filter(m => allModels.includes(m) && m !== excludeModel);
      allModels.forEach(m => {
        if (!candidates.includes(m) && m !== excludeModel) candidates.push(m);
      });
      return candidates.slice(0, 4);
    }

    // Default if never configured by user: return default fallback list
    return allModels.filter(m => m !== excludeModel).slice(0, 4);
  },

  getFallbackChain() {
    const s = this.settings || {};
    const currentProv = s.apiProvider || 'gemini';
    const provCfg = (typeof this.getProviderConfig === 'function') ? this.getProviderConfig(currentProv) : {};
    const provObj = (typeof AIConfig !== 'undefined') ? AIConfig.getProvider(currentProv) : {};
    const defaultModel = provObj.models ? (typeof provObj.models[0] === 'string' ? provObj.models[0] : provObj.models[0]?.id) : '';
    const currentModel = s.model || provCfg.model || defaultModel || '';

    const getDsModels = () => {
      if (typeof AIConfig !== 'undefined' && AIConfig.getModels) {
        const ms = AIConfig.getModels('deepseek');
        if (ms && ms.length > 0) return ms;
      }
      return ['deepseek-flash', 'deepseek-v4-pro'];
    };
    const dsModels = getDsModels();
    const dsModel1 = dsModels[0] || 'deepseek-flash';
    const dsModel2 = dsModels[1] || dsModel1;

    let chain = s.unifiedFallbackChain;
    if (Array.isArray(chain) && chain.length > 0) {
      // Sync the first item with current active provider & model
      const valid = chain.filter(item => item && item.provider);
      if (valid.length > 0) {
        // Sanitize any outdated deepseek models from localStorage
        valid.forEach(item => {
          if (item.provider === 'deepseek') {
            if (item.model === 'deepseek-chat') item.model = dsModel1;
            if (item.model === 'deepseek-reasoner') item.model = dsModel2;
          }
        });
        // Deduplicate consecutive identical provider+model steps
        const deduped = [valid[0]];
        for (let i = 1; i < valid.length; i++) {
          const prev = deduped[deduped.length - 1];
          if (valid[i].provider !== prev.provider || valid[i].model !== prev.model) {
            deduped.push(valid[i]);
          }
        }
        deduped[0].provider = currentProv;
        deduped[0].model = currentModel;
        return deduped;
      }
    }

    // Default smart interleaved sequence
    const defaults = [
      { provider: currentProv, model: currentModel }
    ];

    // Auto-populate fallback models of current provider (rotates through models of the same provider)
    const provFallbacks = this.getFallbackModels(currentProv, currentModel);
    provFallbacks.forEach(m => {
      if (m && m !== currentModel && !defaults.some(d => d.provider === currentProv && d.model === m)) {
        defaults.push({ provider: currentProv, model: m });
      }
    });

    if (currentProv === 'gemini') {
      defaults.push({ provider: 'deepseek', model: dsModel1 });
      defaults.push({ provider: 'groq', model: 'llama-3.3-70b-versatile' });
    } else if (currentProv === 'deepseek') {
      defaults.push({ provider: 'gemini', model: 'gemini-3.8-flash' });
      defaults.push({ provider: 'deepseek', model: dsModel2 });
      defaults.push({ provider: 'groq', model: 'llama-3.3-70b-versatile' });
    } else {
      defaults.push({ provider: 'gemini', model: 'gemini-3.8-flash' });
      defaults.push({ provider: 'deepseek', model: dsModel1 });
      defaults.push({ provider: 'groq', model: 'llama-3.3-70b-versatile' });
    }

    return defaults;
  },

  getProfilerFallbackChain() {
    const s = this.settings || {};
    let currentProv = s.profilerProvider || 'auto';
    if (currentProv === 'auto') {
      currentProv = s.apiProvider || 'gemini';
      if (['google-free', 'deepl'].includes(currentProv)) {
        currentProv = 'gemini';
      }
    }
    const provCfg = (typeof this.getProviderConfig === 'function') ? this.getProviderConfig(currentProv) : {};
    const provObj = (typeof AIConfig !== 'undefined') ? AIConfig.getProvider(currentProv) : {};
    const defaultModel = provObj.models ? (typeof provObj.models[0] === 'string' ? provObj.models[0] : provObj.models[0]?.id) : '';
    let currentModel = (s.profilerModel && s.profilerModel !== 'auto') ? s.profilerModel : (provCfg.model || defaultModel || '');

    const getDsModels = () => {
      if (typeof AIConfig !== 'undefined' && AIConfig.getModels) {
        const ms = AIConfig.getModels('deepseek');
        if (ms && ms.length > 0) return ms;
      }
      return ['deepseek-flash', 'deepseek-v4-pro'];
    };
    const dsModels = getDsModels();
    const dsModel1 = dsModels[0] || 'deepseek-flash';
    const dsModel2 = dsModels[1] || dsModel1;

    let chain = s.profilerFallbackChain;
    if (Array.isArray(chain) && chain.length > 0) {
      const valid = chain.filter(item => item && item.provider);
      if (valid.length > 0) {
        // Sanitize any outdated deepseek models from localStorage
        valid.forEach(item => {
          if (item.provider === 'deepseek') {
            if (item.model === 'deepseek-chat') item.model = dsModel1;
            if (item.model === 'deepseek-reasoner') item.model = dsModel2;
          }
        });
        valid[0].provider = currentProv;
        valid[0].model = currentModel;
        return valid;
      }
    }

    // Default smart interleaved sequence for Profiler Scanning
    const defaults = [
      { provider: currentProv, model: currentModel }
    ];

    // Auto-populate fallback models of current provider
    const provFallbacks = this.getFallbackModels(currentProv, currentModel);
    provFallbacks.forEach(m => {
      if (m && m !== currentModel && !defaults.some(d => d.provider === currentProv && d.model === m)) {
        defaults.push({ provider: currentProv, model: m });
      }
    });

    if (currentProv === 'gemini') {
      defaults.push({ provider: 'deepseek', model: dsModel1 });
      defaults.push({ provider: 'groq', model: 'llama-3.3-70b-versatile' });
    } else if (currentProv === 'deepseek') {
      defaults.push({ provider: 'gemini', model: 'gemini-2.5-flash' });
      defaults.push({ provider: 'deepseek', model: dsModel2 });
      defaults.push({ provider: 'groq', model: 'llama-3.3-70b-versatile' });
    } else {
      defaults.push({ provider: 'gemini', model: 'gemini-2.5-flash' });
      defaults.push({ provider: 'deepseek', model: dsModel1 });
      defaults.push({ provider: 'groq', model: 'llama-3.3-70b-versatile' });
    }

    return defaults;
  },

  saveSettings(newSettings = {}) {
    this.settings = { ...this.settings, ...newSettings };
    
    // Automatically persist provider-specific fields into the current provider's profile
    const p = this.settings.apiProvider || 'google-free';
    if (!this.settings.providerConfigs) this.settings.providerConfigs = {};
    if (!this.settings.providerConfigs[p]) this.settings.providerConfigs[p] = {};
    const config = this.settings.providerConfigs[p];

    const providerSpecificKeys = [
      'apiKey', 'apiKeys', 'model', 'customEndpoint', 'temperature',
      'thinkingLevel', 'reasoningEffort', 'reasoningMode', 'safetySetting', 'customPrompt'
    ];

    providerSpecificKeys.forEach(k => {
      if (newSettings[k] !== undefined) {
        config[k] = newSettings[k];
      } else if (this.settings[k] !== undefined && config[k] === undefined) {
        config[k] = this.settings[k];
      }
    });

    if (newSettings.apiKey !== undefined && newSettings.apiKeys === undefined) {
      const rawList = (newSettings.apiKey || '').split(/[\r\n,;]+/).map(k => k.trim()).filter(Boolean);
      config.apiKeys = rawList.map(k => ({
        key: k,
        status: 'idle',
        statusMessage: 'Chưa kiểm tra'
      }));
    }

    this.settings.providerConfigs[p] = config;
    try {
      localStorage.setItem('zumi_settings', JSON.stringify(this.settings));
      this.notifySettingsSaved();
    } catch (err) {
      console.error('Error saving settings to localStorage:', err);
    }
  },

  notifySettingsSaved() {
    const statusEl = document.getElementById('settingsSaveStatus');
    if (statusEl) {
      statusEl.textContent = 'Đã tự động lưu';
      statusEl.style.opacity = '1';
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => {
        statusEl.style.opacity = '0';
      }, 2000);
    }
    window.dispatchEvent(new CustomEvent('zumi:settings-saved', { detail: this.settings }));
  },

  // --- Session Data ---
  updateFinishedChapters() {
    this.finishedChapters.sort((a, b) => a.sourceChapterId - b.sourceChapterId);
    this.translatedContent = this.finishedChapters.map(fc => fc.content).join('\n\n---CHAPTER_BREAK---\n\n');
  },

  saveTranslationProgress(processedChunks, totalChunks = 0) {
    if (!this.currentBook) return;
    
    this.updateFinishedChapters();
    this.currentBook.processedChunks = processedChunks;
    if (totalChunks > 0) this.currentBook.totalChunks = totalChunks;
    this.currentBook.translatedContent = this.translatedContent;
    this.currentBook.finishedChapters = this.finishedChapters;
    this.currentBook.lastAccessed = Date.now();
    
    this.saveBooks();
  },

  clearTranslationProgress() {
    if (!this.currentBook) return;
    this.currentBook.processedChunks = 0; 
    this.saveBooks();
  }
};

if (typeof window !== 'undefined') {
  window.State = State;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = State;
}
State.init();
