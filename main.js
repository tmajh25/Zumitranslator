const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Giữ nguyên đường dẫn userData tới 'zumitrans' để bảo toàn toàn bộ dữ liệu sách và cài đặt cũ
try {
  const targetUserData = path.join(app.getPath('appData'), 'zumitrans');
  app.setPath('userData', targetUserData);
} catch (e) {
  console.warn('Could not set custom userData path:', e);
}

const fileService = require('./services/file/fileService');
const { translatorRegistry } = require('./services/translators');
const bookStorage = require('./services/file/bookStorage');
const configStorage = require('./services/file/configStorage');

// Khởi tạo hệ thống lưu trữ sách phân tách theo file và cấu hình độc lập
try {
  const userDataDir = app.getPath('userData');
  bookStorage.init(userDataDir);
  configStorage.init(userDataDir);
} catch (err) {
  console.error('[Main] Lỗi khởi tạo storage:', err);
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'assets', 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#09090b',
      symbolColor: '#fafafa',
      height: 40
    },
    backgroundColor: '#09090b',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      mainWindow.webContents.reload();
      event.preventDefault();
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    process.exit(0);
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ============ FILE IPC HANDLERS ============

ipcMain.handle('open-file', async () => {
  return await fileService.handleOpenFile(mainWindow);
});

ipcMain.handle('open-file-by-path', async (event, filePath) => {
  return await fileService.handleOpenFileByPath(filePath);
});

ipcMain.handle('save-file', async (event, params) => {
  return await fileService.handleSaveFile(mainWindow, params);
});

ipcMain.handle('save-multi-txt', async (event, params) => {
  return await fileService.handleSaveMultiTxt(mainWindow, params);
});

ipcMain.handle('update-epub-metadata', async (event, data) => {
  return await fileService.handleUpdateEpubMetadata(data);
});

ipcMain.handle('select-cover-image', async () => {
  return await fileService.handleSelectCoverImage(mainWindow);
});

ipcMain.on('open-folder', (event, filePath) => {
  fileService.openFolder(filePath);
});

// ============ TRANSLATION IPC HANDLER ============

const activeTranslationControllers = new Set();

ipcMain.on('cancel-translation', () => {
  for (const controller of activeTranslationControllers) {
    try {
      controller.abort();
    } catch (_) {}
  }
  activeTranslationControllers.clear();
});

ipcMain.handle('translate-text', async (event, params) => {
  const controller = new AbortController();
  activeTranslationControllers.add(controller);
  try {
    const text = await translatorRegistry.translate({
      ...params,
      abortSignal: controller.signal
    });
    return { success: true, text };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  } finally {
    activeTranslationControllers.delete(controller);
  }
});

ipcMain.handle('optimize-epub', async (event, filePath, options) => {
  return await fileService.handleOptimizeEpub(filePath, options);
});

// ============ PARTIALS IPC HANDLER ============
ipcMain.on('get-partial-sync', (event, name) => {
  try {
    const p = path.join(__dirname, 'renderer', 'partials', name);
    if (fs.existsSync(p)) {
      event.returnValue = fs.readFileSync(p, 'utf8');
      return;
    }
    console.warn('Partial not found:', p);
  } catch (err) {
    console.error('Error reading partial:', name, err);
  }
  event.returnValue = '';
});

// ============ TITLEBAR OVERLAY IPC HANDLER ============
ipcMain.on('set-titlebar-overlay', (event, options) => {
  if (mainWindow && typeof mainWindow.setTitleBarOverlay === 'function') {
    try {
      mainWindow.setTitleBarOverlay(options);
    } catch (err) {
      console.warn('Failed to set title bar overlay:', err);
    }
  }
});

// ============ PERSISTENT BOOK DATA STORAGE ============
ipcMain.handle('save-books-to-disk', async (event, books) => {
  return await bookStorage.saveAllBooks(books);
});

ipcMain.handle('save-single-book-to-disk', async (event, book) => {
  return await bookStorage.saveSingleBook(book);
});

ipcMain.handle('delete-book-from-disk', async (event, idOrPath) => {
  return await bookStorage.deleteBook(idOrPath);
});

ipcMain.handle('load-books-from-disk', async () => {
  try {
    const books = await bookStorage.loadAllBooks();
    return { success: true, books };
  } catch (err) {
    console.error('[Main] Lỗi đọc sách từ đĩa:', err);
    return { success: false, error: err.message, books: null };
  }
});

// ============ PERSISTENT CONFIG STORAGE ============
ipcMain.handle('save-config-to-disk', async (event, config) => {
  return await configStorage.saveConfig(config);
});

ipcMain.handle('load-config-from-disk', async () => {
  try {
    const config = await configStorage.loadConfig();
    return { success: true, config };
  } catch (err) {
    console.error('[Main] Lỗi đọc config từ đĩa:', err);
    return { success: false, error: err.message, config: null };
  }
});


