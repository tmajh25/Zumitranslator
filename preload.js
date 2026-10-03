const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('open-file'),
  openFileByPath: (path) => ipcRenderer.invoke('open-file-by-path', path),
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  saveMultiTxt: (data) => ipcRenderer.invoke('save-multi-txt', data),
  translateText: async (data) => {
    const res = await ipcRenderer.invoke('translate-text', data);
    if (res && typeof res === 'object' && res.success === false) {
      throw new Error(res.error);
    }
    return (res && typeof res === 'object' && res.text !== undefined) ? res.text : res;
  },
  openFolder: (filePath) => ipcRenderer.send('open-folder', filePath),
  updateEpubMetadata: (data) => ipcRenderer.invoke('update-epub-metadata', data),
  selectCoverImage: () => ipcRenderer.invoke('select-cover-image'),
  setTitleBarOverlay: (options) => ipcRenderer.send('set-titlebar-overlay', options),
  getPartial: (name) => {
    try {
      return ipcRenderer.sendSync('get-partial-sync', name);
    } catch (err) {
      console.error('Error getting partial:', name, err);
      return '';
    }
  },
  saveBooksToDisk: (books) => ipcRenderer.invoke('save-books-to-disk', books),
  saveSingleBookToDisk: (book) => ipcRenderer.invoke('save-single-book-to-disk', book),
  deleteBookFromDisk: (idOrPath) => ipcRenderer.invoke('delete-book-from-disk', idOrPath),
  loadBooksFromDisk: () => ipcRenderer.invoke('load-books-from-disk'),
  saveConfigToDisk: (config) => ipcRenderer.invoke('save-config-to-disk', config),
  loadConfigFromDisk: () => ipcRenderer.invoke('load-config-from-disk'),
  cancelTranslation: () => ipcRenderer.send('cancel-translation'),
  optimizeEpub: (filePath, options) => ipcRenderer.invoke('optimize-epub', filePath, options)
});

