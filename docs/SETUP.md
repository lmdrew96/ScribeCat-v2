# ScribeCat v2 - Setup Guide

## Project Structure

```
ScribeCat-v2/
├── src/
│   ├── main/           # Main process (Electron backend)
│   │   └── main.ts     # Application entry point
│   ├── renderer/       # UI process (frontend)
│   │   ├── index.html  # Main HTML file
│   │   ├── styles.css  # Application styles
│   │   └── app.ts      # Frontend logic
│   ├── preload/        # Secure bridge between main and renderer
│   │   └── preload.ts  # Context isolation bridge
│   ├── shared/         # Common types and utilities
│   │   └── types.ts    # TypeScript interfaces
│   └── ai/             # AI integration modules (future)
├── assets/             # Static resources
│   ├── images/
│   ├── themes/
│   └── icons/
├── dist/               # Compiled TypeScript (gitignored)
├── tests/              # Test files (future)
├── docs/               # Documentation
└── node_modules/       # Dependencies (gitignored)
```

## Prerequisites

- Node.js 16.x or higher
- npm 8.x or higher

## Installation

1. Clone the repository:
```bash
git clone https://github.com/lmdrew96/ScribeCat-v2.git
cd ScribeCat-v2
```

2. Install dependencies:
```bash
npm install
```

## Development

### Build the project
```bash
npm run compile
```

This will:
- Compile TypeScript files to JavaScript
- Copy HTML and CSS files to the dist directory

### Run in development mode
```bash
npm run dev
```

This will compile the project and launch the Electron app.

### Clean build artifacts
```bash
npm run clean
```

## Production Build

### Build for current platform
```bash
npm run build
```

### Build for specific platforms
```bash
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

## Architecture

### Security-First Design

ScribeCat v2 follows Electron security best practices:

1. **Context Isolation**: The preload script acts as a secure bridge between the main process and renderer
2. **No Node Integration**: The renderer process does not have direct access to Node.js APIs
3. **Secure IPC**: All communication between processes uses Electron's IPC mechanism

### Main Process (`src/main/main.ts`)

- Creates and manages the application window
- Handles IPC communication
- Manages security policies
- Controls application lifecycle

### Preload Script (`src/preload/preload.ts`)

- Exposes a secure API to the renderer process via `contextBridge`
- Defines the interface for all IPC communication
- Provides type-safe access to Electron features

### Renderer Process (`src/renderer/`)

- Handles UI rendering and user interactions
- Accesses Electron features through the exposed API
- Maintains separation from main process for security

## Next Steps

Phase 1 has established the foundation. Future phases will add:

- Phase 2: Audio recording and transcription
- Phase 3: Rich text editor
- Phase 4: AI integration
- Phase 5: Canvas LMS integration
- Phase 6: Theme system (20+ themes)

## Troubleshooting

### Build fails
- Ensure all dependencies are installed: `npm install`
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

### TypeScript errors
- Check TypeScript version: `npx tsc --version`
- Verify tsconfig.json is present
- Run type checking: `npx tsc --noEmit`

### Electron won't launch
- Ensure the project is compiled: `npm run compile`
- Check that dist/main/main.js exists
- Verify package.json main field points to dist/main/main.js
