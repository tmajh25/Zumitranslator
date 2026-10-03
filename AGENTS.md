# ZumiTranslator - Quy tắc phát triển & Bảo trì cho AI Agents

## 1. Quy tắc về AI Models & API
**QUY TẮC BẮT BUỘC: Trước khi thêm, sửa hoặc xóa bất kỳ model nào của bất kỳ nhà cung cấp nào, AI Agent BẮT BUỘC phải tra cứu tài liệu chính thức từ các liên kết dưới đây. TUYỆT ĐỐI KHÔNG tự ý xóa, hạ cấp hoặc thay thế model dựa trên suy đoán.**

* **Google Gemini**: https://ai.google.dev/gemini-api/docs/models
  - Dòng Gemini 3 (`gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite`, `gemini-3-flash-preview`) và dòng Gemini 2.5 (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.5-flash-lite`) là các model chính thức từ Google.
* **OpenAI**: https://platform.openai.com/docs/models
* **DeepSeek**: https://api-docs.deepseek.com/
* **Groq Cloud**: https://console.groq.com/docs/models
* **OpenRouter**: https://openrouter.ai/models
* **Cerebras Cloud**: https://inference-docs.cerebras.ai/models
* **DeepL**: https://developers.deepl.com/docs/api-reference/translate
* **Google Cloud Translation**: https://cloud.google.com/translate/docs

## 2. Quy tắc Hồ sơ nhân vật & Xưng hô
- Hồ sơ nhân vật hiển thị dưới dạng **Bảng (Table View)** thống nhất với các cột:
  1. **Checkbox**: Bật/tắt áp dụng nhân vật khi AI dịch.
  2. **Tên gốc** (`originalName`): Tên gốc của nhân vật trong nguyên tác (tiếng Trung, Nhật, Hàn, Anh...).
  3. **Tên dịch** (`translatedName`): Tên dịch hoặc phiên âm chuẩn tiếng Việt (hoặc Romaji cho Light Novel Nhật).
  4. **Giới tính** (`gender`): Nam / Nữ / Phi giới tính / Khác.
  5. **Mối quan hệ & Vai trò** (`relationship`): Quan hệ, thân phận, vai trò của nhân vật.
  6. **Xưng hô** (`pronounRules`): Bảng con trong ô xưng hô, mỗi đối tượng giao tiếp là 1 hàng gồm:
     - **Với ai** (`target`): Đối tượng / người nghe mà nhân vật này nói chuyện cùng.
     - **Tự xưng** (`self`): Từ nhân vật này tự xưng khi nói với đối phương.
     - **Gọi đối phương** (`others`): Từ nhân vật này dùng để gọi đối phương.
     - Kèm nút `✕` xóa hàng và nút `+ Thêm xưng hô` để thêm đối tượng đối thoại mới.
  7. **Ghi chú** (`note`): Ghi chú bổ sung khi dịch cho nhân vật này.
  8. **✕**: Nút xóa toàn bộ nhân vật.
