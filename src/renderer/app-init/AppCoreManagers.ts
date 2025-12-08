/**
 * AppCoreManagers
 *
 * Initializes core managers: audio, view, editor, transcription, AI.
 */

import { AudioManager } from '../audio/AudioManager.js';
import { ViewManager } from '../managers/ViewManager.js';
import { TiptapEditorManager } from '../managers/TiptapEditorManager.js';
import { TranscriptionManager } from '../managers/TranscriptionManager.js';
import { DeviceManager } from '../managers/DeviceManager.js';
import { CourseManager } from '../managers/CourseManager.js';
import { AIManager } from '../ai/AIManager.js';
import { ChatUI } from '../ai/ChatUI.js';
import { NotesAutoSaveManager } from '../managers/NotesAutoSaveManager.js';
import { RecordingManager } from '../managers/RecordingManager.js';
import { SessionResetManager } from '../managers/SessionResetManager.js';
import { getRandomCatFact } from '../utils/cat-facts.js';

export interface CoreManagers {
  audioManager: AudioManager;
  viewManager: ViewManager;
  editorManager: TiptapEditorManager;
  transcriptionManager: TranscriptionManager;
  deviceManager: DeviceManager;
  courseManager: CourseManager;
  aiManager: AIManager;
  chatUI: ChatUI;
  notesAutoSaveManager: NotesAutoSaveManager;
  recordingManager: RecordingManager;
  sessionResetManager: SessionResetManager;
}

export class AppCoreManagers {
  /**
   * Initialize all core managers
   */
  static async initialize(): Promise<CoreManagers> {
    // Initialize audio manager
    const audioManager = new AudioManager();

    // Initialize UI managers
    const viewManager = new ViewManager();
    const editorManager = new TiptapEditorManager();
    const transcriptionManager = new TranscriptionManager();
    const deviceManager = new DeviceManager();

    // Initialize transcription placeholder with random cat fact
    const transcriptionPlaceholder = document.getElementById('transcription-placeholder');
    if (transcriptionPlaceholder) {
      transcriptionPlaceholder.textContent = getRandomCatFact();
    }

    // Initialize AI manager
    const aiManager = new AIManager(
      () => transcriptionManager.getText(),
      () => editorManager.getNotesText()
    );
    await aiManager.initialize();

    // Get ChatUI instance from AIManager
    const chatUI = aiManager.getChatUI();

    // Initialize course manager
    const courseManager = new CourseManager();

    // Expose managers globally
    window.courseManager = courseManager;
    window.aiManager = aiManager;

    // Initialize notes auto-save manager
    const notesAutoSaveManager = new NotesAutoSaveManager(editorManager);
    notesAutoSaveManager.initialize();

    // Expose notesAutoSaveManager globally
    (window as any).notesAutoSaveManager = notesAutoSaveManager;

    // Initialize recording manager
    const recordingManager = new RecordingManager(
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

    // Expose recordingManager globally
    (window as any).recordingManager = recordingManager;

    // Initialize session reset manager
    const sessionResetManager = new SessionResetManager(
      editorManager,
      transcriptionManager,
      notesAutoSaveManager,
      viewManager,
      recordingManager
    );

    // Initialize editor
    editorManager.initialize();

    // Set up auto-save callback on editor
    editorManager.setOnContentChangeCallback(() => {
      notesAutoSaveManager.onEditorUpdate();
    });

    // Load microphone devices
    await deviceManager.loadDevices();

    return {
      audioManager,
      viewManager,
      editorManager,
      transcriptionManager,
      deviceManager,
      courseManager,
      aiManager,
      chatUI,
      notesAutoSaveManager,
      recordingManager,
      sessionResetManager,
    };
  }
}
