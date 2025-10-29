/**
 * ScribeCat Main Renderer Application
 * 
 * Coordinates audio recording, transcription, and UI updates.
 * This is the main entry point for the renderer process.
 */

import { AudioManager } from './audio-manager.js';
import { SettingsManager } from './settings.js';
import { AIManager } from './ai/AIManager.js';
import { ExportManager } from './export-manager.js';
import { ViewManager } from './managers/ViewManager.js';
import { EditorManager } from './managers/EditorManager.js';
import { TranscriptionManager } from './managers/TranscriptionManager.js';
import { RecordingManager } from './managers/RecordingManager.js';
import { DeviceManager } from './managers/DeviceManager.js';
import { CourseManager } from './managers/CourseManager.js';
import { ThemeManager } from './themes/ThemeManager.js';

// ===== Managers =====
let audioManager: AudioManager;
let settingsManager: SettingsManager;
let themeManager: ThemeManager;
let aiManager: AIManager;
let exportManager: ExportManager;
let viewManager: ViewManager;
let editorManager: EditorManager;
let transcriptionManager: TranscriptionManager;
let recordingManager: RecordingManager;
let deviceManager: DeviceManager;
let courseManager: CourseManager;

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log('ScribeCat initializing...');
  
  // Initialize theme manager first
  themeManager = new ThemeManager();
  await themeManager.initialize();
  
  // Initialize core managers
  audioManager = new AudioManager();
  settingsManager = new SettingsManager(themeManager);
  exportManager = new ExportManager();
  
  // Initialize UI managers
  viewManager = new ViewManager();
  editorManager = new EditorManager();
  transcriptionManager = new TranscriptionManager();
  deviceManager = new DeviceManager();
  
  // Initialize AI manager first (needed by recording manager)
  aiManager = new AIManager(
    () => transcriptionManager.getText(),
    () => editorManager.getNotesText()
  );
  await aiManager.initialize();
  
  // Initialize recording manager (coordinates everything)
  recordingManager = new RecordingManager(
    audioManager,
    transcriptionManager,
    viewManager,
    editorManager,
    exportManager,
    aiManager
  );
  recordingManager.initialize();
  
  // Initialize editor
  editorManager.initialize();
  
  // Load microphone devices
  await deviceManager.loadDevices();
  
  // Initialize course manager
  courseManager = new CourseManager();
  
  // Expose courseManager globally for settings to access
  (window as any).courseManager = courseManager;
  
  // Set up event listeners
  setupEventListeners();
  
  console.log('ScribeCat initialized successfully');
});

/**
 * Set up all event listeners
 */
function setupEventListeners(): void {
  // Record button
  const recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
  recordBtn.addEventListener('click', handleRecordToggle);
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
 * Clean up on window unload
 */
window.addEventListener('beforeunload', () => {
  if (recordingManager.getIsRecording()) {
    audioManager.cleanup();
    recordingManager.cleanup();
  }
  
  window.scribeCat.transcription.simulation.removeResultListener();
});
