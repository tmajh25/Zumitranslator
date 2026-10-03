/**
 * EPUB Optimizer Service
 * Detects and purges orphan images, standardizes structure, and recompresses with DEFLATE Level 9.
 * Follows Single Responsibility Principle (SRP).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const JSZip = require('jszip');

/**
 * Clean temporary cached EPUB images older than maxAgeDays
 */
function cleanOldTempImages(maxAgeDays = 7) {
  try {
    const baseDir = path.join(os.tmpdir(), 'zumi_epub_images');
    if (!fs.existsSync(baseDir)) return;
    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirPath = path.join(baseDir, entry.name);
        try {
          const stat = fs.statSync(dirPath);
          if (now - stat.mtimeMs > maxAgeMs) {
            fs.rmSync(dirPath, { recursive: true, force: true });
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('[EpubOptimizer] Không thể dọn dẹp ảnh tạm:', err);
  }
}

/**
 * Clean & Optimize Chapter HTML (Remove garbage scripts and empty paragraphs)
 */
function cleanChapterHtml(html) {
  if (!html || typeof html !== 'string') return html;
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<p\b[^>]*>\s*(?:&nbsp;|<br\s*\/?>)?\s*<\/p>/gi, '');
}

/**
 * Optimize EPUB:
 * - Scans all chapters, SVG, and CSS files to identify used image assets
 * - Removes unreferenced / orphan images from the ZIP and content.opf
 * - Cleans garbage scripts and empty paragraph tags
 * - Standardizes uncompressed mimetype entry
 * - Re-compresses with DEFLATE Level 9
 * - Saves atomically and returns detailed byte savings
 */
async function optimizeEpub(filePath, options = {}) {
  if (!fs.existsSync(filePath)) throw new Error('Tệp EPUB không tồn tại: ' + filePath);
  
  const originalSize = fs.statSync(filePath).size;
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);

  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  if (!containerXml) throw new Error('Tệp không phải EPUB hợp lệ (thiếu META-INF/container.xml)');

  const rootFileMatch = containerXml.match(/full-path="([^"]+)"/);
  if (!rootFileMatch) throw new Error('Không tìm thấy đường dẫn OPF trong container.xml');

  const rootFilePath = rootFileMatch[1];
  const rootDir = rootFilePath.substring(0, rootFilePath.lastIndexOf('/') + 1);

  let opfContent = await zip.file(rootFilePath)?.async('string');
  if (!opfContent) throw new Error('Không thể đọc nội dung content.opf');

  const referencedPaths = new Set();
  const manifestMatches = [...opfContent.matchAll(/<item\s+([^>]+)>/gi)];
  const manifestMap = {};

  for (const m of manifestMatches) {
    const attrs = m[1];
    const id = attrs.match(/id="([^"]+)"/i)?.[1];
    const href = attrs.match(/href="([^"]+)"/i)?.[1];
    const mediaType = attrs.match(/media-type="([^"]+)"/i)?.[1] || '';
    const prop = attrs.match(/properties="([^"]+)"/i)?.[1] || '';
    if (id && href) {
      manifestMap[id] = { id, href, mediaType, prop };
    }
  }

  // Cover image identification
  let coverHref = null;
  for (const id in manifestMap) {
    if (manifestMap[id].prop.includes('cover-image')) {
      coverHref = manifestMap[id].href;
      break;
    }
  }
  if (!coverHref) {
    const metaCoverMatch = opfContent.match(/<meta\s+[^>]*name="cover"[^>]*content="([^"]+)"/i) ||
                           opfContent.match(/<meta\s+[^>]*content="([^"]+)"[^>]*name="cover"/i);
    if (metaCoverMatch && manifestMap[metaCoverMatch[1]]) {
      coverHref = manifestMap[metaCoverMatch[1]].href;
    }
  }
  if (coverHref) {
    const cleanCover = decodeURIComponent(coverHref);
    referencedPaths.add(cleanCover.toLowerCase());
    referencedPaths.add(path.posix.normalize(path.posix.join(rootDir, cleanCover)).toLowerCase());
    referencedPaths.add(cleanCover.replace(/^.*[\\\/]/, '').toLowerCase());
  }

  // Scan all documents, svgs, and stylesheets for references
  const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff']);
  const textFiles = [];

  zip.forEach((relPath, zipEntry) => {
    if (!zipEntry.dir) {
      const lower = relPath.toLowerCase();
      if (lower.endsWith('.xhtml') || lower.endsWith('.html') || lower.endsWith('.htm') || lower.endsWith('.xml') || lower.endsWith('.css') || lower.endsWith('.svg')) {
        textFiles.push(relPath);
      }
    }
  });

  for (const tPath of textFiles) {
    const content = await zip.file(tPath)?.async('string');
    if (!content) continue;
    const fileDir = path.posix.dirname(tPath);

    // img src
    const imgSrcMatches = content.matchAll(/<(?:img|source)[^>]*?\bsrc=["']([^"']+)["']/gi);
    for (const sm of imgSrcMatches) {
      const raw = sm[1].split('#')[0].split('?')[0];
      if (raw && !raw.startsWith('data:')) {
        const clean = decodeURIComponent(raw);
        referencedPaths.add(clean.toLowerCase());
        referencedPaths.add(path.posix.normalize(path.posix.join(fileDir, clean)).toLowerCase());
        referencedPaths.add(clean.replace(/^.*[\\\/]/, '').toLowerCase());
      }
    }

    // svg / xlink:href / href
    const hrefMatches = content.matchAll(/<(?:image|use)[^>]*?\b(?:xlink:href|href)=["']([^"']+)["']/gi);
    for (const hm of hrefMatches) {
      const raw = hm[1].split('#')[0].split('?')[0];
      if (raw && !raw.startsWith('data:')) {
        const clean = decodeURIComponent(raw);
        referencedPaths.add(clean.toLowerCase());
        referencedPaths.add(path.posix.normalize(path.posix.join(fileDir, clean)).toLowerCase());
        referencedPaths.add(clean.replace(/^.*[\\\/]/, '').toLowerCase());
      }
    }

    // css url(...)
    const cssUrlMatches = content.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi);
    for (const cm of cssUrlMatches) {
      const raw = cm[1].split('#')[0].split('?')[0];
      if (raw && !raw.startsWith('data:')) {
        const clean = decodeURIComponent(raw);
        referencedPaths.add(clean.toLowerCase());
        referencedPaths.add(path.posix.normalize(path.posix.join(fileDir, clean)).toLowerCase());
        referencedPaths.add(clean.replace(/^.*[\\\/]/, '').toLowerCase());
      }
    }
  }

  // Find all image files in the zip
  const allImageEntries = [];
  zip.forEach((relPath, zipEntry) => {
    if (!zipEntry.dir) {
      const ext = path.extname(relPath).toLowerCase();
      if (imageExtensions.has(ext)) {
        allImageEntries.push(relPath);
      }
    }
  });

  const orphanFiles = [];
  if (options.purgeOrphans !== false) {
    for (const imgPath of allImageEntries) {
      const lower = imgPath.toLowerCase();
      const baseName = imgPath.replace(/^.*[\\\/]/, '').toLowerCase();
      const relFromRoot = imgPath.startsWith(rootDir) ? imgPath.substring(rootDir.length).toLowerCase() : lower;

      const isReferenced = referencedPaths.has(lower) ||
                           referencedPaths.has(baseName) ||
                           referencedPaths.has(relFromRoot);

      if (!isReferenced) {
        orphanFiles.push(imgPath);
      }
    }

    // Delete orphan files from ZIP
    for (const orphan of orphanFiles) {
      zip.remove(orphan);
    }

    // Remove orphan items from OPF manifest
    let updatedOpf = opfContent;
    let removedManifestCount = 0;
    for (const id in manifestMap) {
      const item = manifestMap[id];
      const fullItemPath = path.posix.normalize(path.posix.join(rootDir, decodeURIComponent(item.href))).toLowerCase();
      const isOrphan = orphanFiles.some(o => o.toLowerCase() === fullItemPath || o.toLowerCase().endsWith(item.href.toLowerCase()));
      if (isOrphan) {
        const itemRegex = new RegExp(`[\\t ]*<item\\b[^>]*?\\bid=["']${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*?>\\s*\\r?\\n?`, 'gi');
        updatedOpf = updatedOpf.replace(itemRegex, '');
        removedManifestCount++;
      }
    }

    if (updatedOpf !== opfContent) {
      zip.file(rootFilePath, updatedOpf);
    }
  }

  // Clean HTML across chapters (remove empty paragraphs and garbage scripts)
  let optimizedChaptersCount = 0;
  if (options.cleanHtml !== false) {
    for (const tPath of textFiles) {
      const lower = tPath.toLowerCase();
      if (lower.endsWith('.xhtml') || lower.endsWith('.html') || lower.endsWith('.htm')) {
        const content = await zip.file(tPath)?.async('string');
        if (content) {
          const cleaned = cleanChapterHtml(content);
          if (cleaned !== content) {
            zip.file(tPath, cleaned);
            optimizedChaptersCount++;
          }
        }
      }
    }
  }

  // Standardize uncompressed mimetype
  if (zip.file('mimetype')) {
    zip.remove('mimetype');
  }
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // Generate optimized ZIP buffer with DEFLATE (Level 9 if recompress enabled)
  const compressLevel = options.recompress !== false ? 9 : 6;
  const optimizedBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: compressLevel }
  });

  const newSize = optimizedBuffer.length;
  const savedBytes = Math.max(0, originalSize - newSize);
  const savedPercent = originalSize > 0 ? Number(((savedBytes / originalSize) * 100).toFixed(1)) : 0;

  // Atomic write back to filePath
  const tempPath = `${filePath}.tmp_${Date.now()}`;
  fs.writeFileSync(tempPath, optimizedBuffer);
  fs.renameSync(tempPath, filePath);

  return {
    success: true,
    originalSize,
    newSize,
    savedBytes,
    savedPercent,
    removedImagesCount: orphanFiles.length,
    orphanFiles: orphanFiles.map(f => path.basename(f)),
    optimizedChaptersCount
  };
}

module.exports = {
  optimizeEpub,
  cleanOldTempImages,
};
