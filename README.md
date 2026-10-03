# ZumiTranslator

<p align="center">
  <strong>Intelligent Multi-Platform AI Translation & eBook Processing Suite</strong><br>
  Engineered specifically for web novels, light novels, literary works, and large-format documents.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-v41.2.0-47848F?logo=electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/AI%20Providers-Gemini%20%7C%20OpenAI%20%7C%20DeepSeek%20%7C%20Groq%20%7C%20Cerebras-blueviolet" alt="AI Providers">
  <img src="https://img.shields.io/badge/Formats-EPUB%20%7C%20DOCX%20%7C%20TXT-orange" alt="Formats">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

---

## Overview

ZumiTranslator is a desktop application built on Electron, seamlessly integrating state-of-the-art Large Language Models (LLMs) with specialized literary editing workflows. It resolves critical challenges inherent in literary translation: character voice consistency, contextual pronoun mapping, automated euphemism filtering to bypass AI safety refusals, and deep structural preservation of eBooks (EPUB, DOCX, TXT).

---

## Key Features

### 1. Multi-Provider AI Support
- **Google Gemini**: Full support for Gemini 2.5 (`gemini-2.5-flash`, `gemini-2.5-pro`) and Gemini 3.x series (`gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.1-pro-preview`, etc.).
- **OpenAI**: Integrates GPT-4o, next-gen reasoning models, and standard OpenAI endpoints.
- **DeepSeek**: Supports DeepSeek-V3 and DeepSeek-R1 for deep contextual reasoning and stylistic fidelity.
- **Groq & Cerebras Cloud**: Ultra-high throughput inference optimized for rapid multi-chapter batch processing.
- **OpenRouter & Custom Endpoints**: Connect to hundreds of open-source models via any OpenAI-compatible API.
- **DeepL & Google Translate**: Integrated traditional machine translation and free Google Translate fallback.

### 2. Key Pool Management & Fallback Chain
- **Key Pool**: Store and automatically cycle through multiple API keys per provider in a round-robin schedule, mitigating rate limits (HTTP 429) across concurrent jobs.
- **Hierarchical Fallback Chain**: Automatically shifts to secondary models or providers on quota exhaustion or network timeouts, preventing workflow interruptions.
- **Live Latency & Verification**: Real-time ping diagnostics to inspect API key validity, latency, and model availability.

### 3. Character Profiles & Dynamic Pronoun Matrix
- **Entity Management**: Register original names, localized names, gender, relationship hierarchy, roles, and translation notes.
- **Contextual Pronoun Matrix**: Define how a character refers to themselves (`self`) and addresses interlocutors (`others`) relative to specific conversation partners (`target`), preserving complex honorifics and period-accurate vernaculars.
- **Automated Character Scanner**: Scans chapters to detect present characters and inject tailored contextual memory directly into prompts.

### 4. Specialized Terminology (Book Glossary)
- Dedicated per-volume or global glossaries for martial arts realms, artifact names, factions, spells, and geographical locations.
- **Glossary Scanner**: Automatically identifies and reinforces required terminology across every chapter.

### 5. Document & eBook Processing (EPUB-Forge, DOCX, TXT)
- **EPUB-Forge**: In-depth parsing that preserves complete EPUB structures (NCX/Nav tables of contents, embedded illustrations, cover images, and CSS stylesheets).
- **DOCX & TXT Parsing**: Robust Microsoft Word (.docx) ingestion and intelligent regex-driven chapter splitting for raw text (.txt).
- **Production-Ready Export**: Export cleanly formatted, size-optimized EPUB files, DOCX documents, or segmented TXT files.

### 6. Safety Moderation & Euphemism Filter
- **R18 Content Detector**: Flags mature, graphic, or sensitive segments that risk triggering upstream LLM safety filters.
- **Euphemism Engine**: Automatically masks sensitive phrasing with contextual euphemisms prior to API dispatch, then seamlessly restores the authentic narrative post-translation.

### 7. Chapter Workspace & Real-Time Telemetry
- **Bookshelf Dashboard**: Manage multiple concurrent translation projects with visual covers and progress trackers.
- **Bilingual Side-by-Side Editor**: Dual-pane workspace allowing real-time comparison and manual refinement of individual paragraphs.
- **Inspector Modal**: Live telemetry tracking token consumption, latency, estimated costs, and translation speed (tokens/sec).
- **Appearance Customizer**: Dark/Light mode, fine-tuned typography (Inter, Be Vietnam Pro, Merriweather, Fira Code), customizable font scale, and corner radius styling.

---

## Installation & Setup

### Prerequisites
- Node.js version 18.0.0 or higher.
- npm (bundled with Node.js).

### Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/tmajh25/Zumitranslator.git
   cd Zumitranslator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch the application:
   ```bash
   npm start
   ```

---

## Standard Workflow

1. **Configure API Credentials**:
   - Navigate to **Settings** -> Select your desired AI provider -> Add one or more keys into the **Key Pool**.
   - Click **Test Connection** to confirm latency and status.

2. **Import Book**:
   - Open **Bookshelf** -> Drag and drop or select an `.epub`, `.docx`, or `.txt` file.
   - The parser automatically segments and indexes all chapters.

3. **Configure Profiles & Terminology**:
   - Configure character names and honorifics under **Character Profiles**.
   - Add locked proper nouns and domain terms under **Glossary**.

4. **Translate & Export**:
   - Translate individual chapters or initiate bulk batch translation.
   - Inspect and edit outputs in the bilingual editor.
   - Click **Export** to generate the final EPUB, DOCX, or TXT file.

---

## Project Structure

```text
ZumiTranslator/
├── assets/                  # Application logos, provider badges, and UI icons
├── renderer/                # Electron frontend user interface
│   ├── css/                 # Modular stylesheet hierarchy
│   ├── js/                  # Client-side state and UI logic
│   │   ├── ai/              # AI provider integration clients
│   │   ├── character/       # Character profile and pronoun matrix modules
│   │   ├── controllers/     # UI event controllers (Bookshelf, Settings, File...)
│   │   ├── glossary/        # Terminology scanner and glossary manager
│   │   ├── translation/     # Context assembling and post-processing
│   │   └── workspace/       # Split-pane bilingual workspace
│   ├── partials/            # Modular HTML component partials
│   └── index.html           # Main application window template
├── services/                # Electron main-process backend services
│   ├── file/                # EPUB, DOCX, and TXT file handlers and optimizers
│   └── translators/         # Translation adapters, prompt builders, euphemism filters
├── main.js                  # Electron application entry point
├── preload.js               # Secure IPC bridge between Main and Renderer
└── package.json             # Project manifest and dependency specifications
```

---

## Contributing

Contributions, issue reports, and feature proposals are welcome:
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/your-feature-name`).
3. Commit your changes (`git commit -m "Add descriptive commit message"`).
4. Push to your branch (`git push origin feature/your-feature-name`).
5. Submit a **Pull Request**.

---

## License

This project is licensed under the [MIT License](LICENSE).