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

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log('ScribeCat initializing...');
  
  // Initialize theme manager first
  themeManager = new ThemeManager();
  await themeManager.initialize();
  
  // Initialize core managers
  audioManager = new AudioManager();
  settingsManager = new SettingsManager(themeManager);

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
  
  // Expose courseManager globally for settings to access
  (window as any).courseManager = courseManager;
  
  // Initialize recording manager (coordinates everything)
  recordingManager = new RecordingManager(
    audioManager,
    transcriptionManager,
    viewManager,
    editorManager,
    aiManager,
    courseManager
  );
  recordingManager.initialize();
  
  // Initialize editor
  editorManager.initialize();
  
  // Set up periodic button state updates
  setInterval(updateClearButtonStates, 1000);
  
  // Load microphone devices
  await deviceManager.loadDevices();
  
  // Initialize study mode manager
  studyModeManager = new StudyModeManager();
  await studyModeManager.initialize();
  
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
 * Clean up on window unload
 */
window.addEventListener('beforeunload', () => {
  if (recordingManager.getIsRecording()) {
    audioManager.cleanup();
    recordingManager.cleanup();
  }
  
  window.scribeCat.transcription.simulation.removeResultListener();
});
