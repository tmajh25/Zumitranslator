/**
 * UI MODULE
 * Simple DOM wrapper and UI state controllers
 */

const UI = {
  // Selectors
  $: (sel) => document.querySelector(sel),
  $$: (sel) => document.querySelectorAll(sel),

  // Initialize common elements
  elements: {},

  init() {
    // Navigation
    this.elements.navItems = this.$$('.nav-item');
    this.elements.panels = this.$$('.panel');

    // Text Translation
    this.elements.sourceText = this.$('#sourceText');
    this.elements.targetText = this.$('#targetText');
    this.elements.translateTextBtn = this.$('#translateTextBtn');
    this.elements.sourceCharCount = this.$('#sourceCharCount');
    this.elements.targetCharCount = this.$('#targetCharCount');

    // File Translation
    this.elements.fileDropZone = this.$('#fileDropZone');
    this.elements.dropContent = this.$('#dropContent');
    this.elements.fileInfo = this.$('#fileInfo');
    this.elements.fileName = this.$('#fileName');
    this.elements.fileType = this.$('#fileType');
    this.elements.fileCharCount = this.$('#fileCharCount');
    this.elements.translateFileBtn = this.$('#translateFileBtn');
    this.elements.cancelTranslation = this.$('#cancelTranslation');
    this.elements.saveFileBtn = this.$('#saveFileBtn');
    this.elements.progressSection = this.$('#progressSection');
    this.elements.progressBar = this.$('#progressBar');
    this.elements.progressLabel = this.$('#progressLabel');
    this.elements.previewSection = this.$('#previewSection');
    this.elements.previewContent = this.$('#previewContent');
    this.elements.bookshelfGrid = this.$('#bookshelfGrid');
    this.elements.bookDetailView = this.$('#bookDetailView');

    // Settings
    this.elements.apiProviderCards = this.$$('.api-provider-grid .provider-card');
    this.elements.apiKeyInput = this.$('#apiKeyInput');
    this.elements.modelSelect = this.$('#modelSelect');
    this.elements.saveSettingsBtn = this.$('#saveSettings');

    // Modals
    this.elements.exportModal = this.$('#exportModal');
    this.elements.confirmExportBtn = this.$('#confirmExportBtn');
  },

  showPanel(panelId) {
    this.elements.navItems.forEach(n => {
      const isActive = n.dataset.panel === panelId || (panelId === 'appearance' && n.dataset.panel === 'settings');
      n.classList.toggle('active', isActive);
    });
    this.elements.panels.forEach(p => {
      p.classList.toggle('active', p.id === `panel-${panelId}`);
    });
    
    if (panelId === 'file') {
      if (window.Bookshelf && typeof Bookshelf.render === 'function') {
        Bookshelf.render();
      }
    } else if (panelId === 'appearance') {
      this.$$('.settings-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.targetPanel === 'appearance');
      });
    } else if (panelId === 'settings') {
      const activeSubtab = localStorage.getItem('active_settings_subtab') || 'ai';
      this.showSettingsSubtab(activeSubtab);
    } else {
      this.$$('.settings-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.targetPanel === panelId);
      });
    }
  },

  showSettingsSubtab(subtabId) {
    const subtab = subtabId === 'translation' ? 'translation' : 'ai';
    try {
      localStorage.setItem('active_settings_subtab', subtab);
    } catch (e) {}

    const paneAI = this.$('#settingsPaneAI');
    const paneTranslation = this.$('#settingsPaneTranslation');
    if (paneAI && paneTranslation) {
      if (subtab === 'ai') {
        paneAI.classList.remove('hidden');
        paneTranslation.classList.add('hidden');
      } else {
        paneAI.classList.add('hidden');
        paneTranslation.classList.remove('hidden');
      }
    }

    this.$$('.settings-tab-btn').forEach(btn => {
      if (btn.dataset.subtab) {
        btn.classList.toggle('active', btn.dataset.subtab === subtab);
      } else if (btn.dataset.targetPanel) {
        btn.classList.remove('active');
      }
    });

    if (subtab === 'translation' && typeof Settings !== 'undefined' && Settings.renderFallbackUI) {
      Settings.renderFallbackUI();
    }
  },

  updateButtonLoading(btn, isLoading, originalText) {
    if (isLoading) {
      btn.classList.add('loading');
      btn.disabled = true;
    } else {
      btn.classList.remove('loading');
      btn.disabled = false;
      if (originalText) {
        const span = btn.querySelector('span');
        if (span) span.textContent = originalText;
      }
    }
  },

  toggleHidden(el, isHidden) {
    if (!el) return;
    if (isHidden) el.classList.add('hidden');
    else el.classList.remove('hidden');
  }
};

window.UI = UI;
