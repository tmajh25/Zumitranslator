/**
 * EPUB Service: Dedicated module for reading, parsing metadata/cover/TOC,
 * updating metadata in-place, and packaging industrial-grade EPUB files.
 */

const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
const crypto = require('crypto');
const JSZip = require('jszip');
const { optimizeEpub, cleanOldTempImages } = require('./epubOptimizer');
const R18Detector = require('../translators/r18Detector');

function isBookR18(filePath, metadata, sampleText = '') {
  const combinedMeta = [
    filePath || '',
    metadata?.title || '',
    ...(metadata?.subjects || []),
    metadata?.description || ''
  ].join(' ');

  const r18TagRegex = /(?:R[-_]?18|18\+|19\+|NSFW|Adult|Hentai|Erotica|R[-_]?19|18禁|19禁|고수위|高h|肉文)/i;
  if (r18TagRegex.test(combinedMeta)) return true;

  if (R18Detector && typeof R18Detector.isTitleR18 === 'function') {
    if (R18Detector.isTitleR18(metadata?.title || '') || R18Detector.isTitleR18(filePath || '')) {
      return true;
    }
  }

  if (sampleText && R18Detector && typeof R18Detector.detect === 'function') {
    const sample = sampleText.substring(0, 4000);
    const lang = (metadata?.language && metadata.language !== 'vi') ? metadata.language : 'auto';
    const det = R18Detector.detect(sample, lang);
    if (det && det.isR18) return true;
  }

  return false;
}

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function countWords(text) {
  if (!text || typeof text !== 'string') return 0;
  const clean = text.replace(/\[IMG:[^\]]+\]/g, ' ');
  const cjkChars = (clean.match(/[\u4e00-\u9fa5\u3040-\u30ff\u3400-\u4dbf]/g) || []).length;
  const nonCjkText = clean.replace(/[\u4e00-\u9fa5\u3040-\u30ff\u3400-\u4dbf]/g, ' ').trim();
  const spacedWords = nonCjkText ? (nonCjkText.match(/\S+/gu) || []).length : 0;
  return cjkChars + spacedWords;
}

/**
 * Remove duplicate consecutive leading titles / paragraphs from extracted chapter text
 */
function deduplicateLeadingTitles(text, title = '') {
  if (!text) return '';
  const paras = text.split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);
  if (paras.length <= 1) return text;

  const norm = s => s.toLowerCase().replace(/\s+/g, ' ');
  const normTitle = norm(title || '');

  const result = [];
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i];
    const pNorm = norm(p);
    if (result.length > 0 && result.length <= 3) {
      const prevNorm = norm(result[result.length - 1]);
      if (pNorm === prevNorm || (normTitle && pNorm === normTitle && prevNorm === normTitle)) {
        continue;
      }
    }
    result.push(p);
  }
  return result.join('\n\n');
}

function escapeRegex(str) {
  if (!str) return '';
  return String(str).replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Extract clean text and images from a chunk of EPUB HTML
 */
async function extractHtmlTextWithImages(rawHtml, itemPath, rootDir, zip, cacheDir) {
  let contentWithImages = rawHtml;
  const imgRegex = /<(?:img\s+[^>]*?src=["']([^"']+)["']|image\s+[^>]*?(?:xlink:href|href)=["']([^"']+)["'])[^>]*>/gi;
  const foundImages = [...rawHtml.matchAll(imgRegex)];
  
  for (const match of foundImages) {
    const rawSrc = match[1] || match[2];
    if (!rawSrc) continue;
    
    const cleanSrc = decodeURIComponent(rawSrc.split('#')[0].split('?')[0]);
    const itemDir = path.posix.dirname(itemPath);
    const resolvedZipPath = path.posix.normalize(path.posix.join(itemDir, cleanSrc));
    
    let imgEntry = zip.file(resolvedZipPath) || zip.file(rootDir + cleanSrc) || zip.file(cleanSrc);
    if (!imgEntry) {
      const lower = resolvedZipPath.toLowerCase();
      for (const zName in zip.files) {
        if (zName.toLowerCase() === lower) {
          imgEntry = zip.file(zName);
          break;
        }
      }
    }
    
    if (imgEntry) {
      try {
        const ext = path.extname(cleanSrc) || '.jpg';
        const hashName = crypto.createHash('md5').update(resolvedZipPath).digest('hex') + ext;
        const cachedPath = path.join(cacheDir, hashName);
        if (!fs.existsSync(cachedPath)) {
          const imgBuffer = await imgEntry.async('nodebuffer');
          fs.writeFileSync(cachedPath, imgBuffer);
        }
        const fileUrl = 'file:///' + cachedPath.replace(/\\/g, '/');
        contentWithImages = contentWithImages.replace(match[0], `\n\n[IMG:${fileUrl}]\n\n`);
      } catch (imgErr) {
        console.warn('Failed to extract image:', cleanSrc, imgErr);
      }
    }
  }

  let text = contentWithImages
    .replace(/<rt[^>]*>[\s\S]*?<\/rt>/gi, '') // Remove furigana pronunciation
    .replace(/<rp[^>]*>[\s\S]*?<\/rp>/gi, '') // Remove ruby parenthesis
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article)>/gi, '\n\n')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

async function readEpubFile(filePath) {
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  
  // 1. Read container.xml to find content.opf
  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  if (!containerXml) throw new Error('Invalid EPUB: no container.xml');
  
  const rootFileMatch = containerXml.match(/full-path="([^"]+)"/);
  if (!rootFileMatch) throw new Error('Invalid EPUB: cannot find root file');
  
  const rootFilePath = rootFileMatch[1];
  const rootDir = rootFilePath.substring(0, rootFilePath.lastIndexOf('/') + 1);
  
  const opfContent = await zip.file(rootFilePath)?.async('string');
  if (!opfContent) throw new Error('Invalid EPUB: cannot read OPF');
  
  // 2. Extract metadata
  const titleMatch = opfContent.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
  const authorMatch = opfContent.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);
  const descMatch = opfContent.match(/<dc:description[^>]*>([\s\S]*?)<\/dc:description>/i);
  const pubMatch = opfContent.match(/<dc:publisher[^>]*>([\s\S]*?)<\/dc:publisher>/i);
  const langMatch = opfContent.match(/<dc:language[^>]*>([\s\S]*?)<\/dc:language>/i);
  const dateMatch = opfContent.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i);
  const subjectMatches = [...opfContent.matchAll(/<dc:subject[^>]*>([\s\S]*?)<\/dc:subject>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());

  const metadata = {
    title: titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Unknown',
    author: authorMatch ? authorMatch[1].replace(/<[^>]+>/g, '').trim() : 'Chưa rõ tác giả',
    description: descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '',
    publisher: pubMatch ? pubMatch[1].replace(/<[^>]+>/g, '').trim() : '',
    language: langMatch ? langMatch[1].replace(/<[^>]+>/g, '').trim() : 'vi',
    date: dateMatch ? dateMatch[1].replace(/<[^>]+>/g, '').trim() : '',
    subjects: subjectMatches.filter(Boolean),
  };
  
  // 3. Extract manifest & spine items
  const spineMatches = [...opfContent.matchAll(/<itemref\b[^>]*?\bidref=["']([^"']+)["'][^>]*?>/gi)];
  const manifestMatches = [...opfContent.matchAll(/<item\s+([^>]+)>/gi)];
  
  const manifestMap = {};
  let tocNcxHref = null;
  let navXhtmlHref = null;

  for (const m of manifestMatches) {
    const itemAttrs = m[1];
    const idMatch = itemAttrs.match(/id="([^"]+)"/i);
    const hrefMatch = itemAttrs.match(/href="([^"]+)"/i);
    const mediaMatch = itemAttrs.match(/media-type="([^"]+)"/i);
    const propMatch = itemAttrs.match(/properties="([^"]+)"/i);
    if (idMatch && hrefMatch) {
      const itemObj = { 
        id: idMatch[1],
        href: hrefMatch[1], 
        mediaType: mediaMatch ? mediaMatch[1] : '',
        properties: propMatch ? propMatch[1] : ''
      };
      manifestMap[idMatch[1]] = itemObj;

      if (itemObj.mediaType === 'application/x-dtbncx+xml' || itemObj.href.endsWith('.ncx')) {
        tocNcxHref = itemObj.href;
      }
      if (itemObj.properties.includes('nav') || itemObj.href.endsWith('nav.xhtml') || itemObj.href.includes('navigation-documents')) {
        navXhtmlHref = itemObj.href;
      }
    }
  }

  // 4. Cover image extraction
  let cover = null;
  try {
    let coverHref = null;
    let coverMediaType = 'image/jpeg';

    for (const id in manifestMap) {
      if (manifestMap[id].properties && manifestMap[id].properties.includes('cover-image')) {
        coverHref = manifestMap[id].href;
        coverMediaType = manifestMap[id].mediaType || coverMediaType;
        break;
      }
    }

    if (!coverHref) {
      const metaCoverMatch = opfContent.match(/<meta\s+[^>]*name="cover"[^>]*content="([^"]+)"/i) ||
                             opfContent.match(/<meta\s+[^>]*content="([^"]+)"[^>]*name="cover"/i);
      if (metaCoverMatch && manifestMap[metaCoverMatch[1]]) {
        coverHref = manifestMap[metaCoverMatch[1]].href;
        coverMediaType = manifestMap[metaCoverMatch[1]].mediaType || coverMediaType;
      }
    }

    if (!coverHref) {
      for (const id in manifestMap) {
        const item = manifestMap[id];
        if (item.mediaType && item.mediaType.startsWith('image/')) {
          if (id.toLowerCase().includes('cover') || item.href.toLowerCase().includes('cover')) {
            coverHref = item.href;
            coverMediaType = item.mediaType;
            break;
          }
        }
      }
    }

    if (coverHref) {
      const cleanCoverHref = decodeURIComponent(coverHref);
      const coverPath = rootDir + cleanCoverHref;
      const fileInZip = zip.file(coverPath) || zip.file(rootDir + coverHref);
      if (fileInZip) {
        const coverBuffer = await fileInZip.async('nodebuffer');
        if (coverBuffer && coverBuffer.length > 0) {
          cover = `data:${coverMediaType};base64,${coverBuffer.toString('base64')}`;
        }
      }
    }
  } catch (coverErr) {
    console.warn('Could not extract cover image:', coverErr);
  }

  // 5. Parse TOC (Table of Contents) from toc.ncx or nav.xhtml
  const tocTitleMap = {}; // href (clean without anchor) -> title
  const tocAnchorsMap = {}; // filename / base -> [ { anchor, title } ]

  const addTocEntry = (rawHref, rawTitle) => {
    if (!rawHref || !rawTitle) return;
    const titleText = rawTitle.replace(/<[^>]+>/g, '').trim();
    if (!titleText) return;

    const [filePart, anchorPart] = rawHref.split('#');
    const cleanFilePart = decodeURIComponent(filePart);
    const baseFile = filePart.replace(/^.*[\\\/]/, '');
    const cleanBaseFile = decodeURIComponent(baseFile);

    if (!tocTitleMap[filePart]) tocTitleMap[filePart] = titleText;
    if (!tocTitleMap[cleanFilePart]) tocTitleMap[cleanFilePart] = titleText;
    if (!tocTitleMap[baseFile]) tocTitleMap[baseFile] = titleText;
    if (!tocTitleMap[cleanBaseFile]) tocTitleMap[cleanBaseFile] = titleText;

    if (anchorPart) {
      const cleanAnchor = decodeURIComponent(anchorPart);
      const targetKeys = [cleanBaseFile, baseFile, cleanFilePart, filePart];
      for (const k of targetKeys) {
        if (!tocAnchorsMap[k]) tocAnchorsMap[k] = [];
        if (!tocAnchorsMap[k].some(a => a.anchor === cleanAnchor || a.anchor === anchorPart)) {
          tocAnchorsMap[k].push({ anchor: cleanAnchor, title: titleText });
        }
      }
    }
  };

  try {
    if (navXhtmlHref) {
      const navContent = await zip.file(rootDir + decodeURIComponent(navXhtmlHref))?.async('string');
      if (navContent) {
        // Prioritize <nav epub:type="toc"> to prevent landmark/guide links from overwriting actual chapter titles
        const tocNavMatch = navContent.match(/<nav[^>]*epub:type=["']toc["'][^>]*>([\s\S]*?)<\/nav>/i);
        const parseContent = tocNavMatch ? tocNavMatch[1] : navContent;
        const navMatches = [...parseContent.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
        for (const nm of navMatches) {
          addTocEntry(nm[1], nm[2]);
        }
      }
    }

    if (tocNcxHref && Object.keys(tocAnchorsMap).length === 0 && Object.keys(tocTitleMap).length === 0) {
      const ncxContent = await zip.file(rootDir + decodeURIComponent(tocNcxHref))?.async('string');
      if (ncxContent) {
        const npMatches = [...ncxContent.matchAll(/<navPoint[\s\S]*?<text>([\s\S]*?)<\/text>[\s\S]*?src=["']([^"']+)["']/gi)];
        for (const npm of npMatches) {
          addTocEntry(npm[2], npm[1]);
        }
      }
    }
  } catch (tocErr) {
    console.warn('Could not parse TOC files:', tocErr);
  }

  // Prepare cache directory for extracting book images
  cleanOldTempImages();
  const fileHash = crypto.createHash('md5').update(filePath).digest('hex').substring(0, 10);
  const cacheDir = path.join(os.tmpdir(), 'zumi_epub_images', fileHash);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  // 6. Read HTML/XHTML content in spine order with smart Chapter grouping & Image preservation
  const hasToc = Object.keys(tocTitleMap).length > 0 || Object.keys(tocAnchorsMap).length > 0;
  let isAdultBook = isBookR18(filePath, metadata);
  const chapters = [];
  let currentChapter = null;
  let chapterIndex = 0;

  for (const spine of spineMatches) {
    const item = manifestMap[spine[1]];
    if (!item) continue;
    if (!item.mediaType.includes('html') && !item.mediaType.includes('xml')) continue;
    
    const itemPath = rootDir + decodeURIComponent(item.href);
    const fileContent = await (zip.file(itemPath) || zip.file(rootDir + item.href))?.async('string');
    if (!fileContent) continue;

    if (!isAdultBook && fileContent) {
      isAdultBook = isBookR18(filePath, metadata, fileContent);
    }

    const baseFile = item.href.replace(/^.*[\\\/]/, '');
    const cleanHref = decodeURIComponent(item.href);
    const cleanBase = decodeURIComponent(baseFile);
    const anchors = tocAnchorsMap[cleanBase] || tocAnchorsMap[baseFile] || tocAnchorsMap[cleanHref] || tocAnchorsMap[item.href] || [];

    // CHỈ áp dụng cơ chế tự động tách sub-chapters bên trong cùng 1 tệp HTML nếu cuốn sách là 18+
    let splitPoints = [];
    if (isAdultBook) {
      if (anchors.length >= 2) {
        for (const a of anchors) {
          const regex = new RegExp(`<(?:[a-zA-Z0-9]+)[^>]*(?:id|name)=["']${escapeRegex(a.anchor)}["'][^>]*>`, 'i');
          const match = regex.exec(fileContent);
          if (match) {
            splitPoints.push({ index: match.index, title: a.title, anchor: a.anchor });
          }
        }
        splitPoints.sort((a, b) => a.index - b.index);
      }

      // Fallback: If no TOC anchors found, check if file contains multiple section chapters (e.g. <section epub:type="chapter">)
      if (splitPoints.length < 2) {
        const sectionChapterRegex = /<section\b[^>]*epub:type=["'][^"']*chapter[^"']*["'][^>]*>/gi;
        const secMatches = [...fileContent.matchAll(sectionChapterRegex)];
        if (secMatches.length >= 2) {
          splitPoints = secMatches.map(m => {
            const post = fileContent.substring(m.index, m.index + 500);
            const hMatch = post.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
            const title = hMatch ? hMatch[1].replace(/<[^>]+>/g, '').trim() : '';
            return {
              index: m.index,
              title: title || `Chương ${chapterIndex + 1}`
            };
          });
        }
      }

      // Fallback: Check if file contains multiple heading chapters (e.g. <h2>第...章</h2>)
      if (splitPoints.length < 2) {
        const headingChapterRegex = /<(h[1-6])[^>]*>(\s*(?:第[0-9一二两三四五六七八九十百千万零〇]+[章回节]|Chapter\s*\d+|Chương\s*\d+)[\s\S]*?)<\/\1>/gi;
        const headingMatches = [...fileContent.matchAll(headingChapterRegex)];
        if (headingMatches.length >= 2) {
          splitPoints = headingMatches.map(m => ({
            index: m.index,
            title: m[2].replace(/<[^>]+>/g, '').trim()
          }));
        }
      }
    }

    if (splitPoints.length >= 2) {
      // Check if there is prologue or cover text before the first split point
      if (splitPoints[0].index > 0) {
        const preHtml = fileContent.substring(0, splitPoints[0].index);
        const preText = await extractHtmlTextWithImages(preHtml, itemPath, rootDir, zip, cacheDir);
        if (preText && (preText.replace(/\[IMG:[^\]]+\]/g, '').trim().length > 30 || /\[IMG:[^\]]+\]/.test(preText))) {
          const isCover = /cover|titlepage/i.test(item.href);
          const preTitle = isCover ? 'Cover' : 'Mở đầu / Giới thiệu';
          const cleanPreText = deduplicateLeadingTitles(preText, preTitle);
          currentChapter = {
            id: chapterIndex++,
            title: preTitle,
            originalTitle: preTitle,
            content: cleanPreText,
            charCount: cleanPreText.length,
            wordCount: countWords(cleanPreText),
            href: item.href,
            selected: true,
            shouldNumber: false
          };
          chapters.push(currentChapter);
        }
      }

      for (let i = 0; i < splitPoints.length; i++) {
        const curr = splitPoints[i];
        const next = splitPoints[i + 1];
        const chunkHtml = fileContent.substring(curr.index, next ? next.index : fileContent.length);
        let cleanText = await extractHtmlTextWithImages(chunkHtml, itemPath, rootDir, zip, cacheDir);
        cleanText = deduplicateLeadingTitles(cleanText, curr.title);
        currentChapter = {
          id: chapterIndex++,
          title: curr.title,
          originalTitle: curr.title,
          content: cleanText,
          charCount: cleanText.length,
          wordCount: countWords(cleanText),
          href: `${item.href}#${curr.anchor || ''}`,
          selected: true,
          shouldNumber: true
        };
        chapters.push(currentChapter);
      }
      continue;
    }

    // Extract and preserve images from fileContent before stripping tags
    let contentWithImages = fileContent;
    const imgRegex = /<(?:img\s+[^>]*?src=["']([^"']+)["']|image\s+[^>]*?(?:xlink:href|href)=["']([^"']+)["'])[^>]*>/gi;
    const foundImages = [...fileContent.matchAll(imgRegex)];
    
    for (const match of foundImages) {
      const rawSrc = match[1] || match[2];
      if (!rawSrc) continue;
      
      const cleanSrc = decodeURIComponent(rawSrc.split('#')[0].split('?')[0]);
      const itemDir = path.posix.dirname(itemPath);
      const resolvedZipPath = path.posix.normalize(path.posix.join(itemDir, cleanSrc));
      
      let imgEntry = zip.file(resolvedZipPath) || zip.file(rootDir + cleanSrc) || zip.file(cleanSrc);
      if (!imgEntry) {
        const lower = resolvedZipPath.toLowerCase();
        for (const zName in zip.files) {
          if (zName.toLowerCase() === lower) {
            imgEntry = zip.file(zName);
            break;
          }
        }
      }
      
      if (imgEntry) {
        try {
          const ext = path.extname(cleanSrc) || '.jpg';
          const hashName = crypto.createHash('md5').update(resolvedZipPath).digest('hex') + ext;
          const cachedPath = path.join(cacheDir, hashName);
          if (!fs.existsSync(cachedPath)) {
            const imgBuffer = await imgEntry.async('nodebuffer');
            fs.writeFileSync(cachedPath, imgBuffer);
          }
          const fileUrl = 'file:///' + cachedPath.replace(/\\/g, '/');
          contentWithImages = contentWithImages.replace(match[0], `\n\n[IMG:${fileUrl}]\n\n`);
        } catch (imgErr) {
          console.warn('Failed to extract image:', cleanSrc, imgErr);
        }
      }
    }

    // Strip HTML tags and normalize text (our [IMG:...] tags safely survive)
    let text = contentWithImages
      .replace(/<rt[^>]*>[\s\S]*?<\/rt>/gi, '') // Remove furigana pronunciation
      .replace(/<rp[^>]*>[\s\S]*?<\/rp>/gi, '') // Remove ruby parenthesis
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article)>/gi, '\n\n')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
      .replace(/\r/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const hasImages = /\[IMG:[^\]]+\]/.test(text);
    if (!text && !hasImages) continue;

    const textWithoutImages = text.replace(/\[IMG:[^\]]+\]/g, '').trim();
    const isPureImage = hasImages && textWithoutImages.length === 0;

    // Detect chapter titles and headings
    let tocTitle = tocTitleMap[item.href] || tocTitleMap[cleanHref] || tocTitleMap[baseFile] || tocTitleMap[cleanBase];

    let headingTitle = null;
    const h1Match = fileContent.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const h2Match = fileContent.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const titleTagMatch = fileContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (h1Match) headingTitle = h1Match[1].replace(/<[^>]+>/g, '').trim();
    else if (h2Match) headingTitle = h2Match[1].replace(/<[^>]+>/g, '').trim();
    else if (titleTagMatch && titleTagMatch[1].trim() && titleTagMatch[1].trim() !== metadata.title) {
      headingTitle = titleTagMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    const chapterKeywordRegex = /^\s*(Chương|Chapter|Tiết|Quyển|Tập|Vol|Volume|Phần|第)\s*([0-9\u2140-\u214f\u4e00-\u9fa5\u3040-\u30ff]+)/i;
    const isExplicitChapterHeading = headingTitle && (chapterKeywordRegex.test(headingTitle) || headingTitle.length < 60);

    let startsNewChapter = false;
    let newChapterTitle = '';

    if (tocTitle) {
      // 1. Direct TOC entry always defines a chapter boundary
      startsNewChapter = true;
      newChapterTitle = tocTitle;
    } else if (!hasToc && isExplicitChapterHeading) {
      // 2. In books without TOC, explicit headings mark new chapters
      startsNewChapter = true;
      newChapterTitle = headingTitle;
    } else if (!currentChapter) {
      // 3. First content item in book
      const isCover = isPureImage || /cover|titlepage/i.test(item.href) || (item.id && /cover|titlepage/i.test(item.id));
      startsNewChapter = true;
      newChapterTitle = (headingTitle && !/^(bìa(\s+sách)?|bìa\s*&\s*minh\s*họa)$/i.test(headingTitle)) ? headingTitle : (isCover ? 'Cover' : 'Mở đầu');
    } else if (isPureImage) {
      // 4. Pure illustration inside a chapter -> Keep embedded inside currentChapter!
      startsNewChapter = false;
    } else if (hasToc) {
      // 5. In books with TOC, spine items without TOC entry are continuation pages belonging to currentChapter
      startsNewChapter = false;
    } else {
      // 6. In books without TOC, each separate text file is a chapter
      startsNewChapter = true;
      const firstLine = textWithoutImages.split('\n').map(l => l.trim()).find(l => l.length > 0) || '';
      newChapterTitle = headingTitle || ((firstLine.length > 0 && firstLine.length < 80) ? firstLine : `Chương ${chapterIndex + 1}`);
    }

    if (startsNewChapter) {
      const cleanText = deduplicateLeadingTitles(text, newChapterTitle);
      currentChapter = {
        id: chapterIndex++,
        title: newChapterTitle,
        originalTitle: newChapterTitle,
        content: cleanText,
        charCount: cleanText.length,
        wordCount: countWords(cleanText),
        href: item.href,
        selected: true,
        shouldNumber: true
      };
      chapters.push(currentChapter);
    } else if (currentChapter) {
      // Append illustration or continuation page to the ongoing chapter
      currentChapter.content += '\n\n' + text;
      currentChapter.charCount = currentChapter.content.length;
      currentChapter.wordCount = countWords(currentChapter.content);
    }
  }

  const allText = chapters.map(c => c.content).join('\n\n---CHAPTER_BREAK---\n\n').trim();
  return {
    content: allText,
    charCount: allText.length,
    wordCount: countWords(allText),
    metadata,
    cover,
    chapters
  };
}

/**
 * Update EPUB Metadata & Cover directly inside the existing file on disk
 */
async function updateEpubMetadata(filePath, metadata = {}, coverBase64 = null) {
  if (!fs.existsSync(filePath)) throw new Error('Tệp EPUB không tồn tại: ' + filePath);
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  
  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  if (!containerXml) throw new Error('Không tìm thấy META-INF/container.xml trong EPUB');
  
  const rootFileMatch = containerXml.match(/full-path="([^"]+)"/);
  if (!rootFileMatch) throw new Error('Không tìm thấy đường dẫn content.opf');
  
  const rootFilePath = rootFileMatch[1];
  const rootDir = rootFilePath.substring(0, rootFilePath.lastIndexOf('/') + 1);
  
  let opf = await zip.file(rootFilePath)?.async('string');
  if (!opf) throw new Error('Không thể đọc nội dung content.opf');

  // 1. Update Title
  if (metadata.title) {
    if (/<dc:title[^>]*>[\s\S]*?<\/dc:title>/i.test(opf)) {
      opf = opf.replace(/<dc:title[^>]*>[\s\S]*?<\/dc:title>/i, `<dc:title>${escapeXml(metadata.title)}</dc:title>`);
    } else {
      opf = opf.replace(/<metadata[^>]*>/i, `$& \n    <dc:title>${escapeXml(metadata.title)}</dc:title>`);
    }
  }

  // 2. Update Creator / Author
  if (metadata.author) {
    if (/<dc:creator[^>]*>[\s\S]*?<\/dc:creator>/i.test(opf)) {
      opf = opf.replace(/<dc:creator[^>]*>[\s\S]*?<\/dc:creator>/i, `<dc:creator>${escapeXml(metadata.author)}</dc:creator>`);
    } else {
      opf = opf.replace(/<metadata[^>]*>/i, `$& \n    <dc:creator>${escapeXml(metadata.author)}</dc:creator>`);
    }
  }

  // 3. Update Publisher
  if (metadata.publisher !== undefined) {
    if (/<dc:publisher[^>]*>[\s\S]*?<\/dc:publisher>/i.test(opf)) {
      opf = opf.replace(/<dc:publisher[^>]*>[\s\S]*?<\/dc:publisher>/i, `<dc:publisher>${escapeXml(metadata.publisher)}</dc:publisher>`);
    } else if (metadata.publisher) {
      opf = opf.replace(/<metadata[^>]*>/i, `$& \n    <dc:publisher>${escapeXml(metadata.publisher)}</dc:publisher>`);
    }
  }

  // 4. Update Language
  if (metadata.language) {
    if (/<dc:language[^>]*>[\s\S]*?<\/dc:language>/i.test(opf)) {
      opf = opf.replace(/<dc:language[^>]*>[\s\S]*?<\/dc:language>/i, `<dc:language>${escapeXml(metadata.language)}</dc:language>`);
    } else {
      opf = opf.replace(/<metadata[^>]*>/i, `$& \n    <dc:language>${escapeXml(metadata.language)}</dc:language>`);
    }
  }

  // 5. Update Description
  if (metadata.description !== undefined) {
    if (/<dc:description[^>]*>[\s\S]*?<\/dc:description>/i.test(opf)) {
      opf = opf.replace(/<dc:description[^>]*>[\s\S]*?<\/dc:description>/i, `<dc:description>${escapeXml(metadata.description)}</dc:description>`);
    } else if (metadata.description) {
      opf = opf.replace(/<metadata[^>]*>/i, `$& \n    <dc:description>${escapeXml(metadata.description)}</dc:description>`);
    }
  }

  // 6. Update Cover Image if provided
  if (coverBase64) {
    const base64Data = coverBase64.replace(/^data:image\/\w+;base64,/, '');
    const coverBuffer = Buffer.from(base64Data, 'base64');
    const coverFileName = 'cover.jpg';
    zip.file(rootDir + coverFileName, coverBuffer);

    // Update manifest for cover-image
    if (!opf.includes('properties="cover-image"')) {
      if (opf.includes('id="cover"')) {
        opf = opf.replace(/(<item[^>]*id="cover"[^>]*)/i, `$1 properties="cover-image"`);
      } else {
        opf = opf.replace(/<manifest[^>]*>/i, `$& \n    <item id="cover-image" href="${coverFileName}" media-type="image/jpeg" properties="cover-image"/>`);
      }
    }
    if (!opf.includes('name="cover"')) {
      opf = opf.replace(/<metadata[^>]*>/i, `$& \n    <meta name="cover" content="cover-image"/>`);
    }
  }

  zip.file(rootFilePath, opf);
  const updatedBuffer = await zip.generateAsync({ 
    type: 'nodebuffer', 
    compression: 'DEFLATE', 
    compressionOptions: { level: 9 } 
  });
  const tmpPath = `${filePath}.tmp_${Date.now()}`;
  fs.writeFileSync(tmpPath, updatedBuffer);
  fs.renameSync(tmpPath, filePath);
  return true;
}

/**
 * Packaging complete EPUB3 & EPUB2 standard e-book with full TOC, Cover Art, and Metadata
 */
async function writeEpubFile(outputPath, translatedContent, originalPath, providedChapters, bookMeta = {}, coverDataUrl = null) {
  const zip = new JSZip();
  
  // 1. mimetype (uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  
  // 2. META-INF/container.xml
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);
  
  // 3. Prepare Chapters
  let chapters = [];
  if (providedChapters && Array.isArray(providedChapters) && providedChapters.length > 0) {
    chapters = providedChapters.map(c => ({
      title: c.title,
      content: c.content
    }));
  } else if (typeof translatedContent === 'string' && translatedContent) {
    const rawChapters = translatedContent.split('---CHAPTER_BREAK---').filter(c => c.trim());
    chapters = rawChapters.map((chapter, i) => {
      const lines = chapter.trim().split('\n').map(l => l.trim()).filter(l => l);
      const rawTitle = lines[0] || `Chương ${i + 1}`;
      const chapterTitle = rawTitle.length < 100 ? rawTitle : `Chương ${i + 1}`;
      return { title: chapterTitle, content: chapter };
    });
  } else if (Array.isArray(translatedContent)) {
    chapters = translatedContent;
  }

  const manifestItems = [];
  const spineItems = [];
  const navList = [];
  const ncxNavPoints = [];

  // 4. Process Cover Image
  let hasCover = false;
  if (coverDataUrl && coverDataUrl.startsWith('data:image/')) {
    try {
      const base64Data = coverDataUrl.replace(/^data:image\/\w+;base64,/, '');
      const coverBuffer = Buffer.from(base64Data, 'base64');
      zip.file('OEBPS/cover.jpg', coverBuffer);
      manifestItems.push('    <item id="cover-image" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>');
      
      // Cover page
      const coverHtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Bìa sách</title>
  <style>
    body { margin: 0; padding: 0; text-align: center; background-color: #000; }
    img { max-width: 100%; max-height: 100vh; height: auto; object-fit: contain; }
  </style>
</head>
<body>
  <div><img src="cover.jpg" alt="Bìa sách"/></div>
</body>
</html>`;
      zip.file('OEBPS/cover.xhtml', coverHtml);
      manifestItems.push('    <item id="cover-page" href="cover.xhtml" media-type="application/xhtml+xml"/>');
      spineItems.push('    <itemref idref="cover-page"/>');
      hasCover = true;
    } catch (e) {
      console.warn('Could not embed cover in exported EPUB:', e);
    }
  }

  let exportedImgCount = 0;
  const exportedImageMap = new Map();

  // 5. Generate Chapter Files
  chapters.forEach((chapter, i) => {
    const id = `chapter_${i + 1}`;
    const fileName = `${id}.xhtml`;
    const lines = (chapter.content || '').trim().split('\n').map(l => l.trim()).filter(l => l);
    
    const paragraphs = lines
      .map(p => {
        const imgMatch = p.match(/\[IMG:(.*?)\]/);
        if (imgMatch) {
          const fileUrl = imgMatch[1].trim();
          let zipRelPath = exportedImageMap.get(fileUrl);
          if (!zipRelPath) {
            try {
              let localDiskPath = '';
              try {
                localDiskPath = url.fileURLToPath(fileUrl);
              } catch (_) {
                localDiskPath = decodeURIComponent(fileUrl.replace(/^file:\/\/\/?/, '')).replace(/\//g, path.sep);
                if (process.platform !== 'win32' && !localDiskPath.startsWith('/')) {
                  localDiskPath = '/' + localDiskPath;
                }
              }
              if (fs.existsSync(localDiskPath)) {
                const imgBuffer = fs.readFileSync(localDiskPath);
                const ext = path.extname(localDiskPath) || '.jpg';
                exportedImgCount++;
                zipRelPath = `images/illus_${exportedImgCount}${ext}`;
                zip.file(`OEBPS/${zipRelPath}`, imgBuffer);
                const mime = ext.toLowerCase() === '.png' ? 'image/png' : ext.toLowerCase() === '.webp' ? 'image/webp' : ext.toLowerCase() === '.gif' ? 'image/gif' : 'image/jpeg';
                manifestItems.push(`    <item id="img_item_${exportedImgCount}" href="${zipRelPath}" media-type="${mime}"/>`);
                exportedImageMap.set(fileUrl, zipRelPath);
              }
            } catch (err) {
              console.warn('Could not re-pack image into EPUB:', err);
            }
          }
          if (zipRelPath) {
            return `  <div style="text-align: center; margin: 1.5em 0;"><img src="${zipRelPath}" alt="Minh họa" style="max-width: 100%; height: auto; border-radius: 4px;"/></div>`;
          }
        }
        return `  <p>${escapeXml(p)}</p>`;
      })
      .join('\n');
    
    const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(chapter.title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Times New Roman", serif; line-height: 1.8; padding: 1.5em 2em; color: #1a1a1a; }
    h1 { font-size: 1.6em; text-align: center; margin-bottom: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.5em; }
    p { margin: 0.8em 0; text-indent: 1.5em; text-align: justify; }
  </style>
</head>
<body>
${paragraphs}
</body>
</html>`;
    
    zip.file(`OEBPS/${fileName}`, xhtml);
    manifestItems.push(`    <item id="${id}" href="${fileName}" media-type="application/xhtml+xml"/>`);
    spineItems.push(`    <itemref idref="${id}"/>`);
    
    // Nav lists
    navList.push(`      <li><a href="${fileName}">${escapeXml(chapter.title)}</a></li>`);
    ncxNavPoints.push(`    <navPoint id="np_${i + 1}" playOrder="${i + 1}">
      <navLabel><text>${escapeXml(chapter.title)}</text></navLabel>
      <content src="${fileName}"/>
    </navPoint>`);
  });

  // 6. Required Navigation Documents: EPUB3 nav.xhtml & EPUB2 toc.ncx
  manifestItems.push('    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>');
  manifestItems.push('    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>');

  // Book metadata
  const bookTitle = bookMeta.title || 'Bản dịch EPUB';
  const bookAuthor = bookMeta.author || 'Chưa rõ tác giả';
  const bookPublisher = bookMeta.publisher || 'ZumiTrans';
  const bookLang = bookMeta.language || 'vi';
  const bookDesc = bookMeta.description || '';

  // 7. content.opf
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:${Date.now()}</dc:identifier>
    <dc:title>${escapeXml(bookTitle)}</dc:title>
    <dc:creator>${escapeXml(bookAuthor)}</dc:creator>
    <dc:publisher>${escapeXml(bookPublisher)}</dc:publisher>
    <dc:language>${escapeXml(bookLang)}</dc:language>
    <dc:description>${escapeXml(bookDesc)}</dc:description>
    ${hasCover ? '<meta name="cover" content="cover-image"/>' : ''}
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z/, 'Z')}</meta>
  </metadata>
  <manifest>
${manifestItems.join('\n')}
  </manifest>
  <spine toc="ncx">
${spineItems.join('\n')}
  </spine>
</package>`;

  zip.file('OEBPS/content.opf', opf);

  // 8. nav.xhtml (EPUB 3)
  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Mục lục</title>
  <style>
    body { font-family: sans-serif; padding: 2em; }
    h1 { font-size: 1.5em; }
    ol { list-style-type: none; padding-left: 0; }
    li { margin: 0.6em 0; }
    a { text-decoration: none; color: #4338ca; }
  </style>
</head>
<body>
  <nav epub:type="toc">
    <h1>Mục lục</h1>
    <ol>
${navList.join('\n')}
    </ol>
  </nav>
</body>
</html>`;
  zip.file('OEBPS/nav.xhtml', navXhtml);

  // 9. toc.ncx (EPUB 2 backward compatibility)
  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${Date.now()}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(bookTitle)}</text></docTitle>
  <docAuthor><text>${escapeXml(bookAuthor)}</text></docAuthor>
  <navMap>
${ncxNavPoints.join('\n')}
  </navMap>
</ncx>`;
  zip.file('OEBPS/toc.ncx', tocNcx);

  const buffer = await zip.generateAsync({ 
    type: 'nodebuffer', 
    compression: 'DEFLATE', 
    compressionOptions: { level: 9 } 
  });
  if (outputPath && typeof outputPath === 'string') {
    const tmpPath = `${outputPath}.tmp_${Date.now()}`;
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, outputPath);
  }
  return buffer;
}

module.exports = {
  escapeXml,
  readEpubFile,
  updateEpubMetadata,
  writeEpubFile,
  optimizeEpub,
  cleanOldTempImages,
};
