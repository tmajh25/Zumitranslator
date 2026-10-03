/**
 * File Handler Registry (OCP / Strategy Pattern)
 * Central dispatcher for reading and writing different file formats
 */

const txtHandler = require('./txtHandler');
const docxHandler = require('./docxHandler');
const epubHandler = require('./epubHandler');

class FileHandlerRegistry {
  constructor() {
    this.handlers = new Map();
    this.registerDefaults();
  }

  registerDefaults() {
    this.register(txtHandler);
    this.register(docxHandler);
    this.register(epubHandler);
  }

  register(handler) {
    if (!handler || !handler.ext) return;
    const ext = handler.ext.toLowerCase();
    this.handlers.set(ext, handler);
  }

  get(ext) {
    if (!ext) return null;
    const normalizedExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
    return this.handlers.get(normalizedExt);
  }

  getSupportedExtensions() {
    return Array.from(this.handlers.keys()).map(e => e.replace('.', ''));
  }

  getFilter(ext) {
    const handler = this.get(ext);
    if (handler) {
      return { name: handler.name, extensions: [handler.ext.replace('.', '')] };
    }
    return { name: 'Files', extensions: [ext.replace('.', '')] };
  }

  getAllFilters() {
    const allSupported = {
      name: 'Supported Files',
      extensions: this.getSupportedExtensions()
    };
    const individualFilters = Array.from(this.handlers.values()).map(h => ({
      name: h.name,
      extensions: [h.ext.replace('.', '')]
    }));
    return [allSupported, ...individualFilters];
  }
}

const fileHandlerRegistry = new FileHandlerRegistry();

module.exports = {
  FileHandlerRegistry,
  fileHandlerRegistry,
};
