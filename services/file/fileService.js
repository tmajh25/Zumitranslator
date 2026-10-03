/**
 * File Service: Handles reading, writing, and OS dialogs for documents (TXT, DOCX, EPUB)
 * Built on Open/Closed Principle (OCP) via fileHandlerRegistry
 */

const fs = require('fs');
const path = require('path');
const { app, dialog, shell } = require('electron');
const epubService = require('./epubService');
const { fileHandlerRegistry } = require('./handlers');

function countWords(text) {
  if (!text || typeof text !== 'string') return 0;
  const cjkChars = (text.match(/[\u4e00-\u9fa5\u3040-\u30ff\u3400-\u4dbf]/g) || []).length;
  const nonCjkText = text.replace(/[\u4e00-\u9fa5\u3040-\u30ff\u3400-\u4dbf]/g, ' ').trim();
  const spacedWords = nonCjkText ? (nonCjkText.match(/\S+/gu) || []).length : 0;
  return cjkChars + spacedWords;
}

async function readFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  const handler = fileHandlerRegistry.get(ext);
  if (!handler || typeof handler.read !== 'function') {
    throw new Error(`Định dạng tệp "${ext}" không được hỗ trợ.`);
  }

  const { content = '', metadata = {}, cover = null, chapters = null } = await handler.read(filePath);

  let size = 0;
  try {
    size = fs.statSync(filePath).size;
  } catch (_) {}

  return {
    filePath,
    fileName,
    ext,
    size,
    content,
    metadata,
    cover,
    chapters,
    charCount: content.length,
    wordCount: countWords(content),
  };
}

async function handleOpenFile(browserWindow) {
  const result = await dialog.showOpenDialog(browserWindow, {
    title: 'Chọn file cần dịch',
    filters: fileHandlerRegistry.getAllFilters(),
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  return await readFile(result.filePaths[0]);
}

async function handleOpenFileByPath(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return await readFile(filePath);
  } catch (err) {
    console.error('Error reading file by path:', err);
    return null;
  }
}

async function handleSaveFile(browserWindow, { originalPath, ext, translatedContent, originalFileName, forceExt, chapters, metadata, cover }) {
  const targetExt = forceExt || ext || '.txt';
  const rawBaseName = (originalFileName && typeof originalFileName === 'string') ? originalFileName.replace(/\.[^/.]+$/, "") : 'document';
  const defaultName = `translated_${rawBaseName}${targetExt}`;
  
  const filter = fileHandlerRegistry.getFilter(targetExt);
  let defaultFolder = '';
  try {
    if (originalPath && typeof originalPath === 'string' && originalPath.trim()) {
      defaultFolder = path.dirname(originalPath);
    } else if (app && typeof app.getPath === 'function') {
      defaultFolder = app.getPath('documents');
    }
  } catch (_) {
    defaultFolder = '';
  }

  const result = await dialog.showSaveDialog(browserWindow, {
    title: 'Lưu file đã dịch',
    defaultPath: defaultFolder ? path.join(defaultFolder, defaultName) : defaultName,
    filters: [filter]
  });

  if (result.canceled) return false;

  const finalExt = path.extname(result.filePath).toLowerCase();
  const handler = fileHandlerRegistry.get(finalExt);
  if (handler && typeof handler.write === 'function') {
    await handler.write(result.filePath, translatedContent || '', {
      originalPath,
      chapters,
      metadata,
      cover
    });
  } else {
    fs.writeFileSync(result.filePath, translatedContent || '', 'utf-8');
  }

  return result.filePath;
}

async function handleSaveMultiTxt(browserWindow, { chapters, originalFileName }) {
  const result = await dialog.showOpenDialog(browserWindow, {
    title: 'Chọn thư mục để lưu các chương',
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) return false;

  const targetDir = result.filePaths[0];
  const rawBookName = (originalFileName && typeof originalFileName === 'string') ? originalFileName.replace(/\.[^/.]+$/, "") : 'book';
  const safeBookDir = rawBookName.replace(/[<>:"/\\|?*]/g, '_').trim() || 'book';
  const exportDir = path.join(targetDir, `ZumiExport_${safeBookDir}_${Date.now()}`);
  
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const chapterList = Array.isArray(chapters) ? chapters : [];
  for (let i = 0; i < chapterList.length; i++) {
    const ch = chapterList[i] || {};
    let safeTitle = (ch.title || `Chuong_${i + 1}`).replace(/[<>:"/\\|?*]/g, '_').trim().replace(/[. ]+$/, '').substring(0, 50) || `Chuong_${i + 1}`;
    if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(safeTitle)) {
      safeTitle = `_${safeTitle}`;
    }
    const fileName = `${(i + 1).toString().padStart(3, '0')}_${safeTitle}.txt`;
    fs.writeFileSync(path.join(exportDir, fileName), ch.content || '', 'utf-8');
  }

  shell.openPath(exportDir);
  return exportDir;
}

async function handleUpdateEpubMetadata(data) {
  const { filePath, metadata, coverBase64 } = data;
  return await epubService.updateEpubMetadata(filePath, metadata, coverBase64);
}

async function handleSelectCoverImage(browserWindow) {
  const result = await dialog.showOpenDialog(browserWindow, {
    title: 'Chọn ảnh bìa cho sách',
    filters: [
      { name: 'Image Files', extensions: ['jpg', 'jpeg', 'png', 'webp'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  const imagePath = result.filePaths[0];
  const buffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase().replace('.', '');
  const mime = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

function openFolder(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
  }
}

// Backward compatibility helper wrappers
async function readTxtFile(filePath) {
  const h = fileHandlerRegistry.get('.txt');
  const res = await h.read(filePath);
  return res.content;
}

async function readDocxFile(filePath) {
  const h = fileHandlerRegistry.get('.docx');
  const res = await h.read(filePath);
  return res.content;
}

async function writeDocxFile(filePath, content) {
  const h = fileHandlerRegistry.get('.docx');
  return await h.write(filePath, content);
}

async function handleOptimizeEpub(filePath, options = {}) {
  try {
    return await epubService.optimizeEpub(filePath, options);
  } catch (err) {
    console.error('[FileService] Lỗi tối ưu hóa EPUB:', err);
    return { success: false, error: err.message || String(err) };
  }
}

module.exports = {
  readFile,
  readTxtFile,
  readDocxFile,
  writeDocxFile,
  handleOpenFile,
  handleOpenFileByPath,
  handleSaveFile,
  handleSaveMultiTxt,
  handleUpdateEpubMetadata,
  handleSelectCoverImage,
  handleOptimizeEpub,
  openFolder,
  countWords,
  fileHandlerRegistry,
};
