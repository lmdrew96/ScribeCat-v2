# ScribeCat v2

> ScribeCat scribes and is cat. 🐱✨

**A powerful desktop application for recording lectures, meetings, and conversations with real-time transcription, intelligent note-taking, and 9 AI-powered study tools.**

Built with Electron, TypeScript, and modern web technologies, ScribeCat combines high-quality audio recording with AssemblyAI's real-time transcription, a rich text editor powered by Tiptap, and Claude AI integration for comprehensive study assistance including flashcards, quizzes, summaries, concept maps, and personalized study plans.

---

## ✨ Features

### 🎙️ Recording & Transcription
- **High-Quality Audio Recording** with real-time VU meter and waveform visualization
- **Real-Time Speech-to-Text** via AssemblyAI with customizable accuracy settings
- **Pause/Resume** functionality with accurate timestamp tracking
- **Audio Playback** synchronized with transcription timestamps
- **Multiple Input Devices** - select any microphone or audio input

### 📝 Note-Taking
- **Rich Text Editor** powered by Tiptap with extensive formatting options
- **Auto-Save** - notes are automatically saved every 2 seconds while typing
- **Synchronized Notes** - notes are linked to recording sessions
- **Text Formatting** - bold, italic, underline, strikethrough, subscript, superscript
- **Lists & Structure** - bullet lists, numbered lists, blockquotes, code blocks
- **Text Alignment** - left, center, right, justify
- **Undo/Redo** with full history
- **Tables** - insert and edit tables with row/column controls

### 🎓 Study Mode
- **Session Browser** - view all your recorded sessions with search and filtering
- **Integrated Playback** - listen to recordings while viewing transcriptions and notes
- **AI Chat** - ask questions about your transcriptions and notes using Claude AI
- **Canvas LMS Integration** - organize sessions by course
- **Export Options** - export to PDF, DOCX, TXT, HTML, or Markdown
- **Google Drive Export** - directly save exports to your Google Drive

### 🤖 AI-Powered Study Tools
ScribeCat includes **9 innovative AI study tools** powered by Claude AI, designed to help you master your content:

**Content Analysis:**
- **Summary Generator** - Comprehensive summaries with session attribution for multi-session study sets
- **Key Concepts Extractor** - Extracts 5-7 most important concepts with clear definitions
- **Weak Spots Detector** - Identifies difficult concepts with severity levels and mini-lessons

**Active Learning:**
- **Flashcard Generator** - Interactive flashcards (5-7 for single sessions, 8-12 for multi-session)
- **Quiz Generator** - Multiple-choice quizzes with configurable question counts (5/10/15/20)
- **Learn Mode** - Spaced repetition learning with progress tracking (Quizlet-style)

**Advanced Tools:**
- **ELI5 Explainer** - "Explain Like I'm 5" simple explanations using analogies
- **Concept Map** - Visual hierarchical mind maps showing topic relationships
- **Study Plan Generator** - Personalized day-by-day study schedules with time allocations

All tools support both single-session and multi-session study sets, with AI-powered content generation and interactive UI.

### 🎨 Customization
- **40 Beautiful Themes** across 5 categories, each with light and dark variants:
  - **Calm** (8 themes) - Peaceful, serene color palettes for distraction-free work
  - **Energetic** (8 themes) - Vibrant, dynamic colors to keep you motivated
  - **Focus** (8 themes) - Optimized for concentration and productivity
  - **Creative** (8 themes) - Inspiring palettes for brainstorming and ideation
  - **Balanced** (8 themes) - Versatile themes suitable for any task
- **Light & Dark Variants** - Every theme has both light and dark mode versions
- **Theme Persistence** - Your theme preference is automatically saved

### ☁️ Cloud & Sharing
- **Cloud Sync** via Supabase - access your sessions across devices
- **Session Sharing** - share recordings with others via secure links
- **Permission Management** - control who can view or edit shared sessions
- **Real-Time Collaboration** - shared sessions update automatically
- **Authentication** - secure sign-in with email/password

### 🗑️ Organization
- **Trash System** - deleted sessions are moved to trash (30-day retention)
- **Restore Deleted Sessions** - recover sessions from trash before permanent deletion
- **Auto-Cleanup** - trash is automatically emptied after 30 days
- **Course Organization** - tag sessions with course information

### 🔒 Security & Privacy
- **Local-First** - recordings and notes stored locally on your device
- **Optional Cloud Sync** - you choose what to sync
- **API Key Security** - keys are embedded at build time, never exposed
- **Context Isolation** - Electron security best practices
- **No Telemetry** - no tracking or analytics

---

## 📦 Installation

### For End Users

**macOS:**
1. Download the latest release (ZIP recommended)
2. Extract and open ScribeCat.app
3. **Right-click → Open** (required for unsigned apps)
4. See [INSTALLATION.md](INSTALLATION.md) for detailed instructions

**Windows:**
1. Download the latest installer
2. Run the installer
3. Click "More info" → "Run anyway" if SmartScreen appears

**Linux:**
1. Download the AppImage
2. Make it executable: `chmod +x ScribeCat-*.AppImage`
3. Run it: `./ScribeCat-*.AppImage`

### For Developers

**Prerequisites:**
- Node.js 18+ and npm
- Git

**Clone and Install:**
```bash
git clone https://github.com/yourusername/ScribeCat-v2.git
cd ScribeCat-v2
npm install
```

**Environment Setup:**

Create a `.env` file in the project root:

```env
# AssemblyAI API Key (Required for transcription)
# Get your API key from: https://www.assemblyai.com/
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here

# Claude API Key (Optional - required for AI features)
# Get your API key from: https://console.anthropic.com/
CLAUDE_API_KEY=your_claude_api_key_here
```

**Run in Development:**
```bash
npm run compile   # Compile TypeScript
npm start         # Launch Electron
```

**Note:** `npm run dev` is currently broken. Use the commands above instead.

---

## 🚀 Development

### Project Structure

```
ScribeCat-v2/
├── src/
│   ├── main/              # Main process (Node.js)
│   ├── preload/           # Preload scripts (context bridge)
│   ├── renderer/          # Renderer process (UI)
│   │   ├── managers/      # Core managers (Recording, AI, etc.)
│   │   ├── components/    # UI components
│   │   ├── themes/        # Theme system
│   │   └── ai/           # AI integration
│   ├── application/       # Business logic (use cases)
│   ├── domain/           # Domain models
│   ├── infrastructure/   # External services (Supabase, AssemblyAI)
│   └── shared/           # Shared types and utilities
├── build-main.js         # Main process build (esbuild)
├── build-preload.js      # Preload build (TypeScript)
├── build-renderer.js     # Renderer build (esbuild)
└── electron-builder.json # Packaging configuration
```

### Available Scripts

```bash
# Development
npm run dev           # Start development with hot reload
npm run compile       # Compile all TypeScript files

# Building
npm run build         # Build for current platform
npm run build:mac     # Build for macOS (DMG + ZIP)
npm run build:win     # Build for Windows (NSIS installer)
npm run build:linux   # Build for Linux (AppImage)

# Testing
npm test              # Run tests with Vitest
npm run test:ui       # Run tests with UI
npm run test:coverage # Run tests with coverage

# Maintenance
npm run clean         # Remove dist directory
```

### Build System

ScribeCat uses **esbuild** for fast, modern bundling:

- **Main Process** ([build-main.js](build-main.js)) - Bundles Node.js code with environment variable injection
- **Renderer Process** ([build-renderer.js](build-renderer.js)) - Bundles browser code with environment variable injection
- **Preload Script** - TypeScript compilation only (no bundling for security)

Environment variables from `.env` are **embedded at build time** into the compiled code, so packaged apps work without the `.env` file.

---

## 🏗️ Architecture

### Clean Architecture

ScribeCat follows **Clean Architecture** principles:

```
Renderer (UI) → Application (Use Cases) → Domain (Models) → Infrastructure (External Services)
```

**Benefits:**
- Testable business logic
- Pluggable external services
- Clear separation of concerns
- Easy to maintain and extend

### Security Model

- **Context Isolation** enabled
- **Node Integration** disabled in renderer
- **IPC Communication** via secure preload bridge
- **API Keys** embedded at build time, never exposed to renderer
- **No eval()** or unsafe code execution

### State Management

- **Manager Pattern** - each feature has a dedicated manager
- **Event-Driven** - components communicate via events
- **Local Storage** - persistent settings via electron-store
- **Cloud Sync** - optional Supabase integration

---

## 🔧 Configuration

### Transcription Settings

Adjust transcription accuracy in Settings → Transcription:

- **Speech Threshold** - minimum confidence for partial results (0-1)
- **Boost Level** - how much to boost speaker's voice
- **Word Boost** - custom words to recognize better

### Cloud Sync Setup

1. Sign in with email/password in the app
2. Sessions are automatically synced to Supabase
3. Access from any device with the same account
4. Manage shared sessions in Study Mode

### Google Drive Export

1. Go to Settings → Google Drive
2. Sign in with your Google account
3. Export sessions directly to Drive from Study Mode

---

## 📚 Documentation

- **[INSTALLATION.md](INSTALLATION.md)** - End-user installation instructions
- **[TESTING.md](TESTING.md)** - Testing guide and standards

---

## 🛠️ Tech Stack

### Core
- **Electron 38** - Cross-platform desktop framework
- **TypeScript** - Type-safe development
- **esbuild** - Fast bundling and compilation

### Frontend
- **Tiptap** - Rich text editor framework
- **DOMPurify** - XSS protection for user content
- **Marked** - Markdown rendering

### Backend Services
- **AssemblyAI** - Real-time speech-to-text transcription
- **Anthropic Claude** - AI chat and study assistance
- **Supabase** - Cloud storage and authentication
- **Google Drive API** - Direct export to Drive

### Testing
- **Vitest** - Unit testing framework
- **Testing Library** - Component testing utilities
- **Happy-DOM** - Fast DOM implementation for tests

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write tests for new features
- Update documentation as needed
- Follow existing code style
- Keep commits atomic and descriptive

---

## 📄 License

ISC License - see LICENSE file for details

---

## 🙏 Acknowledgments

- **AssemblyAI** for providing excellent real-time transcription
- **Anthropic** for Claude AI capabilities
- **Tiptap** for the rich text editor framework
- **Electron** team for the amazing framework

---

## 📞 Support

- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/yourusername/ScribeCat-v2/issues)
- **Discussions**: Ask questions on [GitHub Discussions](https://github.com/yourusername/ScribeCat-v2/discussions)

---

**Note**: ScribeCat v2 is a complete rewrite focused on security, performance, and user experience. Built with modern web technologies and best practices for desktop applications.
