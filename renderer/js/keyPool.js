/**
 * KEY POOL MODULE (SRP)
 * Manages API keys, validation, rotation, and UI rendering for multiple API keys
 */

const KeyPool = {
  getKeyList(provider) {
    const p = provider || State.settings.apiProvider;
    if (!State.settings.providerConfigs) State.settings.providerConfigs = {};
    if (!State.settings.providerConfigs[p]) State.settings.providerConfigs[p] = {};
    const config = State.settings.providerConfigs[p];
    
    // Check if structured apiKeys array already exists (even if empty)
    if (Array.isArray(config.apiKeys)) {
      return config.apiKeys;
    }

    // Fallback: parse from existing string apiKey (first time / migration)
    const rawKey = config.apiKey || (State.settings.apiProvider === p ? State.settings.apiKey : '') || '';
    const rawList = rawKey.split(/[\r\n,;]+/).map(k => k.trim()).filter(Boolean);
    const keys = rawList.map(k => ({
      key: k,
      status: 'idle',
      statusMessage: 'Chưa kiểm tra'
    }));

    config.apiKeys = keys;
    return keys;
  },

  syncKeysToState(provider, explicitKeys) {
    const p = provider || State.settings.apiProvider;
    const keys = Array.isArray(explicitKeys) ? explicitKeys : this.getKeyList(p);
    const keyString = keys.map(k => k.key).join('\n');
    
    State.settings.apiKey = keyString;
    State.settings.apiKeys = keys;
    if (!State.settings.providerConfigs) State.settings.providerConfigs = {};
    if (!State.settings.providerConfigs[p]) State.settings.providerConfigs[p] = {};
    State.settings.providerConfigs[p].apiKey = keyString;
    State.settings.providerConfigs[p].apiKeys = keys;
    
    State.saveSettings({ apiKey: keyString, apiKeys: keys });

    const hiddenInput = UI.$('#apiKeyInput');
    if (hiddenInput) hiddenInput.value = keyString;
  },

  renderKeyPool(provider) {
    const p = provider || State.settings.apiProvider;
    const container = UI.$('#keyPoolList');
    const badge = UI.$('#keyCountBadge');
    if (!container) return;

    const keys = this.getKeyList(p);
    if (badge) {
      badge.textContent = `${keys.length} key${keys.length > 1 ? 's' : ''}`;
    }

    if (keys.length === 0) {
      container.innerHTML = `
        <div class="key-empty-notice">
          Chưa có API Key nào. Vui lòng dán Key vào ô bên trên và bấm <strong>+ Thêm Key</strong>.
        </div>
      `;
      return;
    }

    container.innerHTML = keys.map((item, idx) => {
      const isShort = item.key.length < 10;
      const masked = isShort ? '••••••••' : `${item.key.slice(0, 6)}••••••••${item.key.slice(-4)}`;
      const statusClass = item.status || 'idle';
      const statusText = item.statusMessage || (item.status === 'valid' ? 'Hoạt động 🟢' : 'Chưa kiểm tra');

      return `
        <div class="key-item-row" data-index="${idx}">
          <div class="key-item-main">
            <div class="key-item-header">
              <span class="key-index-tag">Key ${idx + 1}</span>
              <span class="key-status-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="key-masked-display">
              <span class="key-text" data-raw="${item.key}" data-revealed="false">${masked}</span>
            </div>
          </div>
          <div class="key-item-actions">
            <button class="btn-action-text toggle-visibility-btn" data-index="${idx}" title="Hiện hoặc ẩn Key">Hiện</button>
            <button class="btn-action-text test-btn" data-index="${idx}" title="Kiểm tra kết nối và Rate Limit">Test</button>
            <button class="btn-action-text delete-btn" data-index="${idx}" title="Xóa Key này">Xóa</button>
          </div>
        </div>
      `;
    }).join('');
  },

  addKey(rawInput) {
    if (!rawInput || !rawInput.trim()) {
      Utils.showToast('Vui lòng nhập hoặc dán API Key!', 'warning');
      return;
    }

    const p = State.settings.apiProvider;
    const existingKeys = this.getKeyList(p);
    const newKeyStrings = rawInput
      .split(/[\r\n,;]+/)
      .map(k => k.trim())
      .filter(Boolean);

    if (newKeyStrings.length === 0) {
      Utils.showToast('Không tìm thấy API Key hợp lệ trong nội dung vừa nhập!', 'warning');
      return;
    }

    let addedCount = 0;
    newKeyStrings.forEach(k => {
      const alreadyExists = existingKeys.some(item => item.key === k);
      if (!alreadyExists) {
        existingKeys.push({
          key: k,
          status: 'idle',
          statusMessage: 'Chưa kiểm tra'
        });
        addedCount++;
      }
    });

    this.syncKeysToState(p, existingKeys);
    this.renderKeyPool(p);

    if (addedCount > 0) {
      Utils.showToast(`Đã thêm ${addedCount} Key mới vào danh sách!`, 'success');
      const input = UI.$('#newApiKeyInput');
      if (input) input.value = '';
    } else {
      Utils.showToast('Các Key vừa nhập đã có sẵn trong danh sách!', 'info');
    }
  },

  removeKey(index) {
    const p = State.settings.apiProvider;
    const keys = this.getKeyList(p);
    const idx = parseInt(index);
    if (!isNaN(idx) && idx >= 0 && idx < keys.length) {
      keys.splice(idx, 1);
      this.syncKeysToState(p, keys);
      this.renderKeyPool(p);
      Utils.showToast('Đã xóa Key khỏi danh sách.', 'info');
    }
  },

  async testKey(index) {
    const p = State.settings.apiProvider;
    const keys = this.getKeyList(p);
    const item = keys[index];
    if (!item) return;

    item.status = 'testing';
    item.statusMessage = 'Đang kiểm tra...';
    this.renderKeyPool(p);

    try {
      const provCfg = (State.getProviderConfig && State.getProviderConfig(p)) || (State.settings.providerConfigs && State.settings.providerConfigs[p]) || {};
      const testModel = provCfg.model || State.settings.model;
      await window.electronAPI.translateText({
        text: 'Hello',
        sourceLang: 'en',
        targetLang: 'vi',
        apiProvider: p,
        apiKey: item.key,
        model: testModel
      });
      item.status = 'valid';
      item.statusMessage = 'Hoạt động tốt 🟢';
      Utils.showToast(`Key ${index + 1}: Hoạt động tốt!`, 'success');
    } catch (err) {
      let rawMsg = (err && err.message) ? err.message : String(err);
      const cleanMsg = rawMsg
        .replace(/^Error:\s*/i, '')
        .replace(/Error invoking remote method ['"][^'"]+['"]:\s*/i, '')
        .replace(/^Error:\s*/i, '')
        .trim();

      const lower = cleanMsg.toLowerCase();
      if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota') || lower.includes('rate limit')) {
        item.status = 'rate_limited';
        item.statusMessage = 'Chạm Rate Limit (429) 🟡';
        Utils.showToast(`Key ${index + 1}: Bị giới hạn Rate Limit 429!`, 'warning');
      } else if (lower.includes('401') || lower.includes('403') || lower.includes('api_key_invalid') || lower.includes('invalid_api_key') || lower.includes('api key not valid') || lower.includes('không hợp lệ') || lower.includes('hết hạn')) {
        item.status = 'invalid';
        item.statusMessage = 'Key không hợp lệ / hết hạn 🔴';
        Utils.showToast(`Key ${index + 1}: Key không hợp lệ hoặc hết hạn!`, 'error');
      } else if (lower.includes('not found') || lower.includes('not_found') || lower.includes('không tồn tại')) {
        item.status = 'error';
        item.statusMessage = 'Model không tồn tại ⚠️';
        Utils.showToast(`Key ${index + 1}: Model không tồn tại trên API!`, 'error');
      } else {
        item.status = 'error';
        item.statusMessage = cleanMsg.slice(0, 30) || 'Lỗi kết nối ⚠️';
        Utils.showToast(`Key ${index + 1}: ${cleanMsg.slice(0, 80)}`, 'error');
      }
    } finally {
      this.syncKeysToState(p, keys);
      this.renderKeyPool(p);
    }
  },

  async testAllKeys() {
    const p = State.settings.apiProvider;
    const keys = this.getKeyList(p);
    if (keys.length === 0) {
      Utils.showToast('Chưa có Key nào trong danh sách để kiểm tra!', 'warning');
      return;
    }

    const testAllBtn = UI.$('#testAllKeysBtn');
    if (testAllBtn) {
      testAllBtn.disabled = true;
      testAllBtn.textContent = 'Đang test...';
    }

    Utils.showToast(`Bắt đầu kiểm tra ${keys.length} API Key...`, 'info');

    let validCount = 0;
    let rateLimitCount = 0;
    let invalidCount = 0;

    for (let i = 0; i < keys.length; i++) {
      await this.testKey(i);
      if (keys[i].status === 'valid') validCount++;
      else if (keys[i].status === 'rate_limited') rateLimitCount++;
      else invalidCount++;
    }

    if (testAllBtn) {
      testAllBtn.disabled = false;
      testAllBtn.textContent = 'Kiểm tra Rate Limit';
    }

    Utils.showToast(`Kiểm tra xong: ${validCount} hoạt động, ${rateLimitCount} rate limit, ${invalidCount} lỗi.`, 'info');
  }
};

window.KeyPool = KeyPool;
