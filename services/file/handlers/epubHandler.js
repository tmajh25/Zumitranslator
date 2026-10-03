/**
 * EPUB File Handler (OCP)
 * Reads and writes EPUB eBooks delegating to epubService
 */

const epubService = require('../epubService');

module.exports = {
  ext: '.epub',
  name: 'EPUB Files',

  async read(filePath) {
    return await epubService.readEpubFile(filePath);
  },

  async write(filePath, content, options = {}) {
    const { originalPath, chapters, metadata, cover } = options;
    await epubService.writeEpubFile(filePath, content, originalPath, chapters, metadata, cover);
  }
};
