/**
 * Google Translate (Free client=dict-chrome-ex endpoint)
 * Uses POST to avoid HTTP 414 / URI length limit on large text chunks
 * Supports 3 retries (3s delay each) on HTTP 429 or network errors
 */

async function translateGoogleFree({ text, sourceLang = 'auto', targetLang = 'vi', abortSignal = null }) {
  const url = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=${sourceLang}&tl=${targetLang}&dt=t`;
  
  let retryCount = 0;
  const maxRetries = 3;
  let response;

  while (retryCount <= maxRetries) {
    if (abortSignal && abortSignal.aborted) {
      throw new Error('Dịch đã bị hủy');
    }

    const controller = new AbortController();
    const onAbort = () => controller.abort();
    if (abortSignal) {
      abortSignal.addEventListener('abort', onAbort, { once: true });
    }
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
        },
        body: new URLSearchParams({ q: text }).toString(),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (abortSignal) abortSignal.removeEventListener('abort', onAbort);

      if (response.ok) break;

      if (response.status === 429 && retryCount < maxRetries) {
        if (abortSignal && abortSignal.aborted) throw new Error('Dịch đã bị hủy');
        retryCount++;
        console.warn(`[Google Free] HTTP 429 (Rate Limit). Thu lai lan ${retryCount}/${maxRetries} sau 3s...`);
        await new Promise(r => setTimeout(r, 3000));
        if (abortSignal && abortSignal.aborted) throw new Error('Dịch đã bị hủy');
        continue;
      }

      break;
    } catch (networkErr) {
      clearTimeout(timeoutId);
      if (abortSignal) abortSignal.removeEventListener('abort', onAbort);
      if (abortSignal && abortSignal.aborted) {
        throw new Error('Dịch đã bị hủy');
      }
      if (retryCount < maxRetries) {
        retryCount++;
        console.warn(`[Google Free] Loi mang/timeout (${networkErr.message}). Thu lai lan ${retryCount}/${maxRetries} sau 3s...`);
        await new Promise(r => setTimeout(r, 3000));
        if (abortSignal && abortSignal.aborted) throw new Error('Dịch đã bị hủy');
        continue;
      }
      throw networkErr;
    }
  }

  if (!response || !response.ok) {
    const errorText = response ? await response.text() : 'No response';
    if (response && response.status === 400) {
      throw new Error('Đoạn văn quá dài đối với Google Miễn phí. Hãy giảm "Kích thước chunk" xuống dưới 2000 trong Cài đặt.');
    }
    if (response && response.status === 429) {
      throw new Error('Google Miễn phí đang giới hạn tần suất dịch sau 3 lần thử. Hãy tăng "Delay giữa các request" trong Cài đặt hoặc dùng API Key.');
    }
    throw new Error(`Google API Error (${response ? response.status : 'Network'}): ${errorText.substring(0, 100)}`);
  }
  
  const data = await response.json();
  
  let translated = '';
  if (data && data[0]) {
    for (const segment of data[0]) {
      if (segment[0]) translated += segment[0];
    }
  }
  return translated;
}

module.exports = {
  translate: translateGoogleFree,
};
