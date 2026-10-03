/**
 * Book Storage Service (Single Responsibility: Persistent Book Data Storage)
 * Replaces monolithic 40MB+ zumi_books.json with isolated per-book storage
 * Structure:
 *   userData/
 *     ├── books_index.json    # Lightweight metadata index of all books
 *     └── books/              # Isolated JSON file per book
 *         ├── <bookId_1>.json
 *         └── <bookId_2>.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class BookStorage {
  constructor() {
    this.userDataDir = null;
    this.booksDir = null;
    this.indexFilePath = null;
    this.legacyFilePath = null;
    this.isInitialized = false;
  }

  /**
   * Initialize directory paths and run migration if needed
   * @param {string} userDataPath 
   */
  init(userDataPath) {
    if (this.isInitialized && this.userDataDir === userDataPath) return;

    this.userDataDir = userDataPath;
    this.booksDir = path.join(this.userDataDir, 'books');
    this.indexFilePath = path.join(this.userDataDir, 'books_index.json');
    this.legacyFilePath = path.join(this.userDataDir, 'zumi_books.json');

    if (!fs.existsSync(this.booksDir)) {
      fs.mkdirSync(this.booksDir, { recursive: true });
    }

    this.migrateLegacyFileIfNeeded();
    this.isInitialized = true;
  }

  /**
   * Deterministic unique ID for a book record
   * @param {object} book 
   * @returns {string} 16-char hex ID
   */
  getBookId(book) {
    if (book && book.id && typeof book.id === 'string' && book.id.length >= 8) {
      return book.id;
    }
    const seed = (book && (book.filePath || book.title)) || String(Date.now());
    return crypto.createHash('md5').update(seed).digest('hex').slice(0, 16);
  }

  /**
   * Migrate existing monolithic zumi_books.json into books/ folder
   */
  migrateLegacyFileIfNeeded() {
    try {
      if (!fs.existsSync(this.legacyFilePath)) return;

      const existingBookFiles = fs.readdirSync(this.booksDir).filter(f => f.endsWith('.json'));
      if (existingBookFiles.length > 0) {
        return; // Already migrated
      }

      console.log('[BookStorage] Phát hiện tệp dữ liệu nguyên khối zumi_books.json cũ. Đang tự động tách thành từng file riêng...');
      const raw = fs.readFileSync(this.legacyFilePath, 'utf8');
      const books = JSON.parse(raw);

      if (!Array.isArray(books) || books.length === 0) return;

      // 1. Create a safe backup of zumi_books.json
      const backupPath = `${this.legacyFilePath}.bak`;
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(this.legacyFilePath, backupPath);
      }

      // 2. Save each book individually
      const index = [];
      for (const book of books) {
        book.id = this.getBookId(book);
        const bookFilePath = path.join(this.booksDir, `${book.id}.json`);
        fs.writeFileSync(bookFilePath, JSON.stringify(book), 'utf8');

        index.push(this.createIndexEntry(book));
      }

      // 3. Write index file
      fs.writeFileSync(this.indexFilePath, JSON.stringify(index, null, 2), 'utf8');
      console.log(`[BookStorage] Đã nâng cấp và phân tách thành công ${books.length} cuốn sách vào thư mục books/!`);
    } catch (err) {
      console.error('[BookStorage] Lỗi khi di chuyển dữ liệu cũ:', err);
    }
  }

  /**
   * Create lightweight metadata entry for books_index.json
   */
  createIndexEntry(book) {
    return {
      id: book.id,
      title: book.title || 'Không có tiêu đề',
      author: book.author || 'Chưa rõ tác giả',
      filePath: book.filePath || '',
      fileName: book.fileName || '',
      ext: book.ext || '',
      language: book.language || '',
      charCount: book.charCount || 0,
      wordCount: book.wordCount || 0,
      totalChapters: (book.chapters && book.chapters.length) || (book.totalChunks || 0),
      translatedChapters: (book.finishedChapters && book.finishedChapters.length) || (book.processedChunks || 0),
      lastAccessed: book.lastAccessed || Date.now(),
      bookFile: `${book.id}.json`
    };
  }

  /**
   * Load all books from isolated files (preserves index order)
   * @returns {Promise<Array>} Complete books array
   */
  async loadAllBooks() {
    try {
      if (!fs.existsSync(this.booksDir)) {
        return [];
      }

      // 1. Determine book files ordering from books_index.json
      let orderedFiles = [];
      if (fs.existsSync(this.indexFilePath)) {
        try {
          const rawIndex = await fs.promises.readFile(this.indexFilePath, 'utf8');
          const index = JSON.parse(rawIndex);
          if (Array.isArray(index)) {
            orderedFiles = index.map(item => item.bookFile || `${item.id}.json`);
          }
        } catch (_) {}
      }

      const dirFiles = (await fs.promises.readdir(this.booksDir)).filter(f => f.endsWith('.json'));
      const allFilesSet = new Set(dirFiles);
      const finalFiles = [];

      for (const f of orderedFiles) {
        if (allFilesSet.has(f)) {
          finalFiles.push(f);
          allFilesSet.delete(f);
        }
      }
      for (const f of allFilesSet) {
        finalFiles.push(f);
      }

      if (finalFiles.length === 0) {
        // Fallback to legacy file if booksDir is empty
        if (fs.existsSync(this.legacyFilePath)) {
          const raw = await fs.promises.readFile(this.legacyFilePath, 'utf8');
          const data = JSON.parse(raw);
          if (Array.isArray(data)) return data;
        }
        return [];
      }

      const books = [];
      for (const f of finalFiles) {
        try {
          const filePath = path.join(this.booksDir, f);
          const raw = await fs.promises.readFile(filePath, 'utf8');
          const book = JSON.parse(raw);
          if (book) {
            if (!book.id) book.id = this.getBookId(book);
            books.push(book);
          }
        } catch (err) {
          console.error(`[BookStorage] Lỗi khi đọc tệp sách ${f}:`, err);
        }
      }

      return books;
    } catch (err) {
      console.error('[BookStorage] Lỗi loadAllBooks:', err);
      return [];
    }
  }

  /**
   * Atomically save a single book into its own file
   * @param {object} book 
   */
  async saveSingleBook(book) {
    if (!book) return { success: false, error: 'No book provided' };
    const bookId = this.getBookId(book);
    book.id = bookId;

    const bookFilePath = path.join(this.booksDir, `${bookId}.json`);
    const tempPath = `${bookFilePath}.tmp_${Date.now()}`;

    try {
      await fs.promises.writeFile(tempPath, JSON.stringify(book), 'utf8');
      await fs.promises.rename(tempPath, bookFilePath);

      // Update index asynchronously
      this.updateIndexForBook(book).catch(err => {
        console.warn('[BookStorage] Lỗi cập nhật books_index.json:', err);
      });

      return { success: true, id: bookId };
    } catch (err) {
      console.error(`[BookStorage] Lỗi lưu sách ${book.title}:`, err);
      try {
        if (fs.existsSync(tempPath)) await fs.promises.unlink(tempPath);
      } catch (_) {}
      return { success: false, error: err.message };
    }
  }

  /**
   * Save all books (with automatic diffing to delete removed books)
   * @param {Array} books 
   */
  async saveAllBooks(books) {
    if (!Array.isArray(books)) {
      return { success: false, error: 'Books must be an array' };
    }

    try {
      const activeBookIds = new Set();
      const index = [];

      for (const book of books) {
        const bookId = this.getBookId(book);
        book.id = bookId;
        activeBookIds.add(bookId);

        const bookFilePath = path.join(this.booksDir, `${bookId}.json`);
        const tempPath = `${bookFilePath}.tmp_${Date.now()}`;

        await fs.promises.writeFile(tempPath, JSON.stringify(book), 'utf8');
        await fs.promises.rename(tempPath, bookFilePath);

        index.push(this.createIndexEntry(book));
      }

      // Cleanup files for deleted books
      const currentFiles = await fs.promises.readdir(this.booksDir);
      for (const file of currentFiles) {
        if (file.endsWith('.json')) {
          const fileId = file.replace('.json', '');
          if (!activeBookIds.has(fileId)) {
            try {
              await fs.promises.unlink(path.join(this.booksDir, file));
              console.log(`[BookStorage] Đã xóa tệp sách cũ: ${file}`);
            } catch (_) {}
          }
        }
      }

      // Update index file
      const indexTemp = `${this.indexFilePath}.tmp_${Date.now()}`;
      await fs.promises.writeFile(indexTemp, JSON.stringify(index, null, 2), 'utf8');
      await fs.promises.rename(indexTemp, this.indexFilePath);

      return { success: true };
    } catch (err) {
      console.error('[BookStorage] Lỗi saveAllBooks:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Delete a book by ID or filePath
   * @param {string} idOrPath 
   */
  async deleteBook(idOrPath) {
    if (!idOrPath) return { success: false };
    try {
      let deletedId = null;
      const currentFiles = await fs.promises.readdir(this.booksDir);
      for (const file of currentFiles) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.booksDir, file);
          const raw = await fs.promises.readFile(filePath, 'utf8');
          const b = JSON.parse(raw);
          if (b.id === idOrPath || b.filePath === idOrPath) {
            await fs.promises.unlink(filePath);
            deletedId = b.id || file.replace('.json', '');
            console.log(`[BookStorage] Đã xóa file sách: ${file}`);
          }
        }
      }

      if (deletedId && fs.existsSync(this.indexFilePath)) {
        try {
          const rawIndex = await fs.promises.readFile(this.indexFilePath, 'utf8');
          let index = JSON.parse(rawIndex);
          if (Array.isArray(index)) {
            index = index.filter(e => e.id !== deletedId && e.filePath !== idOrPath);
            const indexTemp = `${this.indexFilePath}.tmp_${Date.now()}`;
            await fs.promises.writeFile(indexTemp, JSON.stringify(index, null, 2), 'utf8');
            await fs.promises.rename(indexTemp, this.indexFilePath);
          }
        } catch (_) {}
      }

      return { success: true };
    } catch (err) {
      console.error('[BookStorage] Lỗi xóa sách:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Update or insert book metadata in index
   */
  async updateIndexForBook(book) {
    try {
      let index = [];
      if (fs.existsSync(this.indexFilePath)) {
        const raw = await fs.promises.readFile(this.indexFilePath, 'utf8');
        index = JSON.parse(raw);
      }

      const existingIdx = index.findIndex(e => e.id === book.id || e.filePath === book.filePath);
      const newEntry = this.createIndexEntry(book);

      if (existingIdx >= 0) {
        index[existingIdx] = newEntry;
      } else {
        index.push(newEntry);
      }

      const tempPath = `${this.indexFilePath}.tmp_${Date.now()}`;
      await fs.promises.writeFile(tempPath, JSON.stringify(index, null, 2), 'utf8');
      await fs.promises.rename(tempPath, this.indexFilePath);
    } catch (err) {
      console.warn('[BookStorage] Lỗi ghi books_index.json:', err);
    }
  }
}

module.exports = new BookStorage();
