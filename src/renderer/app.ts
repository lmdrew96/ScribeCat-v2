/**
 * ScribeCat Main Renderer Application
 * 
 * Coordinates audio recording, transcription, and UI updates.
 * This is the main entry point for the renderer process.
 */

import { AudioManager } from './audio-manager.js';
import { SettingsManager } from './settings.js';
import { AIManager } from './ai/AIManager.js';
import { ChatUI } from './ai/ChatUI.js';
import { ViewManager } from './managers/ViewManager.js';
import { TiptapEditorManager } from './managers/TiptapEditorManager.js';
import { TranscriptionManager } from './managers/TranscriptionManager.js';
import { RecordingManager } from './managers/RecordingManager.js';
import { DeviceManager } from './managers/DeviceManager.js';
import { CourseManager } from './managers/CourseManager.js';
import { ThemeManager } from './themes/ThemeManager.js';
import { StudyModeManager } from './managers/StudyModeManager.js';
import { NotesAutoSaveManager } from './managers/NotesAutoSaveManager.js';
import { AuthManager } from './managers/AuthManager.js';
import { AuthScreen } from './components/AuthScreen.js';
import { UserProfileMenu } from './components/UserProfileMenu.js';
import { ShareModal } from './components/ShareModal.js';
import { AccountSettingsModal } from './components/AccountSettingsModal.js';
import { HelpModal } from './components/HelpModal.js';
import { TrashModal } from './components/TrashModal.js';
import { CommandPalette } from './components/CommandPalette.js';
import { CommandRegistry } from './managers/CommandRegistry.js';
import { AISuggestionChip } from './components/AISuggestionChip.js';
import { LayoutManager } from './managers/LayoutManager.js';
import { WorkspaceLayoutPicker } from './components/WorkspaceLayoutPicker.js';
import { ToastManager } from './managers/ToastManager.js';
import { ConfettiManager } from './utils/confetti.js';
import { KonamiCodeDetector, TripleClickDetector, StudyBuddy, triggerCatParty } from './utils/easter-eggs.js';
import { getRandomCatFact } from './utils/cat-facts.js';
// Phase 6: Polish & Delight
import { FocusManager, initializeA11yStyles } from './utils/FocusManager.js';
import { WelcomeModal } from './components/WelcomeModal.js';
import { TutorialManager } from './utils/TutorialManager.js';
import { SoundManager, initializeSoundSystem, enableGlobalSoundEffects } from './audio/SoundManager.js';
import { BreakReminders, initializeBreakReminders } from './components/BreakReminders.js';
// Editor Enhancements: Professional icon system
import { initToolbarUpgrades } from './components/editor/ToolbarIconUpgrader.js';
import { initEmojiPicker } from './components/editor/EmojiPicker.js';
// Keyboard Shortcuts: Centralized registry and validation
import { initializeShortcutValidation } from './managers/ShortcutRegistry.js';

// ===== Managers =====
let audioManager: AudioManager;
let settingsManager: SettingsManager;
let themeManager: ThemeManager;
let aiManager: AIManager;
let chatUI: ChatUI;
let viewManager: ViewManager;
let editorManager: TiptapEditorManager;
let transcriptionManager: TranscriptionManager;
let recordingManager: RecordingManager;
let deviceManager: DeviceManager;
let courseManager: CourseManager;
let studyModeManager: StudyModeManager;
let notesAutoSaveManager: NotesAutoSaveManager;
let authManager: AuthManager;
let authScreen: AuthScreen;
let userProfileMenu: UserProfileMenu;
let shareModal: ShareModal;
let accountSettingsModal: AccountSettingsModal;
let helpModal: HelpModal;
let trashModal: TrashModal;
let commandPalette: CommandPalette;
let commandRegistry: CommandRegistry;
let aiSuggestionChip: AISuggestionChip;
let layoutManager: LayoutManager;
let layoutPicker: WorkspaceLayoutPicker;
let toastManager: ToastManager;
let confettiManager: ConfettiManager;

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', async () => {
  // Get app version dynamically
  const version = await window.scribeCat.app.getVersion();

  // 🎉 Easter Egg: Console Cat ASCII Art
  console.log(
    '%c     /\\_/\\  \n' +
    '    ( o.o ) \n' +
    '     > ^ <\n' +
    '    /|   |\\\n' +
    '   (_|   |_)\n',
    'color: #00ffff; font-family: monospace; font-size: 16px;'
  );
  console.log(
    '%c Curious cat found you! 👀',
    'color: #ff69b4; font-weight: bold; font-size: 14px;'
  );
  console.log(
    `%c ScribeCat v${version} - Brought to You by ADHD: Agentic Development of Human Designs 🧠⚡️`,
    'color: #ffd700; font-size: 12px;'
  );
  console.log(
    '%c Found a bug? Meow at us on GitHub!\n https://github.com/lmdrew96/ScribeCat-v2',
    'color: #c0c0c0; font-size: 11px;'
  );
  console.log(''); // Empty line for spacing

  // Initialize theme manager first
  themeManager = new ThemeManager();
  await themeManager.initialize();

  // Validate keyboard shortcuts (catch conflicts early in dev mode)
  initializeShortcutValidation();

  // Initialize professional toolbar icons (upgrade emoji to SVG)
  initToolbarUpgrades();

  // Initialize emoji picker
  initEmojiPicker();

  // Initialize core managers
  audioManager = new AudioManager();

  // Initialize UI managers
  viewManager = new ViewManager();
  editorManager = new TiptapEditorManager();
  transcriptionManager = new TranscriptionManager();
  deviceManager = new DeviceManager();

  // Initialize transcription placeholder with random cat fact
  const transcriptionPlaceholder = document.getElementById('transcription-placeholder');
  if (transcriptionPlaceholder) {
    transcriptionPlaceholder.textContent = getRandomCatFact();
  }

  // Initialize AI manager first (needed by recording manager)
  aiManager = new AIManager(
    () => transcriptionManager.getText(),
    () => editorManager.getNotesText()
  );
  await aiManager.initialize();

  // Initialize ChatUI
  chatUI = new ChatUI();

  // Initialize course manager
  courseManager = new CourseManager();

  // Expose managers globally for other components to access
  window.courseManager = courseManager;
  window.aiManager = aiManager;

  // Initialize notes auto-save manager
  notesAutoSaveManager = new NotesAutoSaveManager(editorManager);
  notesAutoSaveManager.initialize();

  // Expose notesAutoSaveManager globally for keyboard shortcuts
  (window as any).notesAutoSaveManager = notesAutoSaveManager;

  // Initialize recording manager (coordinates everything)
  recordingManager = new RecordingManager(
    audioManager,
    transcriptionManager,
    viewManager,
    editorManager,
    aiManager,
    courseManager,
    notesAutoSaveManager,
    chatUI
  );
  recordingManager.initialize();

  // Initialize editor
  editorManager.initialize();

  // Set up auto-save callback on editor
  editorManager.setOnContentChangeCallback(() => {
    notesAutoSaveManager.onEditorUpdate();
  });

  // Set up periodic button state updates
  setInterval(updateClearButtonStates, 1000);

  // Load microphone devices
  await deviceManager.loadDevices();

  // Initialize authentication FIRST (needed by StudyModeManager)
  authManager = new AuthManager();
  await authManager.initialize();
  authScreen = new AuthScreen(authManager);
  accountSettingsModal = new AccountSettingsModal(authManager);
  helpModal = new HelpModal();
  trashModal = new TrashModal();
  userProfileMenu = new UserProfileMenu(authManager, accountSettingsModal);

  // Initialize settings manager (requires authManager for Drive settings and accountSettingsModal)
  settingsManager = new SettingsManager(themeManager, authManager, accountSettingsModal);

  // Expose authManager globally for RecordingManager to access current user
  window.authManager = authManager;

  // Initialize study mode manager (requires authManager)
  studyModeManager = new StudyModeManager(authManager);
  await studyModeManager.initialize();

  // Expose studyModeManager globally for other managers to trigger refresh
  window.studyModeManager = studyModeManager;

  // Initialize sharing
  shareModal = new ShareModal();
  shareModal.initialize();

  // Expose shareModal globally after initialization
  window.shareModal = shareModal;

  // Set up auth UI (show/hide signin button)
  setupAuthUI();

  // Set up event listeners
  setupEventListeners();

  // Set up toolbar toggle
  setupToolbarToggle();

  // Initialize command palette and registry
  commandPalette = new CommandPalette();
  commandPalette.initialize();

  commandRegistry = new CommandRegistry(commandPalette);
  commandRegistry.registerAllCommands({
    recordingManager,
    studyModeManager,
    viewManager,
    editorManager,
    transcriptionManager,
    settingsManager,
    aiManager,
    courseManager,
    authManager
  });

  // Initialize AI suggestion chip
  aiSuggestionChip = new AISuggestionChip();
  aiSuggestionChip.initialize(
    (suggestion) => {
      console.log('✅ User accepted suggestion:', suggestion.title);
      aiManager.markSuggestionAccepted(suggestion.id);
      // TODO: Execute the corresponding AI tool action
    },
    (suggestion) => {
      console.log('❌ User dismissed suggestion:', suggestion.title);
      aiManager.markSuggestionDismissed(suggestion.id);
    }
  );

  // Expose for RecordingManager
  (window as any).aiSuggestionChip = aiSuggestionChip;

  // Initialize visual feedback managers
  toastManager = new ToastManager();
  confettiManager = new ConfettiManager();

  // Expose globally for easy access
  (window as any).toastManager = toastManager;
  (window as any).confettiManager = confettiManager;

  // Initialize workspace layout manager
  layoutManager = new LayoutManager();
  layoutManager.initialize();
  (window as any).layoutManager = layoutManager;

  // Initialize workspace layout picker
  layoutPicker = new WorkspaceLayoutPicker(layoutManager);
  layoutPicker.initialize();

  // Expose globally for command palette
  (window as any).layoutManager = layoutManager;

  // Add event listener for opening layout picker from settings
  const openLayoutPickerBtn = document.getElementById('open-layout-picker-btn');
  if (openLayoutPickerBtn) {
    openLayoutPickerBtn.addEventListener('click', () => {
      layoutPicker.open();
    });
  }

  // 🎉 Initialize Easter Eggs
  initializeEasterEggs();

  // ===== Phase 6: Polish & Delight =====
  console.log('%c✨ Phase 6: Polish & Delight initialized!', 'color: #ff69b4; font-weight: bold;');

  // Initialize accessibility features
  initializeA11yStyles();
  FocusManager.createSkipLink('#main-content');

  // Initialize sound system
  initializeSoundSystem();
  enableGlobalSoundEffects();

  // Initialize break reminders with recording manager (auto-starts if enabled in settings)
  initializeBreakReminders(recordingManager);

  // Show welcome modal on first launch (after a short delay)
  setTimeout(() => {
    WelcomeModal.show();
  }, 1000);

  // Expose Phase 6 managers globally for console access and integration
  (window as any).FocusManager = FocusManager;
  (window as any).WelcomeModal = WelcomeModal;
  (window as any).TutorialManager = TutorialManager;
  (window as any).SoundManager = SoundManager;
  (window as any).BreakReminders = BreakReminders;

  // Set up hot reload notification listener (development only)
  setupHotReloadListener();
});

/**
 * Set up all event listeners
 */
function setupEventListeners(): void {
  // Record button
  const recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
  recordBtn.addEventListener('click', handleRecordToggle);
  
  // Pause button
  const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
  pauseBtn.addEventListener('click', handlePauseToggle);
  
  // Clear buttons
  const clearNotesBtn = document.getElementById('clear-notes-btn') as HTMLButtonElement;
  const clearTranscriptionBtn = document.getElementById('clear-transcription-btn') as HTMLButtonElement;
  const clearBothBtn = document.getElementById('clear-both-btn') as HTMLButtonElement;
  
  clearNotesBtn.addEventListener('click', handleClearNotes);
  clearTranscriptionBtn.addEventListener('click', handleClearTranscription);
  clearBothBtn.addEventListener('click', handleClearBoth);

  // Trash button
  const trashBtn = document.getElementById('trash-btn') as HTMLButtonElement;
  if (trashBtn) {
    trashBtn.addEventListener('click', () => {
      trashModal.show();
    });

    // Set up callbacks for when sessions are restored or deleted
    trashModal.onRestore((sessionId) => {
      // Refresh the study mode session list
      if (studyModeManager) {
        studyModeManager.refresh();
      }
    });

    trashModal.onPermanentDelete((sessionId) => {
      // Optionally refresh or do nothing
    });

    trashModal.onEmptyTrash(() => {
      // Optionally refresh or do nothing
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Shift+Space - Toggle recording (global shortcut)
    if (e.shiftKey && e.key === ' ' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // Don't trigger if user is typing in an input field
      const target = e.target as HTMLElement;
      const isInputField = target instanceof HTMLInputElement ||
                          target instanceof HTMLTextAreaElement ||
                          target.isContentEditable;

      if (!isInputField) {
        e.preventDefault();
        handleRecordToggle();
      }
    }

    // Cmd+Shift+F (Mac) or Ctrl+Shift+F (Windows/Linux) - Cycle focus modes
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      focusModeManager.cycleMode();
    }
  });

  // Update button states on content changes
  updateClearButtonStates();
}

/**
 * Handle record button toggle
 */
async function handleRecordToggle(): Promise<void> {
  if (!recordingManager.getIsRecording()) {
    await startRecording();
  } else {
    await stopRecording();
  }
}

/**
 * Handle pause button toggle
 */
async function handlePauseToggle(): Promise<void> {
  if (!recordingManager.getIsPaused()) {
    await pauseRecording();
  } else {
    await resumeRecording();
  }
}

/**
 * Start recording
 */
async function startRecording(): Promise<void> {
  try {
    const selectedDeviceId = deviceManager.getSelectedDeviceId();
    
    if (!selectedDeviceId) {
      alert('Please select a microphone device');
      return;
    }
    
    await recordingManager.start(selectedDeviceId);
  } catch (error) {
    console.error('Failed to start recording:', error);
    await recordingManager.cleanup();
    alert(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Stop recording
 */
async function stopRecording(): Promise<void> {
  try {
    await recordingManager.stop();
  } catch (error) {
    console.error('Failed to stop recording:', error);
    alert(`Failed to stop recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Pause recording
 */
async function pauseRecording(): Promise<void> {
  try {
    await recordingManager.pause();
  } catch (error) {
    console.error('Failed to pause recording:', error);
    alert(`Failed to pause recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Resume recording
 */
async function resumeRecording(): Promise<void> {
  try {
    await recordingManager.resume();
  } catch (error) {
    console.error('Failed to resume recording:', error);
    alert(`Failed to resume recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle clear notes button
 */
function handleClearNotes(): void {
  const hasContent = editorManager.getNotesText().trim().length > 0;
  
  if (!hasContent) {
    return;
  }
  
  const confirmed = confirm('Clear all notes? This cannot be undone.');
  
  if (confirmed) {
    editorManager.clearNotes();
    updateClearButtonStates();
  }
}

/**
 * Handle clear transcription button
 */
function handleClearTranscription(): void {
  const hasContent = transcriptionManager.getText().trim().length > 0;
  
  if (!hasContent) {
    return;
  }
  
  const confirmed = confirm('Clear transcription? This cannot be undone.');
  
  if (confirmed) {
    transcriptionManager.clear();
    updateClearButtonStates();
  }
}

/**
 * Handle clear both button
 */
function handleClearBoth(): void {
  const hasNotesContent = editorManager.getNotesText().trim().length > 0;
  const hasTranscriptionContent = transcriptionManager.getText().trim().length > 0;
  
  if (!hasNotesContent && !hasTranscriptionContent) {
    return;
  }
  
  const confirmed = confirm('Clear BOTH notes and transcription? This cannot be undone.');
  
  if (confirmed) {
    editorManager.clearNotes();
    transcriptionManager.clear();
    updateClearButtonStates();
  }
}

/**
 * Update clear button enabled/disabled states based on content
 */
function updateClearButtonStates(): void {
  const clearNotesBtn = document.getElementById('clear-notes-btn') as HTMLButtonElement;
  const clearTranscriptionBtn = document.getElementById('clear-transcription-btn') as HTMLButtonElement;
  const clearBothBtn = document.getElementById('clear-both-btn') as HTMLButtonElement;
  
  if (!clearNotesBtn || !clearTranscriptionBtn || !clearBothBtn) {
    return;
  }
  
  const hasNotesContent = editorManager.getNotesText().trim().length > 0;
  const hasTranscriptionContent = transcriptionManager.getText().trim().length > 0;
  
  clearNotesBtn.disabled = !hasNotesContent;
  clearTranscriptionBtn.disabled = !hasTranscriptionContent;
  clearBothBtn.disabled = !hasNotesContent && !hasTranscriptionContent;
}

/**
 * Show a notification toast
 */
function showNotification(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
  const colors = {
    info: '#3498db',
    warning: '#f39c12',
    error: '#e74c3c'
  };

  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: ${colors[type]};
    color: white;
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    max-width: 400px;
    font-size: 14px;
    animation: slideInRight 0.3s ease;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 5000);
}

/**
 * Set up hot reload notification listener (development only)
 */
function setupHotReloadListener(): void {
  if ((window.scribeCat as any).dev) {
    (window.scribeCat as any).dev.onHotReloadNotification((message: string) => {
      console.warn('⚠️ Hot reload:', message);
      showNotification(message, 'warning');
    });
  }
}

/**
 * Clean up on window unload
 */
window.addEventListener('beforeunload', async (event) => {
  // Save notes immediately before closing (safety net)
  if (notesAutoSaveManager) {
    console.log('[App] Saving notes before window close...');
    await notesAutoSaveManager.saveImmediately();
  }

  if (recordingManager && recordingManager.getIsRecording()) {
    audioManager.cleanup();
    recordingManager.cleanup();
  }

  // Clean up hot reload listener if it exists
  if ((window.scribeCat as any).dev) {
    (window.scribeCat as any).dev.removeHotReloadListener();
  }

  // Clean up notes auto-save manager
  if (notesAutoSaveManager) {
    notesAutoSaveManager.cleanup();
  }
});

/**
 * Initialize Easter Eggs
 * Sets up fun interactive features
 */
function initializeEasterEggs(): void {
  // 1. Konami Code Cat Party
  new KonamiCodeDetector(() => {
    console.log('🎉 Konami code activated!');
    triggerCatParty();
  });

  // 2. Triple-click app title for Study Buddy
  const appTitle = document.querySelector('.app-title') as HTMLElement;
  const appLogo = document.querySelector('.app-logo') as HTMLElement;

  if (appTitle) {
    const studyBuddy = new StudyBuddy();
    new TripleClickDetector(appTitle, (isActive) => {
      studyBuddy.toggle();

      // Visual feedback on logo
      if (appLogo) {
        appLogo.classList.add('easter-egg-active');
        setTimeout(() => appLogo.classList.remove('easter-egg-active'), 500);
      }
    });
  } else {
    console.warn('❌ App title not found for Study Buddy easter egg');
  }
}

/**
 * Set up toolbar toggle button
 */
function setupToolbarToggle(): void {
  const toggleBtn = document.getElementById('toggle-toolbar-btn');
  const toolbar = document.querySelector('.formatting-toolbar') as HTMLElement;

  if (!toggleBtn || !toolbar) return;

  let isToolbarVisible = false;

  toggleBtn.addEventListener('click', () => {
    isToolbarVisible = !isToolbarVisible;

    if (isToolbarVisible) {
      toolbar.classList.add('visible');
      toggleBtn.title = 'Hide advanced formatting toolbar';
      toggleBtn.style.opacity = '1';
    } else {
      toolbar.classList.remove('visible');
      toggleBtn.title = 'Show advanced formatting toolbar';
      toggleBtn.style.opacity = '0.6';
    }
  });

  // Start with button slightly dimmed to indicate toolbar is hidden
  toggleBtn.style.opacity = '0.6';
}

/**
 * Set up authentication UI (show/hide signin button based on auth state)
 */
function setupAuthUI(): void {
  const signinBtn = document.getElementById('signin-btn');

  // Listen for auth state changes
  authManager.onAuthStateChange((user) => {
    if (user) {
      // User is authenticated - hide signin button
      signinBtn?.classList.add('hidden');
    } else {
      // User is not authenticated - show signin button
      signinBtn?.classList.remove('hidden');
    }
  });

  // Add click listener to signin button
  signinBtn?.addEventListener('click', () => {
    authScreen.show();
  });
}
