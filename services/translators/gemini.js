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

let currentKeyIndex = 0;

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
  _isEuphemismRetry = false
}) {
  const keys = parseApiKeys(apiKey);
  if (keys.length === 0) {
    throw new Error('Vui lòng nhập API Key cho Google Gemini trong Cài đặt.');
  }

  const baseUrl = apiEndpoint || 'https://generativelanguage.googleapis.com';
  let activeModel = model || 'gemini-3.8-flash';

  const r18Detection = R18Detector.detect(text, sourceLang);
  const isAdultContent = r18Detection.isR18 || _isEuphemismRetry;
  const effectiveSafetySetting = isAdultContent ? 'BLOCK_NONE' : safetySetting;

  const instructions = PromptBuilder.buildSystemInstruction({
    customPrompt,
    sourceLang,
    targetLang,
    glossary,
    characterProfiles,
    bookMemory,
    context,
    text
  });

  // Ưu tiên dịch trực tiếp 100% văn bản gốc để bảo toàn đúng từng từ ngữ và phong cách ban đầu của tác giả.
  // Chỉ kích hoạt chuyển đổi uyển ngữ (EuphemismFilter) khi là lượt thử lại khẩn cấp (_isEuphemismRetry) nếu bộ lọc an toàn của Google chặn.
  const contentToTranslate = _isEuphemismRetry ? EuphemismFilter.mask(text, sourceLang) : text;

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

      const userTemp = parseFloat(temperature);
      const safeTemp = isNaN(userTemp) ? 0.7 : userTemp;
      // Nội dung 18+: giới hạn nhiệt độ <= 0.4 để giảm dao động ngẫu nhiên gây bị chặn
      const baseTemp = isAdultContent ? Math.min(safeTemp, 0.4) : safeTemp;
      const effectiveTemp = Math.max(0.1, baseTemp - (keyRetryCount * 0.1));

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

      const controller = new AbortController();
      const onAbort = () => controller.abort();
      if (abortSignal) {
        abortSignal.addEventListener('abort', onAbort, { once: true });
      }
      const timeoutId = setTimeout(() => controller.abort(), 90000);

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
            console.warn(`[Gemini (${activeModel})] Lỗi phân tích JSON phản hồi: ${jsonErr.message}`);
            keyRetryCount++;
            continue;
          }

          if (data && data.error) {
            console.warn(`[Gemini (${activeModel})] API trả về error: ${data.error.message || JSON.stringify(data.error)}`);
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
          console.warn(`[Gemini (${activeModel})] Phản hồi rỗng (${reasonStr}) tại Key #${keyNum}/${keys.length}.`);
          sawEmptyResponse = true;

          keyRetryCount++;
          if (keyRetryCount <= maxRetriesPerKey) {
            console.warn(`[Gemini (${activeModel})] Tự động thử lại lần ${keyRetryCount}/${maxRetriesPerKey} với nhiệt độ thấp hơn sau 1.5s...`);
            await new Promise(r => setTimeout(r, 1500));
            if (abortSignal && abortSignal.aborted) throw new Error('Dịch đã bị hủy');
            continue;
          } else {
            console.warn(`[Gemini (${activeModel})] Key #${keyNum}/${keys.length} liên tục trả về rỗng. Đang chuyển sang Key tiếp theo trong Key Pool...`);
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
        keyRetryCount++;
        if (keyRetryCount <= maxRetriesPerKey) {
          console.warn(`[Gemini (${activeModel})] Loi ket noi Key #${keyNum}/${keys.length}: ${err.message}. Thu lai lan ${keyRetryCount}/${maxRetriesPerKey} sau 3s...`);
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

  // Nếu chưa có lần thử uyển ngữ R18 nào, tự động kích hoạt uyển ngữ và thử lại toàn bộ Key Pool
  if (!_isEuphemismRetry && sawEmptyResponse) {
    console.warn(`[Gemini (${activeModel})] Chưa nhận được kết quả dịch hợp lệ. Tự động kích hoạt chuyển đổi uyển ngữ văn học (R18 Bypass) và thử lại toàn bộ Key Pool...`);
    const maskedText = EuphemismFilter.mask(text, sourceLang);
    return translateGemini({
      text: maskedText,
      sourceLang,
      targetLang,
      customPrompt,
      apiKey,
      model: activeModel,
      thinkingLevel,
      safetySetting: 'BLOCK_NONE',
      temperature: 0.3,
      glossary,
      characterProfiles,
      context,
      apiEndpoint,
      bookMemory,
      abortSignal,
      _isEuphemismRetry: true
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

  throw new Error(`[Gemini ${activeModel}] Không thể dịch đoạn văn sau nhiều lần thử trên toàn bộ ${keys.length} API Key.`);
}

module.exports = {
  translate: translateGemini,
};
