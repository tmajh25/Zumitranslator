/**
 * ZUMI TRANSLATOR - Main Orchestrator
 * Bootstraps application modules and initializes controllers
 */

function safeInit(name, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`[Init] Error initializing ${name}:`, err);
  }
}

function initApp() {
  // 1. Initialize Core UI & State
  safeInit('UI', () => UI.init());
  safeInit('State', () => State.init());

  // 2. Initialize Navigation first so sidebar always works
  safeInit('NavigationController', () => NavigationController.init());

  // 3. Initialize Settings & Views
  safeInit('Settings', () => Settings.init());
  if (window.Appearance) safeInit('Appearance', () => Appearance.init());
  if (window.ChapterWorkspace) safeInit('ChapterWorkspace', () => ChapterWorkspace.init());
  if (window.BookGlossary) safeInit('BookGlossary', () => BookGlossary.init());
  if (window.CharacterProfile) safeInit('CharacterProfile', () => CharacterProfile.init());
  if (window.TranslationWorkflow) safeInit('TranslationWorkflow', () => TranslationWorkflow.init());
  if (window.Bookshelf) safeInit('Bookshelf', () => {
    Bookshelf.init();
    Bookshelf.render();
  });

  // 4. Initialize Feature Controllers (SRP Architecture)
  safeInit('TextController', () => TextController.init());
  safeInit('BookshelfController', () => BookshelfController.init());
  safeInit('FileController', () => FileController.init());
  safeInit('SettingsController', () => SettingsController.init());
  safeInit('ModalController', () => ModalController.init());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
