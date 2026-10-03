/**
 * APPEARANCE & THEME MODULE
 * Manages dark/light/system theme, accent colors, typography,
 * corner radius, and layout customization.
 */

const Appearance = {
  defaults: {
    theme: 'light',
    accent: 'indigo',
    font: 'system',
    fontSize: 'medium',
    radius: 'subtle',
    reduceMotion: false,
    compactMode: false
  },

  current: {},

  init() {
    // Load saved appearance
    this.load();

    // Apply immediately to avoid any flash of unstyled theme
    this.applyAll();

    // Bind event listeners once DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.bindUI());
    } else {
      this.bindUI();
    }

    // Listen to OS system theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.current.theme === 'system') {
          this.applyTheme('system');
        }
      });
    }
  },

  load() {
    let saved = null;
    try {
      const raw = localStorage.getItem('zumi_appearance');
      if (raw) saved = JSON.parse(raw);
    } catch (e) {
      // ignore
    }

    if (!saved && typeof State !== 'undefined' && State.settings?.appearance) {
      saved = State.settings.appearance;
    }

    this.current = Object.assign({}, this.defaults, saved || {});
  },

  save() {
    try {
      localStorage.setItem('zumi_appearance', JSON.stringify(this.current));
      if (typeof State !== 'undefined' && State.saveSettings) {
        State.saveSettings({ appearance: this.current });
      }
    } catch (e) {
      console.warn('Failed to save appearance settings:', e);
    }
  },

  applyAll() {
    this.applyTheme(this.current.theme);
    this.applyAccent(this.current.accent);
    this.applyFont(this.current.font);
    this.applyFontSize(this.current.fontSize);
    this.applyRadius(this.current.radius);
    this.applyReduceMotion(this.current.reduceMotion);
    this.applyCompactMode(this.current.compactMode);
  },

  applyTheme(theme) {
    this.current.theme = theme || 'light';
    const root = document.documentElement;

    let effectiveTheme = this.current.theme;
    if (this.current.theme === 'system') {
      const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveTheme = isDark ? 'dark' : 'light';
    }
    root.setAttribute('data-theme', effectiveTheme);

    // Sync window controls / titleBarOverlay color
    if (window.electronAPI && typeof window.electronAPI.setTitleBarOverlay === 'function') {
      if (effectiveTheme === 'dark') {
        window.electronAPI.setTitleBarOverlay({
          color: '#09090b',
          symbolColor: '#fafafa',
          height: 40
        });
      } else {
        window.electronAPI.setTitleBarOverlay({
          color: '#ffffff',
          symbolColor: '#18181b',
          height: 40
        });
      }
    }
  },

  applyAccent(accent) {
    this.current.accent = accent || 'indigo';
    document.documentElement.setAttribute('data-accent', this.current.accent);
  },

  applyFont(font) {
    this.current.font = font || 'system';
    document.documentElement.setAttribute('data-font', this.current.font);
  },

  applyFontSize(size) {
    this.current.fontSize = size || 'medium';
    document.documentElement.setAttribute('data-size', this.current.fontSize);
  },

  applyRadius(radius) {
    this.current.radius = radius || 'subtle';
    document.documentElement.setAttribute('data-radius', this.current.radius);
  },

  applyReduceMotion(reduce) {
    this.current.reduceMotion = !!reduce;
    document.documentElement.setAttribute('data-reduce-motion', this.current.reduceMotion ? 'true' : 'false');
  },

  applyCompactMode(compact) {
    this.current.compactMode = !!compact;
    document.documentElement.setAttribute('data-compact', this.current.compactMode ? 'true' : 'false');
  },

  bindUI() {
    // 1. Theme picker cards
    const themeCards = document.querySelectorAll('.theme-option-card');
    themeCards.forEach(card => {
      const themeVal = card.dataset.theme;
      const radio = card.querySelector('input[type="radio"]');

      if (themeVal === this.current.theme) {
        card.classList.add('active');
        if (radio) radio.checked = true;
      } else {
        card.classList.remove('active');
        if (radio) radio.checked = false;
      }

      card.addEventListener('click', () => {
        themeCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        if (radio) radio.checked = true;
        this.applyTheme(themeVal);
        this.save();
      });
    });

    // 2. Accent color buttons
    const accentBtns = document.querySelectorAll('.accent-color-btn');
    accentBtns.forEach(btn => {
      const colorVal = btn.dataset.color;

      if (colorVal === this.current.accent) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }

      btn.addEventListener('click', () => {
        accentBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.applyAccent(colorVal);
        this.save();
      });
    });

    // 3. Radius option cards
    const radiusCards = document.querySelectorAll('.radius-option-card');
    radiusCards.forEach(card => {
      const radiusVal = card.dataset.radius;
      const radio = card.querySelector('input[type="radio"]');

      if (radiusVal === this.current.radius) {
        card.classList.add('active');
        if (radio) radio.checked = true;
      } else {
        card.classList.remove('active');
        if (radio) radio.checked = false;
      }

      card.addEventListener('click', () => {
        radiusCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        if (radio) radio.checked = true;
        this.applyRadius(radiusVal);
        this.save();
      });
    });

    // 4. Font select dropdown
    const fontSelect = document.getElementById('uiFontSelect');
    if (fontSelect) {
      fontSelect.value = this.current.font;
      fontSelect.addEventListener('change', (e) => {
        this.applyFont(e.target.value);
        this.save();
        this.updateSamplePreview();
      });
    }

    // 5. Font size select dropdown
    const fontSizeSelect = document.getElementById('uiFontSizeSelect');
    if (fontSizeSelect) {
      fontSizeSelect.value = this.current.fontSize;
      fontSizeSelect.addEventListener('change', (e) => {
        this.applyFontSize(e.target.value);
        this.save();
        this.updateSamplePreview();
      });
    }

    // 6. Reduce motion checkbox
    const reduceMotionCheck = document.getElementById('uiReduceMotion');
    if (reduceMotionCheck) {
      reduceMotionCheck.checked = this.current.reduceMotion;
      reduceMotionCheck.addEventListener('change', (e) => {
        this.applyReduceMotion(e.target.checked);
        this.save();
      });
    }

    // 7. Compact mode checkbox
    const compactModeCheck = document.getElementById('uiCompactMode');
    if (compactModeCheck) {
      compactModeCheck.checked = this.current.compactMode;
      compactModeCheck.addEventListener('change', (e) => {
        this.applyCompactMode(e.target.checked);
        this.save();
      });
    }

    // 8. Settings navigation tabs (switch between AI Config, Translation Config and UI Settings)
    const tabBtns = document.querySelectorAll('.settings-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const subtab = btn.dataset.subtab;
        const targetPanel = btn.dataset.targetPanel;
        if (subtab && typeof UI !== 'undefined') {
          UI.showPanel('settings');
          UI.showSettingsSubtab(subtab);
        } else if (targetPanel && typeof UI !== 'undefined' && UI.showPanel) {
          UI.showPanel(targetPanel);
        }
      });
    });

    this.updateSamplePreview();
  },

  updateSamplePreview() {
    const preview = document.getElementById('fontPreviewSample');
    if (preview) {
      // Ensure preview text updates smoothly
      const fontName = {
        system: 'Inter (Hệ thống)',
        bevietnam: 'Be Vietnam Pro',
        serif: 'Merriweather (Serif cổ điển)',
        mono: 'Fira Code (Monospace)'
      }[this.current.font] || this.current.font;

      const sizeLabel = {
        small: '13px (Nhỏ)',
        medium: '14px (Tiêu chuẩn)',
        large: '16px (Lớn)',
        xlarge: '18px (Rất lớn)'
      }[this.current.fontSize] || this.current.fontSize;

      const previewDesc = document.getElementById('fontPreviewDesc');
      if (previewDesc) {
        previewDesc.textContent = `Đang dùng: ${fontName} • Cỡ chữ: ${sizeLabel}`;
      }
    }
  }
};

// Immediate initialization on script load
Appearance.init();

if (typeof window !== 'undefined') {
  window.Appearance = Appearance;
}
