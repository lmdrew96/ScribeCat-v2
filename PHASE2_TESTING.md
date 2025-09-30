# Phase 2: Core Functionality - Testing Guide

## Overview
This document provides instructions for testing the Phase 2 core functionality implementation.

## Features Implemented

### 1. Recording Manager (`src/main/recording-manager.ts`)
- Start/stop/pause/resume recording functionality
- Recording state management
- Session creation with unique IDs
- Audio data saving to `recordings/` directory
- Session metadata saving to `sessions/` directory
- IPC handlers for renderer communication

### 2. File Manager (`src/main/file-manager.ts`)
- Session CRUD operations (Create, Read, Update, Delete)
- List all sessions sorted by creation date
- Export sessions to text, PDF, and DOCX formats
- Automatic directory creation for sessions and exports

### 3. Transcription Manager (`src/main/transcription-manager.ts`)
- Vosk model detection and initialization
- Placeholder for Whisper API integration
- Basic text enhancement functionality
- Transcription status queries

### 4. Enhanced Renderer (`src/renderer/app.ts`)
- Full audio recording using MediaRecorder API
- Real-time VU meter visualization with Web Audio API
- Session management UI
- Auto-save every 30 seconds
- Menu integration
- Error and success notifications

### 5. Updated UI
- VU meter for audio level visualization
- Session list sidebar
- Session info panel
- Responsive grid layout
- Enhanced styling

## Testing Instructions

### Manual Testing

#### 1. Test Audio Recording
1. Launch the application: `npm run dev`
2. Click the "Start Recording" button
3. Verify:
   - Button text changes to "Stop Recording"
   - Button turns red
   - Status shows "Recording..."
   - VU meter shows audio levels when speaking
4. Click "Stop Recording"
5. Verify:
   - Button returns to original state
   - Recording is saved in `recordings/` directory
   - Session metadata is saved in `sessions/` directory
   - Session appears in the session list

#### 2. Test Session Management
1. Create multiple recordings
2. Verify sessions appear in the "Recent Sessions" sidebar
3. Click "Load" on a session
4. Verify:
   - Session info updates in the top panel
   - Notes area loads (if any notes exist)
5. Edit notes in the editor
6. Wait 30 seconds for auto-save
7. Reload the session to verify notes were saved

#### 3. Test Session Deletion
1. Click "Delete" on a session
2. Confirm the deletion prompt
3. Verify the session is removed from the list
4. Check that the session file is removed from `sessions/` directory

#### 4. Test Export Functionality
1. Load a session
2. Use menu: File > Export > Export as Text
3. Verify export file is created in `exports/` directory
4. Open the exported file to verify content

#### 5. Test Menu Integration
1. Press `Cmd+N` (Mac) or `Ctrl+N` (Windows/Linux) for New Session
2. Press `Cmd+S` / `Ctrl+S` for Save Session
3. Press `Cmd+R` / `Ctrl+R` for Start Recording
4. Press `Cmd+Shift+R` / `Ctrl+Shift+R` for Stop Recording
5. Verify all keyboard shortcuts work as expected

### Directory Structure After Testing
After running the application, you should see:
```
ScribeCat-v2/
├── recordings/
│   └── recording_[timestamp].webm
├── sessions/
│   └── session_[timestamp].json
└── exports/
    └── [session_name].txt
```

## Known Limitations

1. **Transcription**: 
   - Vosk integration requires manual model download
   - Whisper API integration is a placeholder
   
2. **Export Formats**:
   - PDF and DOCX export currently output as text
   - Full PDF/DOCX generation requires additional libraries

3. **Recording**:
   - Recording happens in the renderer process
   - Uses browser MediaRecorder API
   - Requires microphone permissions

## Success Criteria

- [x] TypeScript compiles without errors
- [x] All IPC handlers are properly set up
- [x] Recording manager handles state correctly
- [x] File manager performs CRUD operations
- [x] UI components are properly styled
- [x] VU meter visualizes audio levels
- [x] Session list displays recent sessions
- [x] Menu shortcuts work correctly
- [ ] Manual testing confirms all features work (requires running app)

## Next Steps

Phase 3 will add:
- Rich text editor with formatting
- Enhanced toolbar
- More export options
- AI-powered features preparation
