# ZumiTranslator

<p align="center">
  <strong>Ứng dụng dịch thuật văn bản và sách điện tử thông minh hỗ trợ đa nền tảng AI</strong><br>
  Tối ưu hóa chuyên sâu cho dịch tiểu thuyết, Light Novel, Web Novel, tài liệu văn học và tệp định dạng lớn.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-v41.2.0-47848F?logo=electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/AI%20Providers-Gemini%20%7C%20OpenAI%20%7C%20DeepSeek%20%7C%20Groq%20%7C%20Cerebras-blueviolet" alt="AI Providers">
  <img src="https://img.shields.io/badge/Formats-EPUB%20%7C%20DOCX%20%7C%20TXT-orange" alt="Formats">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

---

## Giới thiệu

ZumiTranslator là ứng dụng desktop xây dựng trên Electron, tích hợp trực tiếp với các mô hình ngôn ngữ lớn (LLM) phổ biến cùng hệ thống công cụ biên tập chuyên sâu. Ứng dụng giải quyết các bài toán đặc thù trong dịch thuật văn chương: tính nhất quán của hệ thống nhân vật, ma trận xưng hô biến hóa theo bối cảnh đối thoại, bộ lọc tránh từ chối dịch từ phía AI và bảo toàn nguyên vẹn cấu trúc sách điện tử (EPUB, DOCX, TXT).

---

## Tính năng chính

### 1. Đa dạng nhà cung cấp AI
- **Google Gemini**: Hỗ trợ dòng Gemini 2.5 (`gemini-2.5-flash`, `gemini-2.5-pro`) và dòng Gemini 3.x (`gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.1-pro-preview`...).
- **OpenAI**: Hỗ trợ các mô hình GPT-4o, GPT-5/6 và mô hình suy luận (Reasoning models).
- **DeepSeek**: Hỗ trợ DeepSeek-V3 và DeepSeek-R1 cho dịch thuật ngữ cảnh phức tạp.
- **Groq & Cerebras Cloud**: Tốc độ xử lý siêu nhanh, tối ưu cho xử lý hàng loạt chương.
- **OpenRouter & Custom API**: Hỗ trợ kết nối các mô hình mã nguồn mở và endpoint chuẩn OpenAI-compatible.
- **DeepL & Google Translate**: Hỗ trợ dịch máy truyền thống và Google Dịch miễn phí.

### 2. Quản lý API Key (Key Pool) và Cơ chế Fallback
- **Key Pool**: Lưu trữ và tự động xoay vòng (Round-robin) nhiều API Key cho mỗi nhà cung cấp, giúp phân tán tải và phòng tránh lỗi giới hạn tần suất (Rate Limit 429).
- **Fallback Chain**: Tự động chuyển đổi sang model hoặc nhà cung cấp dự phòng khi dịch vụ chính gặp sự cố, đảm bảo phiên dịch không bị gián đoạn.
- **Kiểm tra kết nối trực tiếp**: Đo độ trễ (latency), xác thực tính hợp lệ của key và hiển thị trạng thái kết nối.

### 3. Hồ sơ nhân vật và Ma trận xưng hô
- **Quản lý danh sách nhân vật**: Lưu trữ tên gốc, tên dịch, giới tính, thân phận, vai trò và ghi chú khi dịch.
- **Ma trận xưng hô theo đối tượng**: Thiết lập cách nhân vật tự xưng (`self`) và gọi đối phương (`others`) ứng với từng nhân vật mục tiêu (`target`), đảm bảo văn phong phù hợp với từng thể loại (kiếm hiệp, tiên hiệp, hiện đại, viễn tưởng).
- **Character Scanner**: Tự động quét và phát hiện các nhân vật xuất hiện trong từng chương để đưa vào ngữ cảnh dịch.

### 4. Từ điển thuật ngữ (Glossary)
- Quản lý từ điển riêng cho từng tác phẩm: địa danh, môn phái, chiêu thức, cảnh giới, danh xưng.
- **Glossary Scanner**: Nhận diện thuật ngữ xuất hiện trong văn bản nguồn để cố định nghĩa dịch xuyên suốt tác phẩm.

### 5. Xử lý tệp và Sách điện tử (EPUB, DOCX, TXT)
- **EPUB-Forge**: Đọc và bóc tách cấu trúc file EPUB, bảo toàn mục lục (TOC), hình ảnh minh họa, trang bìa và định dạng CSS.
- **DOCX & TXT**: Bóc tách tài liệu Microsoft Word (.docx) và tự động nhận diện chia chương theo biểu thức chính quy (Regex) đối với file văn bản (.txt).
- **Xuất tệp**: Xuất bản trực tiếp sang EPUB tối ưu, DOCX hoặc TXT phân chương.

### 6. Bộ lọc kiểm duyệt và Uyển ngữ (Euphemism Filter)
- **R18 Detector**: Cảnh báo sớm các đoạn văn có nguy cơ kích hoạt bộ lọc kiểm duyệt nội dung của nhà cung cấp AI.
- **Euphemism Filter**: Tự động mã hóa, thay thế các từ ngữ nhạy cảm trước khi gửi API và khôi phục lại sau khi dịch xong, tránh hiện tượng AI từ chối phản hồi.

### 7. Không gian làm việc và Giám sát tiến trình
- **Kệ sách (Bookshelf)**: Quản lý danh mục nhiều đầu sách và theo dõi tiến độ tổng quan.
- **Trình biên tập song ngữ (Bilingual Editor)**: Màn hình đối chiếu song song giữa bản gốc và bản dịch, cho phép chỉnh sửa trực tiếp từng phân đoạn.
- **Bảng giám sát (Inspector)**: Theo dõi log giao tiếp API, số token tiêu thụ, chi phí ước tính và tốc độ dịch theo thời gian thực.
- **Tùy biến giao diện (Appearance)**: Hỗ trợ chế độ sáng/tối, lựa chọn phông chữ tiếng Việt (Inter, Be Vietnam Pro, Merriweather, Fira Code), tùy chỉnh kích cỡ chữ và độ bo góc.

---

## Cài đặt và Khởi chạy

### Yêu cầu hệ thống
- Node.js phiên bản 18.0.0 trở lên.
- Quản lý gói npm (đi kèm Node.js).

### Các bước cài đặt

1. Tải mã nguồn về máy:
   ```bash
   git clone https://github.com/<your-username>/ZumiTranslator.git
   cd ZumiTranslator
   ```

2. Cài đặt các gói phụ thuộc:
   ```bash
   npm install
   ```

3. Khởi chạy ứng dụng:
   ```bash
   npm start
   ```

---

## Quy trình sử dụng

1. **Cấu hình API**:
   - Truy cập **Cài đặt** (Settings) -> Chọn nhà cung cấp mong muốn -> Nhập API Key vào **Key Pool**.
   - Bấm **Kiểm tra kết nối** để xác minh trạng thái hoạt động.

2. **Thêm tác phẩm**:
   - Vào mục **Kệ sách** (Bookshelf) -> Thêm tệp `.epub`, `.docx` hoặc `.txt`.
   - Hệ thống tự động phân tích và tạo danh sách chương.

3. **Thiết lập Nhân vật và Từ điển**:
   - Khai báo tên nhân vật và quy tắc xưng hô tại tab **Hồ sơ nhân vật**.
   - Thêm các thuật ngữ cần dịch cố định tại tab **Từ điển**.

4. **Tiến hành dịch và Xuất bản**:
   - Chọn chương cần dịch hoặc chạy dịch toàn bộ tác phẩm.
   - Kiểm tra, biên tập nội dung trên trình soạn thảo song ngữ.
   - Nhấn **Xuất sách** để tạo tệp EPUB, DOCX hoặc TXT hoàn thiện.

---

## Cấu trúc thư mục

```text
ZumiTranslator/
├── assets/                  # Biểu tượng, logo nhà cung cấp và tài nguyên giao diện
├── renderer/                # Giao diện người dùng (Frontend Electron)
│   ├── css/                 # Kiểu dáng CSS theo từng module
│   ├── js/                  # Logic xử lý giao diện
│   │   ├── ai/              # Module kết nối các nhà cung cấp AI
│   │   ├── character/       # Quản lý hồ sơ nhân vật và xưng hô
│   │   ├── controllers/     # Bộ điều phối sự kiện giao diện
│   │   ├── glossary/        # Quét và xử lý từ điển thuật ngữ
│   │   ├── translation/     # Xử lý ngữ cảnh dịch và hậu kiểm
│   │   └── workspace/       # Không gian làm việc song ngữ
│   ├── partials/            # Các thành phần HTML module hóa
│   └── index.html           # Khung ứng dụng chính
├── services/                # Tiến trình xử lý dữ liệu nền (Node.js/Electron)
│   ├── file/                # Xử lý tệp EPUB, DOCX, TXT
│   └── translators/         # Adapter API, bộ lọc uyển ngữ, chuẩn hóa kết quả
├── main.js                  # Main Process của Electron
├── preload.js               # IPC Bridge bảo mật giữa Main và Renderer
└── package.json             # Danh mục gói và cấu hình dự án
```

---

## Đóng góp phát triển

1. Fork repository.
2. Tạo nhánh tính năng mới (`git checkout -b feature/ten-tinh-nang`).
3. Commit các thay đổi (`git commit -m "Mo ta tinh nang"`).
4. Push nhánh lên repository cá nhân (`git push origin feature/ten-tinh-nang`).
5. Tạo Pull Request để xem xét tích hợp.

---

## Giấy phép

Dự án được phát hành theo giấy phép [MIT](LICENSE).