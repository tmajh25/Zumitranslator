/**
 * Config Storage Service (Single Responsibility: Persistent Settings Storage)
 * Persists all API keys, Key Pool, models, prompts, fallback chains, and appearance
 * directly into a clean, human-readable JSON file:
 *   userData/config.json
 */

const fs = require('fs');
const path = require('path');

class ConfigStorage {
  constructor() {
    this.userDataDir = null;
    this.configFilePath = null;
    this.isInitialized = false;
  }

  /**
   * Initialize directory paths
   * @param {string} userDataPath 
   */
  init(userDataPath) {
    if (this.isInitialized && this.userDataDir === userDataPath) return;

    this.userDataDir = userDataPath;
    this.configFilePath = path.join(this.userDataDir, 'config.json');

    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    }

    this.isInitialized = true;
  }

  /**
   * Load configuration from config.json
   * @returns {Promise<object|null>}
   */
  async loadConfig() {
    try {
      if (!this.configFilePath || !fs.existsSync(this.configFilePath)) {
        return null;
      }

      const raw = await fs.promises.readFile(this.configFilePath, 'utf8');
      if (!raw || !raw.trim()) return null;

      const config = JSON.parse(raw);
      return config && typeof config === 'object' ? config : null;
    } catch (err) {
      console.error('[ConfigStorage] Lỗi khi đọc config.json:', err);
      // Attempt recovery from backup if available
      try {
        const bakPath = `${this.configFilePath}.bak`;
        if (fs.existsSync(bakPath)) {
          const bakRaw = await fs.promises.readFile(bakPath, 'utf8');
          return JSON.parse(bakRaw);
        }
      } catch (_) {}
      return null;
    }
  }

  /**
   * Save configuration to config.json atomically
   * @param {object} config 
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async saveConfig(config) {
    if (!config || typeof config !== 'object') {
      return { success: false, error: 'Config must be an object' };
    }

    if (!this.configFilePath) {
      return { success: false, error: 'ConfigStorage not initialized' };
    }

    const tempPath = `${this.configFilePath}.tmp_${Date.now()}`;
    try {
      const data = JSON.stringify(config, null, 2);
      await fs.promises.writeFile(tempPath, data, 'utf8');

      // Create backup of existing config before replacing
      if (fs.existsSync(this.configFilePath)) {
        try {
          await fs.promises.copyFile(this.configFilePath, `${this.configFilePath}.bak`);
        } catch (_) {}
      }

      await fs.promises.rename(tempPath, this.configFilePath);
      return { success: true };
    } catch (err) {
      console.error('[ConfigStorage] Lỗi khi lưu config.json:', err);
      try {
        if (fs.existsSync(tempPath)) await fs.promises.unlink(tempPath);
      } catch (_) {}
      return { success: false, error: err.message };
    }
  }
}

module.exports = new ConfigStorage();
