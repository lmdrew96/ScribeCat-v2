# ScribeCat v2

> ScribeCat scribes and is cat. 🐱✨

A revolutionary multi-platform Electron application that combines audio recording, real-time transcription, rich text note-taking, and AI-powered study aids to enhance learning and productivity.

## ✨ Features

- 🎙️ **Audio Recording**: Record lectures, meetings, and conversations with real-time VU meter
- 🗣️ **Real-Time Transcription**: Choose between simulation mode or Vosk speech-to-text
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

## 🎙️ Using Vosk Transcription

ScribeCat supports real-time speech-to-text using Vosk. To use Vosk:

### 1. Download a Vosk Model

Visit [alphacephei.com/vosk/models](https://alphacephei.com/vosk/models) and download a model:
- **Recommended**: `vosk-model-small-en-us-0.15` (40MB, fast, good accuracy)
- **Alternative**: `vosk-model-en-us-0.22` (1.8GB, best accuracy)

### 2. Serve the Model via HTTP

Vosk-browser requires models to be served via HTTP. Use Python's built-in server:

```bash
# Navigate to the directory containing your model
cd ~/Downloads

# Start HTTP server (Python 3)
python3 -m http.server 8000

# Or Python 2
python -m SimpleHTTPServer 8000
```

The model will be available at: `http://localhost:8000/vosk-model-small-en-us-0.15`

### 3. Configure ScribeCat

1. Open ScribeCat
2. Click the Settings button (⚙️)
3. Select "Real Vosk Transcription" mode
4. Enter your model URL (e.g., `http://localhost:8000/vosk-model-small-en-us-0.15`)
5. Click "Save Settings"

### 4. Start Recording

1. Select your microphone
2. Click the record button
3. Speak clearly - transcription will appear in real-time!
4. The status bar will show "Mode: Vosk" when using real transcription

**Note**: Keep the HTTP server running while using Vosk transcription.

### Simulation Mode

For testing without a model, use Simulation Mode:
- No model required
- Generates realistic test transcriptions
- Perfect for UI testing and development

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
- [Vosk Transcription](docs/VOSK_TRANSCRIPTION.md) - Real-time speech-to-text setup

## 🤝 Contributing

This project is currently in active development. More information coming soon!

## 📄 License

ISC

---

**Note**: ScribeCat v2 is a complete rewrite focused on security, performance, and user experience.
