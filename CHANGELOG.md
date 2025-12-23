# ScribeCat v2 Changelog

## v1.74.0 → v2.13.0

### 🆕 Major Features

#### Modern UI Overhaul (v2.13.0)
- **Sleek softened design** - Toned down neobrutalism for a more modern, refined look
- **Soft shadow system** - Replaced hard offset shadows with subtle blurred shadows throughout
- **Refined borders** - Thinner, more subtle borders that don't overpower the content
- **Smooth hover effects** - Modern scale and lift animations replace harsh translate effects
- **Improved focus states** - Subtle glow rings for better accessibility and elegance
- **Consistent design tokens** - New CSS variables for hover, pressed, and glow states

#### Nugget's Notes (v2.11.0)
- **Real-time AI note-taking** - Nugget automatically captures and organizes key points from your recordings as you speak

#### Neomail Direct Messages (v1.75.0)
- **Direct messaging system** - Chat privately with friends in a Neomail-inspired interface

#### Live AI Suggestions (v1.92.0 - v1.93.0)
- **Intelligent important point detection** during recording sessions
- **Context-aware AI suggestions** that appear at relevant moments
- Word-level timing from AssemblyAI for accurate timestamp placement

#### Natural Language Search (v1.91.0)
- **Search courses using natural language** - Find what you need without exact keyword matching

### 🎨 UI/UX Improvements

#### Visual Updates
- **Modern UI overhaul** - Softened neobrutalism with elegant shadows and refined borders (v2.13.0)
- **Hamburger dropdown menu** replaces header buttons for cleaner interface (v2.10.20)
- **RonysiswadiArchitect5 font** applied to settings modal, AI chat drawer, transcription placeholder, and status bar (v2.10.19)
- **Header button size reduction** with improved icon centering (v1.87.1)
- **Enhanced Super Rainbow Mode** with 30-second gradual fadeout (v1.95.0)
- **GSAP animation system** for smoother UI interactions (v1.94.0)
- **Theme category and variant badges** now use dynamic colors instead of hardcoded values
- **Modal/dialog sizing and scrolling improvements** (v2.10.17)
- **Removed backdrop-filter** from modals to fix scroll flickering (v2.10.10)

#### Coming Soon Feature
- **"Coming Soon" badge system** for features in development (v2.12.2)

### 🔧 Major Refactoring

Large-scale code architecture improvements for maintainability:
- **Modular preload bridges** - Split preload scripts into focused bridge modules (v2.12.0)
- **Centralized IPC channels** - All IPC communication uses consistent channel definitions (v2.12.1)
- **Replaced emojis with Lucide icons** throughout the app for consistent visual language (v2.12.0)
- **StudyModeManager** refactored (1363 → 811 lines) (v1.79.0)
- **StudyRoomView** refactored (1674 → 480 lines) (v1.78.0)
- **MultiplayerGamesManager** refactored (1619 → 444 lines) (v1.77.0)
- **JeopardyGame** refactored (1923 → 485 lines) (v1.76.0)
- **TiptapToolbarManager** split into focused toolbar modules (v1.80.0)
- **App initialization** refactored into focused modules (v1.81.0)
- **StudyRoomsManager** split into specialized modules (v1.82.0)
- **FriendsManager** split into presence and subscription modules (v1.83.0)
- **AnalyticsDashboard** refactored into focused modules (v1.86.0)
- **FriendsModal** split into focused tab components (v1.87.0)
- **TutorialManager** refactored into flow definitions and renderer modules (v1.85.0)
- Removed ~950 lines of dead realtime code (v1.75.0)
- Cleaned up ~15,000 lines of outdated documentation (v1.87.3)

### 🐛 Bug Fixes

#### Recording & Transcription
- **AI suggestion timestamps** now use word-level timing from AssemblyAI for accuracy (v2.10.23)
- **Google OAuth flow** improved with automatic code exchange (v2.9.0)
- **Google Drive env vars** correctly included in renderer build (v1.92.1)

#### Study Mode
- **Study time tracking** now correctly tracks time spent in session detail views (v2.10.9)
- **Playback time tracking API path** fixed (v1.87.2)
- **Console errors** in study mode resolved (v1.93.1)
- **Missing `toggleStudyMode` method** restored to StudyModeManager (v2.10.22)
- **Study tools layout regression** after re-transcription fixed (v2.2.2)

#### Study Rooms
- **Timer crashes** fixed (v2.0.7)
- **Memory leaks** resolved (v2.0.7)
- **Edge case handling** improved (v2.0.7)
- **Audio for room participants** fixed (v2.10.15)

#### Editor
- **Text box drag and resize** in TipTap editor fixed (v1.92.2)
- **Nugget AI Chat button visibility** fixed (v2.2.1)

#### General
- **Missing cleanup methods** causing app exit errors fixed (v1.92.3)
- **Missing sparkle icon alias** added to iconMap (v1.93.2)
- **Type errors** resolved throughout codebase (v2.10.2)

### 🗑️ Removed Features
- **Break Reminders** feature removed (v2.12.3)
- **Focus Mode** feature removed (v2.10.11)
- **Workspace Layout Picker** feature removed (v2.10.11)

### 📝 Documentation
- **Help & Legal modal** updated with current features (v1.95.1)

---

**Full version:** 2.13.0  
**Commits since v1.74.0:** 100+
