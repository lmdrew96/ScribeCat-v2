/**
 * ScribeCat Main Renderer Application
 * 
 * Coordinates audio recording, transcription, and UI updates.
 * This is the main entry point for the renderer process.
 */

import { AudioManager } from './audio-manager.js';
import { SettingsManager } from './settings.js';
import { AIManager } from './ai/AIManager.js';
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

// ===== Managers =====
let audioManager: AudioManager;
let settingsManager: SettingsManager;
let themeManager: ThemeManager;
let aiManager: AIManager;
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

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log('ScribeCat initializing...');
  
  // Initialize theme manager first
  themeManager = new ThemeManager();
  await themeManager.initialize();

  // Initialize core managers
  audioManager = new AudioManager();

  // Initialize UI managers
  viewManager = new ViewManager();
  editorManager = new TiptapEditorManager();
  transcriptionManager = new TranscriptionManager();
  deviceManager = new DeviceManager();
  
  // Initialize AI manager first (needed by recording manager)
  aiManager = new AIManager(
    () => transcriptionManager.getText(),
    () => editorManager.getNotesText()
  );
  await aiManager.initialize();

  // Initialize course manager
  courseManager = new CourseManager();

  // Expose managers globally for other components to access
  window.courseManager = courseManager;
  window.aiManager = aiManager;

  // Initialize notes auto-save manager
  notesAutoSaveManager = new NotesAutoSaveManager(editorManager);
  notesAutoSaveManager.initialize();

  // Initialize recording manager (coordinates everything)
  recordingManager = new RecordingManager(
    audioManager,
    transcriptionManager,
    viewManager,
    editorManager,
    aiManager,
    courseManager,
    notesAutoSaveManager
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
  userProfileMenu = new UserProfileMenu(authManager, accountSettingsModal);

  // Initialize settings manager (requires authManager for Drive settings)
  settingsManager = new SettingsManager(themeManager, authManager);

  // Expose authManager globally for RecordingManager to access current user
  window.authManager = authManager;

  // Initialize study mode manager (requires authManager)
  studyModeManager = new StudyModeManager(authManager);
  await studyModeManager.initialize();

  // Initialize sharing
  shareModal = new ShareModal();
  shareModal.initialize();

  // Expose shareModal globally after initialization
  window.shareModal = shareModal;

  // Set up auth UI (show/hide signin button)
  setupAuthUI();

  // Set up event listeners
  setupEventListeners();

  // Set up hot reload notification listener (development only)
  setupHotReloadListener();

  console.log('ScribeCat initialized successfully');
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

  window.scribeCat.transcription.simulation.removeResultListener();

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
