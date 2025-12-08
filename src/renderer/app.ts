/**
 * ScribeCat Main Renderer Application
 *
 * Coordinates app initialization and event setup.
 * This is the main entry point for the renderer process.
 */

import { SettingsManager } from './settings.js';
import { ThemeManager } from './themes/ThemeManager.js';
import { AuthManager } from './managers/AuthManager.js';
import { AuthScreen } from './components/AuthScreen.js';
import { UserProfileMenu } from './components/UserProfileMenu.js';
import { ShareModal } from './components/ShareModal.js';
import { AccountSettingsModal } from './components/AccountSettingsModal.js';
import { HelpModal } from './components/HelpModal.js';
import { TrashModal } from './components/TrashModal.js';
import { StudyModeManager } from './managers/StudyModeManager.js';
import { CommandPalette } from './components/CommandPalette.js';
import { CommandRegistry } from './managers/CommandRegistry.js';
import { AISuggestionChip } from './components/AISuggestionChip.js';
import { LayoutManager } from './managers/LayoutManager.js';
import { WorkspaceLayoutPicker } from './components/WorkspaceLayoutPicker.js';
import { notificationTicker } from './managers/NotificationTicker.js';
import { ConfettiManager } from './utils/confetti.js';
import { FocusManager, initializeA11yStyles } from './utils/FocusManager.js';
import { WelcomeModal } from './components/WelcomeModal.js';
import { TutorialManager } from './utils/TutorialManager.js';
import { SoundManager, initializeSoundSystem, enableGlobalSoundEffects } from './audio/SoundManager.js';
import { BreakReminders, initializeBreakReminders } from './components/BreakReminders.js';
import { initToolbarUpgrades } from './components/editor/ToolbarIconUpgrader.js';
import { initEmojiPicker } from './components/editor/EmojiPicker.js';
import { initializeShortcutValidation } from './managers/ShortcutRegistry.js';
import { AnimationService } from './effects/AnimationService.js';
import { getButtonController, ButtonController } from './components/ButtonController.js';

// StudyQuest modal (KAPLAY-based game)
import { StudyQuestModal } from './components/StudyQuestModal.js';

// App initialization modules
import {
  AppCoreManagers,
  AppSocialManagers,
  AppRecordingControls,
  AppAuthUI,
  AppEasterEggs,
  type CoreManagers,
  type SocialManagers,
} from './app-init/index.js';

// ===== Global State =====
let coreManagers: CoreManagers;
let socialManagers: SocialManagers;
let recordingControls: AppRecordingControls;

// Auth and settings managers (initialized separately)
let themeManager: ThemeManager;
let settingsManager: SettingsManager;
let authManager: AuthManager;
let authScreen: AuthScreen;
let userProfileMenu: UserProfileMenu;
let shareModal: ShareModal;
let accountSettingsModal: AccountSettingsModal;
let helpModal: HelpModal;
let trashModal: TrashModal;
let studyModeManager: StudyModeManager;
let commandPalette: CommandPalette;
let commandRegistry: CommandRegistry;
let aiSuggestionChip: AISuggestionChip;
let layoutManager: LayoutManager;
let layoutPicker: WorkspaceLayoutPicker;
let confettiManager: ConfettiManager;
let buttonController: ButtonController;
let studyQuestModal: StudyQuestModal;

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', async () => {
  // Get app version and print console art
  const version = await window.scribeCat.app.getVersion();
  AppEasterEggs.printConsoleArt(version);

  // Initialize theme manager first
  themeManager = new ThemeManager();
  await themeManager.initialize();

  // Initialize animation system (GSAP-powered)
  AnimationService.getInstance();
  buttonController = getButtonController();
  (window as any).buttonController = buttonController;
  console.log('%c🎬 Animation system initialized (GSAP)', 'color: #9b59b6; font-weight: bold;');

  // Validate keyboard shortcuts
  initializeShortcutValidation();

  // Initialize toolbar icons and emoji picker
  initToolbarUpgrades();
  initEmojiPicker();

  // Initialize core managers (audio, view, editor, transcription, AI, recording)
  coreManagers = await AppCoreManagers.initialize();

  // Set up periodic button state updates
  setInterval(() => recordingControls?.updateNewSessionButtonState(), 1000);

  // Initialize authentication
  authManager = new AuthManager();
  await authManager.initialize();
  authScreen = new AuthScreen(authManager);
  accountSettingsModal = new AccountSettingsModal(authManager);
  helpModal = new HelpModal();
  trashModal = new TrashModal();
  userProfileMenu = new UserProfileMenu(authManager, accountSettingsModal);

  // Initialize settings manager
  settingsManager = new SettingsManager(themeManager, authManager, accountSettingsModal);

  // Expose authManager globally
  window.authManager = authManager;

  // Initialize study mode manager
  studyModeManager = new StudyModeManager(authManager);
  await studyModeManager.initialize();
  window.studyModeManager = studyModeManager;

  // Initialize sharing
  shareModal = new ShareModal();
  shareModal.initialize();
  window.shareModal = shareModal;

  // Initialize social managers (friends, study rooms, messages)
  socialManagers = AppSocialManagers.initialize();

  // Initialize StudyQuest modal (KAPLAY-based game)
  studyQuestModal = new StudyQuestModal();
  window.studyQuestModal = studyQuestModal;

  // Initialize recording controls
  recordingControls = new AppRecordingControls({
    recordingManager: coreManagers.recordingManager,
    deviceManager: coreManagers.deviceManager,
    sessionResetManager: coreManagers.sessionResetManager,
    audioManager: coreManagers.audioManager,
  });

  // Set up auth UI
  AppAuthUI.setup({
    authManager,
    authScreen,
    friendsManager: socialManagers.friendsManager,
    messagesManager: socialManagers.messagesManager,
    studyRoomsManager: socialManagers.studyRoomsManager,
    browseRoomsModal: socialManagers.browseRoomsModal,
    studyRoomView: socialManagers.studyRoomView,
    realtimeNotificationManager: socialManagers.realtimeNotificationManager,
    notificationTicker,
    studyQuestModal,
  });

  // Set up event listeners
  setupEventListeners();

  // Set up toolbar toggle
  setupToolbarToggle();

  // Initialize command palette
  commandPalette = new CommandPalette();
  commandPalette.initialize();

  commandRegistry = new CommandRegistry(commandPalette);
  commandRegistry.registerAllCommands({
    recordingManager: coreManagers.recordingManager,
    studyModeManager,
    viewManager: coreManagers.viewManager,
    editorManager: coreManagers.editorManager,
    transcriptionManager: coreManagers.transcriptionManager,
    settingsManager,
    aiManager: coreManagers.aiManager,
    courseManager: coreManagers.courseManager,
    authManager,
  });

  // Initialize AI suggestion chip
  aiSuggestionChip = new AISuggestionChip();
  aiSuggestionChip.initialize(
    (suggestion) => {
      console.log('✅ User accepted suggestion:', suggestion.title);
      coreManagers.aiManager.markSuggestionAccepted(suggestion.id);
    },
    (suggestion) => {
      console.log('❌ User dismissed suggestion:', suggestion.title);
      coreManagers.aiManager.markSuggestionDismissed(suggestion.id);
    }
  );
  (window as any).aiSuggestionChip = aiSuggestionChip;

  // Initialize visual feedback managers
  notificationTicker.initialize();
  confettiManager = new ConfettiManager();
  (window as any).notificationTicker = notificationTicker;
  (window as any).confettiManager = confettiManager;

  // Initialize workspace layout manager
  layoutManager = new LayoutManager();
  layoutManager.initialize();
  (window as any).layoutManager = layoutManager;

  layoutPicker = new WorkspaceLayoutPicker(layoutManager);
  layoutPicker.initialize();

  // Layout picker button
  const openLayoutPickerBtn = document.getElementById('open-layout-picker-btn');
  openLayoutPickerBtn?.addEventListener('click', () => layoutPicker.open());

  // Initialize Easter Eggs
  AppEasterEggs.initialize();

  // ===== Phase 6: Polish & Delight =====
  console.log('%c✨ Phase 6: Polish & Delight initialized!', 'color: #ff69b4; font-weight: bold;');

  // Initialize accessibility features
  initializeA11yStyles();
  FocusManager.createSkipLink('#main-content');

  // Initialize sound system
  initializeSoundSystem();
  enableGlobalSoundEffects();

  // Initialize break reminders
  initializeBreakReminders(coreManagers.recordingManager);

  // Show welcome modal on first launch
  setTimeout(() => WelcomeModal.show(), 1000);

  // Expose Phase 6 managers globally
  (window as any).FocusManager = FocusManager;
  (window as any).WelcomeModal = WelcomeModal;
  (window as any).TutorialManager = TutorialManager;
  (window as any).SoundManager = SoundManager;
  (window as any).BreakReminders = BreakReminders;

  // Set up hot reload notification listener
  setupHotReloadListener();
});

/**
 * Set up all event listeners
 */
function setupEventListeners(): void {
  // Record button
  const recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
  recordBtn?.addEventListener('click', () => recordingControls.handleRecordToggle());

  // Pause button
  const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
  pauseBtn?.addEventListener('click', () => recordingControls.handlePauseToggle());

  // Bookmark button
  const bookmarkBtn = document.getElementById('bookmark-btn') as HTMLButtonElement;
  bookmarkBtn?.addEventListener('click', () => recordingControls.handleAddBookmark());

  // New Session button
  const newSessionBtn = document.getElementById('new-session-btn') as HTMLButtonElement;
  newSessionBtn?.addEventListener('click', () => recordingControls.handleNewSession());

  // Trash button
  const trashBtn = document.getElementById('trash-btn') as HTMLButtonElement;
  if (trashBtn) {
    trashBtn.addEventListener('click', () => trashModal.show());

    trashModal.onRestore(() => studyModeManager?.refresh());
    trashModal.onPermanentDelete(() => {});
    trashModal.onEmptyTrash(() => {});
  }

  // Friends button
  const friendsBtn = document.getElementById('friends-btn') as HTMLButtonElement;
  friendsBtn?.addEventListener('click', () => {
    const currentUser = authManager.getCurrentUser();
    if (currentUser) {
      socialManagers.friendsModal.open(currentUser.id);
    }
  });

  // Study Rooms button
  const studyRoomsBtn = document.getElementById('study-rooms-btn') as HTMLButtonElement;
  studyRoomsBtn?.addEventListener('click', () => {
    const currentUser = authManager.getCurrentUser();
    if (currentUser) {
      socialManagers.browseRoomsModal.show((roomId) => {
        socialManagers.studyRoomView.show(roomId, () => {
          socialManagers.browseRoomsModal.show((nextRoomId) =>
            socialManagers.studyRoomView.show(nextRoomId)
          );
        });
      });
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Shift+Space - Toggle recording
    if (e.shiftKey && e.key === ' ' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const target = e.target as HTMLElement;
      const isInputField = target instanceof HTMLInputElement ||
                          target instanceof HTMLTextAreaElement ||
                          target.isContentEditable;

      if (!isInputField) {
        e.preventDefault();
        recordingControls.handleRecordToggle();
      }
    }
  });

  // Update button states
  recordingControls?.updateNewSessionButtonState();
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

  toggleBtn.style.opacity = '0.6';
}

/**
 * Show a notification toast
 */
function showNotification(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
  const colors = { info: '#3498db', warning: '#f39c12', error: '#e74c3c' };

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
    setTimeout(() => document.body.removeChild(notification), 300);
  }, 5000);
}

/**
 * Set up hot reload notification listener
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
window.addEventListener('beforeunload', async () => {
  // Save notes before closing
  if (coreManagers?.notesAutoSaveManager) {
    console.log('[App] Saving notes before window close...');
    await coreManagers.notesAutoSaveManager.saveImmediately();
  }

  if (coreManagers?.recordingManager?.getIsRecording()) {
    coreManagers.audioManager.cleanup();
    coreManagers.recordingManager.cleanup();
  }

  // Set user offline
  if (socialManagers?.friendsManager) {
    console.log('[App] Setting user offline before window close...');
    await socialManagers.friendsManager.stopPresenceTracking();
  }

  // Leave any active study room
  if (socialManagers?.studyRoomView && socialManagers?.studyRoomsManager) {
    const currentRoomId = socialManagers.studyRoomView.getCurrentRoomId();
    if (currentRoomId) {
      console.log('[App] Leaving study room before window close:', currentRoomId);
      try {
        await socialManagers.studyRoomsManager.leaveRoom(currentRoomId);
      } catch (error) {
        console.error('[App] Failed to leave room on close:', error);
      }
    }
  }

  // Clean up hot reload listener
  if ((window.scribeCat as any).dev) {
    (window.scribeCat as any).dev.removeHotReloadListener();
  }

  // Clean up notes auto-save manager
  coreManagers?.notesAutoSaveManager?.cleanup();
});

// Debug helpers
(window as any).testNotification = () => {
  console.log('🧪 Testing notification system...');
  if (!notificationTicker) {
    console.error('❌ notificationTicker is not defined');
    return;
  }
  const container = document.getElementById('notification-ticker-content');
  if (!container) {
    console.error('❌ notification-ticker-content element not found');
    return;
  }
  console.log('📢 Showing test notification...');
  notificationTicker.info('🎉 Test notification! If you see this, the UI is working.', 7000);
  return '✅ Test complete';
};

(window as any).debugInvitations = () => {
  console.log('🔍 Debugging invitation system...');
  if (!socialManagers?.studyRoomsManager) {
    console.error('❌ StudyRoomsManager not initialized');
    return;
  }
  console.log('📊 Current invitations:', socialManagers.studyRoomsManager.getInvitations());
  return 'Check console for results...';
};

console.log('💡 Debug helpers ready:');
console.log('  - window.testNotification() - Test notification UI');
console.log('  - window.debugInvitations() - Check for missed realtime invitations');
