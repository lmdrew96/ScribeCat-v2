# ScribeCat v2

> ScribeCat scribes and is cat. 🐱✨

A revolutionary multi-platform Electron application that combines audio recording, real-time transcription, rich text note-taking, and AI-powered study aids to enhance learning and productivity.

## ✨ Features

- 🎙️ **Audio Recording**: Record lectures, meetings, and conversations with real-time VU meter
- 🗣️ **Real-Time Transcription**: Choose between simulation mode or AssemblyAI speech-to-text
- 📝 **Rich Text Editor**: Take notes with formatting, colors, and more
- 🤖 **AI Integration**: Enhance transcriptions, generate summaries, and create study aids (coming soon)
- 🎨 **20+ Themes**: Beautiful themes across academic, professional, creative, and accessibility categories (coming soon)
- 🎓 **Canvas LMS Integration**: Connect with your courses and assignments (coming soon)
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

## 🎙️ Transcription Options

ScribeCat supports multiple transcription modes:

### AssemblyAI Transcription (Real-Time)

For production use with high-quality real-time transcription:

1. Get an API key from [AssemblyAI](https://www.assemblyai.com/)
2. Open ScribeCat Settings (⚙️)
3. Enter your AssemblyAI API key
4. Select "AssemblyAI" transcription mode
5. Start recording - transcription appears in real-time!

**Features:**
- High accuracy speech-to-text
- Real-time streaming transcription
- Support for multiple languages
- Automatic punctuation and formatting

### Simulation Mode

For testing and development without an API key:
- No API key or model required
- Generates realistic test transcriptions
- Perfect for UI testing and development
- Useful for demos and screenshots

## 📁 Project Status

**Phase 1: Project Foundation** ✅ Complete
- Project structure established
- TypeScript configuration
- Electron app architecture with security-first design
- Basic UI scaffold

**Upcoming Phases:**
- Phase 2: Audio Recording & Transcription
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
- [Audio Recording Usage](docs/AUDIO_RECORDING_USAGE.md) - Audio recording system guide
- [Simulation Transcription](docs/SIMULATION_TRANSCRIPTION.md) - Testing transcription without models
- [AssemblyAI Integration](docs/ASSEMBLYAI_IMPLEMENTATION.md) - Real-time speech-to-text setup

## 🤝 Contributing

This project is currently in active development. More information coming soon!

## 📄 License

ISC

---

**Note**: ScribeCat v2 is a complete rewrite focused on security, performance, and user experience.
