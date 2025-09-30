# ScribeCat v2

> ScribeCat scribes and is cat. 🐱✨

A revolutionary multi-platform Electron application that combines audio recording, real-time transcription, rich text note-taking, and AI-powered study aids to enhance learning and productivity.

## ✨ Features

- 🎙️ **Audio Recording**: Record lectures, meetings, and conversations
- 📝 **Rich Text Editor**: Take notes with formatting, images, and more
- 🤖 **AI Integration**: Enhance transcriptions, generate summaries, and create study aids
- 🎨 **20+ Themes**: Beautiful themes across academic, professional, creative, and accessibility categories
- 🎓 **Canvas LMS Integration**: Connect with your courses and assignments
- 🔒 **Security-First**: Built with Electron security best practices
- 💻 **Cross-Platform**: Works on macOS, Windows, and Linux

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

For detailed setup instructions, see [docs/SETUP.md](docs/SETUP.md).

## 📁 Project Status

**Phase 1: Project Foundation** ✅ Complete
- Project structure established
- TypeScript configuration
- Electron app architecture with security-first design
- Basic UI scaffold

**Phase 2: Core Functionality** ✅ Complete
- Audio recording system with MediaRecorder API
- Real-time VU meter visualization
- Session management (create, load, save, delete)
- File operations with export functionality
- Transcription manager with Vosk/Whisper support
- Enhanced UI with session list and info panels
- Auto-save and menu shortcuts

**Upcoming Phases:**
- Phase 3: Rich Text Editor
- Phase 4: AI Integration
- Phase 5: Canvas LMS Integration
- Phase 6: Theme System

## 🏗️ Architecture

ScribeCat v2 is built with:
- **Electron**: Cross-platform desktop framework
- **TypeScript**: Type-safe development
- **Security-First Design**: Context isolation, no node integration in renderer

See [docs/SETUP.md](docs/SETUP.md) for detailed architecture information.

## 📚 Documentation

- [Setup Guide](docs/SETUP.md) - Installation and development setup
- [Architecture Overview](docs/SETUP.md#architecture) - Security and design patterns
- [Phase 2 Summary](docs/PHASE2_SUMMARY.md) - Core functionality implementation
- [Phase 2 Testing](PHASE2_TESTING.md) - Testing guide for Phase 2 features
- [UI Layout](docs/PHASE2_UI_LAYOUT.md) - Visual layout documentation

## 🤝 Contributing

This project is currently in active development. More information coming soon!

## 📄 License

ISC

---

**Note**: ScribeCat v2 is a complete rewrite focused on security, performance, and user experience.
