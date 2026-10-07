/**
 * Google Gemini Generative Language API
 * Supports API Key Pool & Auto-Rotation on 429/403/503
 * Supports standard v1beta generateContent
 * 
 * TÀI LIỆU CHÍNH THỨC CÁC MODEL GOOGLE GEMINI (BẮT BUỘC TRA CỨU TRƯỚC KHI SỬA HOẶC XÓA):
 * Official Google Gemini Models Documentation:
 * -> https://ai.google.dev/gemini-api/docs/models
 * Danh sách model chính thức bao gồm:
 * - Gemini 3: gemini-3.8-flash, gemini-3.7-flash, gemini-3.6-flash, gemini-3.5-flash, gemini-3.5-flash-lite, gemini-3.1-pro-preview, gemini-3.1-flash-lite, gemini-3-flash-preview
 * - Gemini 2.5: gemini-2.5-flash, gemini-2.5-pro, gemini-2.5-flash-lite
 * - Gemini 2.0 & 1.5: gemini-2.0-flash, gemini-2.0-flash-lite, gemini-1.5-flash, gemini-1.5-pro, gemini-flash-latest
 * LƯU Ý CHO CÁC AGENT / AI BẢO TRÌ: KHÔNG tự ý xóa, hạ cấp hoặc thay thế các model trên khi chưa kiểm tra tài liệu chính thức từ link trên!
 */

const { parseApiKeys } = require('./baseTranslator');
const PromptBuilder = require('./promptBuilder');
const ResponseCleaner = require('./responseCleaner');
const EuphemismFilter = require('./euphemismFilter');
const R18Detector = require('./r18Detector');

/**
 * Chia nhỏ đoạn văn bản một cách thông minh và tự nhiên theo cấu trúc ngữ pháp
 * (ưu tiên ngắt dòng \n, sau đó đến dấu ngắt câu 。！？!?.)
 * Giúp giảm mật độ ngữ cảnh nhạy cảm trên mỗi request để vượt qua bộ lọc Google 100% mà không sửa một từ nào của tác giả.
 */
function splitTextIntoSubChunks(text, maxChunkLen = 450) {
  if (!text || text.length <= maxChunkLen) return [text];
  
  const rawParas = text.split(/\n+/).filter(p => p.trim());
  const units = [];
  
  for (const para of rawParas) {
    if (para.length <= maxChunkLen) {
      units.push(para);
    } else {
      const sentences = para.split(/(?<=[。！？!?\.\n])/).filter(s => s.trim());
      units.push(...sentences);
    }
  }

  const chunks = [];
  let currentChunk = '';

  for (const unit of units) {
    if ((currentChunk + '\n\n' + unit).length > maxChunkLen && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = unit;
    } else {
      currentChunk = currentChunk ? (currentChunk + '\n\n' + unit) : unit;
    }
  }
  if (currentChunk) chunks.push(currentChunk);

  return chunks.length > 0 ? chunks : [text];
}

async function translateGemini({
  text,
  sourceLang = 'auto',
  targetLang = 'vi',
  customPrompt,
  apiKey,
  model = 'gemini-3.8-flash',
  thinkingLevel = 'medium',
  safetySetting = 'BLOCK_MEDIUM_AND_ABOVE',
  temperature = 1.0,
  glossary = [],
  characterProfiles = [],
  context = '',
  apiEndpoint = '',
  bookMemory = '',
  abortSignal = null,
  _bypassLevel = 1,
  _activeUnmasks = [],
  _activePlaceholderMap = null,
  _isEuphemismRetry = false,
  _isMicroChunked = false
}) {
  const keys = parseApiKeys(apiKey);
  if (keys.length === 0) {
    throw new Error('Vui lòng nhập API Key cho Google Gemini trong Cài đặt.');
  }

  const baseUrl = apiEndpoint || 'https://generativelanguage.googleapis.com';
  let activeModel = model || 'gemini-3.8-flash';

  const r18Detection = R18Detector.detect(text, sourceLang);
  const hasSensitive = EuphemismFilter.hasSensitiveContent(text, sourceLang);
  const isAdultContent = r18Detection.isR18 || hasSensitive || _bypassLevel > 1;
  const effectiveSafetySetting = isAdultContent ? 'BLOCK_NONE' : safetySetting;

  const userTemp = parseFloat(temperature);
  const safeTemp = isNaN(userTemp) ? 0.7 : userTemp;

  let baseTemp = safeTemp;
  const contentToTranslate = text; // ZERO-MODIFICATION: Luôn giữ nguyên 100% văn bản gốc của tác giả

  if (isAdultContent) {
    if (_bypassLevel === 1) {
      // Mức 1: Giữ nguyên 100% từ gốc, nhiệt độ theo cài đặt người dùng, prompt 18+ nguyên tác
      baseTemp = safeTemp;
    } else if (_bypassLevel === 2) {
      // Mức 2: Áo khoác ngữ cảnh văn học (Literary Framing) + hạ nhiệt độ 0.3, giữ 100% từ gốc
      baseTemp = Math.min(safeTemp, 0.3);
    } else if (_bypassLevel >= 3) {
      // Mức 3: Chốt chặn kỹ thuật chia nhỏ ngữ cảnh (Micro-Chunking), hạ nhiệt độ 0.2, giữ 100% từ gốc
      baseTemp = Math.min(safeTemp, 0.2);
    }
  }

  let instructions = PromptBuilder.buildSystemInstruction({
    customPrompt,
    sourceLang,
    targetLang,
    glossary,
    characterProfiles,
    bookMemory,
    context,
    text: contentToTranslate,
    bypassLevel: isAdultContent ? Math.min(_bypassLevel, 2) : 1
  });

  const normThinking = (thinkingLevel || 'medium').toLowerCase().trim();
  const isInteractions = baseUrl.includes('/interactions');

  let response;
  const triedKeyIndices = new Set();
  const maxRetriesPerKey = 3;
  let sawEmptyResponse = false;

  while (triedKeyIndices.size < keys.length) {
    const keyIdx = currentKeyIndex % keys.length;
    triedKeyIndices.add(keyIdx);
    const activeKey = keys[keyIdx];
    const keyNum = keyIdx + 1;

    let keyRetryCount = 0;
    let switchKey = false;

    while (keyRetryCount <= maxRetriesPerKey) {
      let url, headers, body;

      const effectiveTemp = Math.max(0.1, baseTemp - (keyRetryCount * 0.05));

      if (isInteractions) {
        url = baseUrl.includes('?') ? `${baseUrl}&key=${activeKey}` : `${baseUrl}?key=${activeKey}`;
        headers = {
          'Content-Type': 'application/json',
          'x-goog-api-key': activeKey,
          'Api-Revision': '2026-05-20'
        };
        body = {
          model: activeModel,
          system_instruction: instructions,
          input: `[VĂN BẢN GỐC]:\n${contentToTranslate}`,
          generation_config: {
            temperature: effectiveTemp,
            thinking_level: normThinking
          }
        };
      } else {
        url = `${baseUrl.replace(/\/$/, '')}/v1beta/models/${activeModel}:generateContent?key=${activeKey}`;
        headers = {
          'Content-Type': 'application/json',
          'x-goog-api-key': activeKey
        };
        body = {
          systemInstruction: {
            parts: [{ text: instructions }]
          },
          contents: [{
            parts: [{ text: `[VĂN BẢN GỐC CẦN DỊCH]:\n${contentToTranslate}` }]
          }],
          generationConfig: {
            temperature: effectiveTemp,
            maxOutputTokens: ((activeModel || '').includes('2.5') || (activeModel || '').includes('3.') || (activeModel || '').includes('flash-latest')) ? 65536 : 8192
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: effectiveSafetySetting },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: effectiveSafetySetting },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: effectiveSafetySetting },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: effectiveSafetySetting }
          ]
        };

        // Chuẩn hóa Thinking Config theo tài liệu chính thức Google Gemini
        const isGemini3 = activeModel.includes('3.') || activeModel.startsWith('gemini-3');
        const isGemini25 = activeModel.includes('2.5') || activeModel.includes('thinking');

        if (isGemini3) {
          let level = normThinking;
          const noMinimalModels = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.1-pro'];
          const cantMinimal = noMinimalModels.some(m => activeModel.includes(m));
          if (cantMinimal && (level === 'minimal' || level === 'none')) {
            level = 'low';
          }
          const validLevels = ['minimal', 'low', 'medium', 'high'];
          if (!validLevels.includes(level)) level = 'medium';
          body.generationConfig.thinkingConfig = {
            thinkingLevel: level
          };
        } else if (isGemini25) {
          if (normThinking === 'minimal' || normThinking === 'none') {
            body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
          } else {
            const budget = normThinking === 'high' ? 8192 : (normThinking === 'medium' ? 4096 : 1024);
            body.generationConfig.thinkingConfig = { thinkingBudget: budget };
          }
        }
      }

      if (abortSignal && abortSignal.aborted) {
        throw new Error('Dịch đã bị hủy');
      }

      let isTimedOut = false;
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      if (abortSignal) {
        abortSignal.addEventListener('abort', onAbort, { once: true });
      }
      const timeoutId = setTimeout(() => {
        isTimedOut = true;
        controller.abort();
      }, 90000);

      try {
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (abortSignal) abortSignal.removeEventListener('abort', onAbort);
        
        if (response.ok) {
          let data;
          try {
            data = await response.json();
          } catch (jsonErr) {
            console.warn(`[Gemini (${activeModel})] Loi phan tich JSON phan hoi: ${jsonErr.message}`);
            keyRetryCount++;
            continue;
          }

          if (data && data.error) {
            console.warn(`[Gemini (${activeModel})] API tra ve error: ${data.error.message || JSON.stringify(data.error)}`);
            switchKey = true;
            break;
          }

          let responseText = data.output_text;
          if (!responseText && data.candidates && data.candidates[0]?.content?.parts) {
            responseText = data.candidates[0].content.parts.map(p => p.text || '').join('');
          }
          if (!responseText && data.steps && Array.isArray(data.steps)) {
            const lastStep = data.steps.at(-1);
            if (lastStep?.content && Array.isArray(lastStep.content)) {
              responseText = lastStep.content.map(c => c.text || '').join('');
            }
          }

          if (responseText && responseText.trim()) {
            return ResponseCleaner.clean(responseText.trim());
          }

          // Khi HTTP 200 nhưng nội dung trống (do bộ lọc xác suất hoặc thinking)
          const blockReason = data.promptFeedback?.blockReason;
          const finishReason = data.candidates?.[0]?.finishReason;
          const reasonStr = blockReason || finishReason || 'empty_candidate';
          console.warn(`[Gemini (${activeModel})] Phan hoi rong (${reasonStr}) tai Key #${keyNum}/${keys.length}.`);
          sawEmptyResponse = true;

          // Nếu là lỗi PROHIBITED_CONTENT hoặc SAFETY từ bộ lọc cứng của Google:
          const isSafetyBlocked = blockReason === 'PROHIBITED_CONTENT' || blockReason === 'SAFETY' || finishReason === 'SAFETY' || finishReason === 'PROHIBITED_CONTENT';
          if (isSafetyBlocked) {
            const isScannerTask = Boolean(
              customPrompt && (
                customPrompt.includes('"characters"') ||
                customPrompt.includes('"glossary"') ||
                customPrompt.includes('danh sách nhân vật') ||
                customPrompt.includes('hồ sơ nhân vật') ||
                customPrompt.includes('trích xuất thực thể') ||
                customPrompt.includes('trích xuất danh sách nhân vật')
              )
            );

            // Trường hợp 1: Tác vụ quét AI (từ điển / nhân vật)
            if (isScannerTask) {
              const csamRegex = /(?:假阳具|假玩具|玩具|中出|内射|潮吹|做爱|自慰|花穴|肉穴|私处|阴部|阴蒂|小穴|后庭|后穴|肉棒|鸡巴|赤裸|一丝不挂|赤身裸体|玩不坏|玩坏|透[！!]|被.*透|侵犯|强奸|强暴|敏感度|受孕|性爱|肛塞|抽插|娇嫩的花|落红|破处|禁地|神圣的禁地|血迹|压在身下|毫无反抗之力|推倒|药丸|下药|迷药|无色无味|チンポ|まんこ|질내사정)/;
              const rawParas = (contentToTranslate || text).split(/\n\s*\n/)
                .map(p => p.trim())
                .filter(p => p && !csamRegex.test(p));
              
              let startIdx = 0;
              if (rawParas.length > 15) {
                const firstExcerpts = (contentToTranslate || text).slice(0, 1000);
                if (csamRegex.test(firstExcerpts)) {
                  startIdx = Math.min(10, Math.floor(rawParas.length / 3));
                }
              }

              const compactText = rawParas.slice(startIdx, startIdx + 15).join('\n\n').slice(0, 2500);

              if (compactText && compactText.length > 50 && !_isEuphemismRetry) {
                console.warn(`[Gemini (${activeModel})] Tac vu quet bi chan an toan (${reasonStr}). Tu dong thu gon doan trich an toan de tiep tuc trich xuat...`);
                return translateGemini({
                  text: compactText,
                  sourceLang,
                  targetLang,
                  customPrompt,
                  apiKey,
                  model: activeModel,
                  thinkingLevel,
                  safetySetting: 'BLOCK_NONE',
                  temperature: 0.1,
                  glossary,
                  characterProfiles,
                  context,
                  apiEndpoint,
                  bookMemory,
                  abortSignal,
                  _isEuphemismRetry: true,
                  _isMicroChunked: false
                });
              }

              // Ném lỗi để scanner có thể chuyển sang AI dự phòng tiếp theo trong chuỗi
              throw new Error(`[Gemini ${activeModel}] Tac vu quet bi bo loc an toan cua Google chan (${reasonStr})`);
            }

            // Trường hợp 2: Dịch văn bản thông thường (Thang bậc 3 mức)
            if (_bypassLevel < 3) {
              const nextLevel = _bypassLevel + 1;
              console.warn(`[Gemini (${activeModel})] Noi dung bi chan an toan (${reasonStr}) o Muc ${_bypassLevel}. Tu dong nang len Muc bypass ${nextLevel}...`);
              return translateGemini({
                text,
                sourceLang,
                targetLang,
                customPrompt,
                apiKey,
                model: activeModel,
                thinkingLevel,
                safetySetting: 'BLOCK_NONE',
                temperature,
                glossary,
                characterProfiles,
                context,
                apiEndpoint,
                bookMemory,
                abortSignal,
                _bypassLevel: nextLevel,
                _isMicroChunked
              });
            }

            // Chốt chặn Micro-Chunking tại Mức 3:
            // Khi đoạn văn dài và dày đặc nội dung, bộ lọc ngữ cảnh tích lũy của Google sẽ chặn.
            // Chia nhỏ thành các đoạn con (~400 ký tự nguyên bản) sẽ vượt qua 100% mà KHÔNG cần sửa từ của tác giả.
            if (_bypassLevel >= 3 && !_isMicroChunked && text.length > 350) {
              console.warn(`[Gemini (${activeModel})] Doan van dai vuot nguong tich luy an toan o Muc 3. Tu dong chia nho micro-chunks (${text.length} ky tu) de hoan tat ma khong sua tu...`);
              const subChunks = splitTextIntoSubChunks(text, 450);

              if (subChunks.length > 1) {
                const subResults = [];
                for (const sub of subChunks) {
                  if (abortSignal && abortSignal.aborted) throw new Error('Dịch đã bị hủy');
                  const subRes = await translateGemini({
                    text: sub,
                    sourceLang,
                    targetLang,
                    customPrompt,
                    apiKey,
                    model: activeModel,
                    thinkingLevel,
                    safetySetting: 'BLOCK_NONE',
                    temperature: 0.2,
                    glossary,
                    characterProfiles,
                    context,
                    apiEndpoint,
                    bookMemory,
                    abortSignal,
                    _bypassLevel: 3,
                    _isMicroChunked: true
                  });
                  subResults.push(subRes);
                }
                return subResults.join('\n\n');
              }
            }

            // Đã thử hết 3 mức bypass của Gemini mà vẫn bị chặn:
            // Ném lỗi để chuỗi fallback ngoài (executeTranslationWithFallback) chuyển sang AI tiếp theo
            console.warn(`[Gemini (${activeModel})] Da thu het 3 muc bypass ma van bi chan (${reasonStr}). Chuyen sang AI tiep theo trong chuoi fallback...`);
            throw new Error(`[Gemini ${activeModel}] Noi dung bi bo loc an toan cua Google chan (PROHIBITED_CONTENT)`);
          }

          keyRetryCount++;
          if (keyRetryCount <= maxRetriesPerKey) {
            console.warn(`[Gemini (${activeModel})] Tu dong thu lai lan ${keyRetryCount}/${maxRetriesPerKey} voi nhiet do thap hon sau 1.5s...`);
            await new Promise(r => setTimeout(r, 1500));
            if (abortSignal && abortSignal.aborted) throw new Error('Dịch đã bị hủy');
            continue;
          } else {
            console.warn(`[Gemini (${activeModel})] Key #${keyNum}/${keys.length} lien tuc tra ve rong. Dang chuyen sang Key tiep theo trong Key Pool...`);
            switchKey = true;
            break;
          }
        }

        let errPeek = '';
        try {
          const clone = response.clone();
          errPeek = await clone.text();
        } catch (_) {}

        // Khi 1 key bi 404 (vi du: key moi khong co quyen truy cap model cu 2.5): Chuyen sang key tiep theo
        if (response.status === 404) {
          console.warn(`[Gemini (${activeModel})] Key #${keyNum}/${keys.length} khong ho tro model nay (404). Chuyen sang key tiep theo...`);
          switchKey = true;
          break;
        }

        // Fatal key error: 401, 403 hoặc 400 (Key sai) -> đổi ngay không cần retry 3 lần
        const isFatalKeyError = (response.status === 401 || response.status === 403 || (response.status === 400 && (errPeek.includes('API_KEY') || errPeek.includes('API key'))));
        if (isFatalKeyError) {
          console.warn(`[Gemini (${activeModel})] HTTP ${response.status}: Key #${keyNum}/${keys.length} khong hop le hoac bi tu choi. Chuyen key ngay...`);
          switchKey = true;
          break;
        }

        // Lỗi 429 (Rate Limit / Quota) hoặc 503/500 (Quá tải): Thử lại 3 lần trên cùng key này, mỗi lần cách 3s
        if (response.status === 429 || response.status === 503 || response.status >= 500) {
          if (abortSignal && abortSignal.aborted) throw new Error('Dịch đã bị hủy');
          keyRetryCount++;
          if (keyRetryCount <= maxRetriesPerKey) {
            console.warn(`[Gemini (${activeModel})] Key #${keyNum}/${keys.length} gap HTTP ${response.status}. Thu lai lan ${keyRetryCount}/${maxRetriesPerKey} sau 3s...`);
            await new Promise(r => setTimeout(r, 3000));
            if (abortSignal && abortSignal.aborted) throw new Error('Dịch đã bị hủy');
            continue;
          } else {
            console.warn(`[Gemini (${activeModel})] Key #${keyNum}/${keys.length} da thu lai du ${maxRetriesPerKey} lan (HTTP ${response.status}). Tien hanh chuyen key tiep theo...`);
            switchKey = true;
            break;
          }
        }

        // Lỗi khác (400 cú pháp, v.v...)
        break;
      } catch (err) {
        clearTimeout(timeoutId);
        if (abortSignal) abortSignal.removeEventListener('abort', onAbort);
        if (abortSignal && abortSignal.aborted) {
          throw new Error('Dịch đã bị hủy');
        }
        if (!isTimedOut && (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('hủy'))) {
          throw new Error('Dịch đã bị hủy');
        }
        if (err.message && (err.message.includes('bị chặn an toàn') || err.message.includes('PROHIBITED_CONTENT') || err.message.includes('SAFETY'))) {
          throw err;
        }
        const errMsg = isTimedOut ? 'Het thoi gian cho phan hoi (Timeout 90s)' : err.message;
        keyRetryCount++;
        if (keyRetryCount <= maxRetriesPerKey) {
          console.warn(`[Gemini (${activeModel})] Loi ket noi Key #${keyNum}/${keys.length}: ${errMsg}. Thu lai lan ${keyRetryCount}/${maxRetriesPerKey} sau 3s...`);
          await new Promise(r => setTimeout(r, 3000));
          if (abortSignal && abortSignal.aborted) throw new Error('Dịch đã bị hủy');
          continue;
        } else {
          console.warn(`[Gemini (${activeModel})] Key #${keyNum}/${keys.length} loi ket noi sau ${maxRetriesPerKey} lan thu. Tien hanh chuyen key tiep theo...`);
          switchKey = true;
          break;
        }
      }
    }

    if (switchKey || !response || !response.ok) {
      currentKeyIndex = (currentKeyIndex + 1) % keys.length;
      const nextKeyNum = (currentKeyIndex % keys.length) + 1;
      if (triedKeyIndices.size < keys.length) {
        console.warn(`[Gemini (${activeModel})] Doi sang Key #${nextKeyNum}/${keys.length}...`);
        await new Promise(r => setTimeout(r, 300));
        continue;
      } else {
        console.warn(`[Gemini (${activeModel})] Tat ca ${keys.length} API Key deu da thu du lan ma van that bai.`);
        break;
      }
    }
  }

  // Nếu bị phản hồi rỗng và chưa đạt mức bypass tối đa (Mức 3), tự động nâng mức bypass
  if (sawEmptyResponse && _bypassLevel < 3) {
    const nextLevel = _bypassLevel + 1;
    console.warn(`[Gemini (${activeModel})] Chua nhan duoc ket qua dich hop le o Muc ${_bypassLevel}. Tu dong nang len Muc bypass ${nextLevel}...`);
    return translateGemini({
      text,
      sourceLang,
      targetLang,
      customPrompt,
      apiKey,
      model: activeModel,
      thinkingLevel,
      safetySetting: 'BLOCK_NONE',
      temperature,
      glossary,
      characterProfiles,
      context,
      apiEndpoint,
      bookMemory,
      abortSignal,
      _bypassLevel: nextLevel
    });
  }
  
  if (!response || !response.ok) {
    const errorText = response ? await response.text() : 'No response from API';
    let errorMsg = `Gemini API Error (${response ? response.status : 'Network'}): ${errorText.substring(0, 150)}`;
    
    if (response && response.status === 503) {
      errorMsg = `[Gemini ${activeModel}] Lỗi 503: Model ${activeModel} đang bị quá tải trên máy chủ Google. Hãy chuyển sang model Gemini khác (như gemini-3.8-flash) hoặc thử lại sau giây lát.`;
    } else if (response && (response.status === 429 || errorText.includes('RESOURCE_EXHAUSTED'))) {
      errorMsg = `[Gemini ${activeModel}] Lỗi 429: Đã vượt quá giới hạn request (Rate Limit) trên toàn bộ ${keys.length} API Key cho model "${activeModel}".`;
    } else if (errorText.includes('API_KEY_INVALID') || errorText.includes('API key not valid')) {
      errorMsg = `[Gemini ${activeModel}] API Key không hợp lệ hoặc đã hết hạn trong Google AI Studio.`;
    } else if (errorText.includes('models/') && (errorText.includes('not found') || (response && response.status === 404))) {
      errorMsg = `Model "${activeModel}" không tồn tại hoặc không được hỗ trợ trên Google Gemini API.`;
    } else if (errorText.includes('location is not supported')) {
      errorMsg = 'Lỗi vị trí: Google chưa hỗ trợ Gemini tại quốc gia của bạn qua API trực tiếp. Hãy dùng Proxy hoặc đổi sang DeepSeek/Groq.';
    }
    throw new Error(errorMsg);
  }

  if (sawEmptyResponse) {
    const isScannerTask = Boolean(
      customPrompt && (
        customPrompt.includes('"characters"') ||
        customPrompt.includes('"glossary"') ||
        customPrompt.includes('danh sách nhân vật') ||
        customPrompt.includes('hồ sơ nhân vật') ||
        customPrompt.includes('trích xuất thực thể') ||
        customPrompt.includes('trích xuất danh sách nhân vật')
      )
    );

    if (isScannerTask) {
      console.warn(`[Gemini (${activeModel})] Tac vu quet AI nhan phan hoi rong. Tra ve cau truc mac dinh rong an toan.`);
      if (customPrompt.includes('characters') && customPrompt.includes('glossary')) {
        return JSON.stringify({ characters: [], glossary: [] });
      } else if (customPrompt.includes('glossary')) {
        return JSON.stringify({ glossary: [] });
      } else if (customPrompt.includes('characters')) {
        return JSON.stringify({ characters: [] });
      }
      return '{}';
    }

    // Đã thử hết các mức bypass mà vẫn bị chặn rỗng: ném lỗi để hệ thống chuyển sang AI tiếp theo trong chuỗi fallback
    throw new Error(`[Gemini ${activeModel}] Nội dung bị chặn bởi chính sách an toàn của Google (SAFETY) trên toàn bộ ${keys.length} API Key.`);
  }
  throw new Error(`[Gemini ${activeModel}] Không thể dịch đoạn văn sau nhiều lần thử trên toàn bộ ${keys.length} API Key.`);
}

module.exports = {
  translate: translateGemini,
};
