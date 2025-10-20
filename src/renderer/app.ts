/**
 * ScribeCat Main Renderer Application
 * 
 * Coordinates audio recording, transcription, and UI updates.
 * This is the main entry point for the renderer process.
 */

import { AudioManager } from './audio-manager.js';

// ===== State Management =====
let audioManager: AudioManager;
let isRecording = false;
let transcriptionSessionId: string | null = null;
let elapsedTimer: number | null = null;
let startTime: number = 0;
let vuMeterInterval: number | null = null;

// ===== DOM Elements =====
let recordBtn: HTMLButtonElement;
let microphoneSelect: HTMLSelectElement;
let vuMeter: HTMLElement;
let settingsBtn: HTMLButtonElement;
let notesEditor: HTMLElement;
let transcriptionContainer: HTMLElement;
let recordingStatus: HTMLElement;
let elapsedTime: HTMLElement;
let sessionInfo: HTMLElement;
let charCount: HTMLElement;
let wordCount: HTMLElement;

// Formatting toolbar elements
let boldBtn: HTMLButtonElement;
let italicBtn: HTMLButtonElement;
let underlineBtn: HTMLButtonElement;
let fontSizeSelect: HTMLSelectElement;
let textColorPicker: HTMLInputElement;

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log('ScribeCat initializing...');
  
  // Get DOM element references
  initializeDOMReferences();
  
  // Initialize audio manager
  audioManager = new AudioManager();
  
  // Load microphone devices
  await loadMicrophoneDevices();
  
  // Set up event listeners
  setupEventListeners();
  
  // Set up transcription listener
  setupTranscriptionListener();
  
  // Initialize UI state
  updateUIState('idle');
  
  console.log('ScribeCat initialized successfully');
});

/**
 * Get references to all DOM elements
 */
function initializeDOMReferences(): void {
  // Control elements
  recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
  microphoneSelect = document.getElementById('microphone-select') as HTMLSelectElement;
  vuMeter = document.getElementById('vu-meter') as HTMLElement;
  settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
  
  // Editor elements
  notesEditor = document.getElementById('notes-editor') as HTMLElement;
  transcriptionContainer = document.getElementById('transcription-container') as HTMLElement;
  
  // Status elements
  recordingStatus = document.getElementById('recording-status') as HTMLElement;
  elapsedTime = document.getElementById('elapsed-time') as HTMLElement;
  sessionInfo = document.getElementById('session-info') as HTMLElement;
  charCount = document.getElementById('char-count') as HTMLElement;
  wordCount = document.getElementById('word-count') as HTMLElement;
  
  // Formatting toolbar
  boldBtn = document.getElementById('bold-btn') as HTMLButtonElement;
  italicBtn = document.getElementById('italic-btn') as HTMLButtonElement;
  underlineBtn = document.getElementById('underline-btn') as HTMLButtonElement;
  fontSizeSelect = document.getElementById('font-size-select') as HTMLSelectElement;
  textColorPicker = document.getElementById('text-color-picker') as HTMLInputElement;
}

/**
 * Load and populate microphone devices
 */
async function loadMicrophoneDevices(): Promise<void> {
  try {
    const devices = await audioManager.getDevices();
    
    // Clear loading option
    microphoneSelect.innerHTML = '';
    
    if (devices.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No microphones found';
      microphoneSelect.appendChild(option);
      microphoneSelect.disabled = true;
      return;
    }
    
    // Add devices to dropdown
    devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Microphone ${device.deviceId.substring(0, 8)}`;
      microphoneSelect.appendChild(option);
    });
    
    console.log(`Loaded ${devices.length} microphone device(s)`);
  } catch (error) {
    console.error('Failed to load microphone devices:', error);
    microphoneSelect.innerHTML = '<option value="">Error loading devices</option>';
    microphoneSelect.disabled = true;
    
    // Show user-friendly error
    alert('Failed to access microphone devices. Please check permissions.');
  }
}

/**
 * Set up all event listeners
 */
function setupEventListeners(): void {
  // Record button
  recordBtn.addEventListener('click', handleRecordToggle);
  
  // Settings button (placeholder)
  settingsBtn.addEventListener('click', () => {
    alert('Settings panel coming soon!');
  });
  
  // Formatting toolbar
  boldBtn.addEventListener('click', () => applyFormat('bold'));
  italicBtn.addEventListener('click', () => applyFormat('italic'));
  underlineBtn.addEventListener('click', () => applyFormat('underline'));
  
  fontSizeSelect.addEventListener('change', () => {
    const size = fontSizeSelect.value;
    applyFormat('fontSize', `${size}px`);
  });
  
  textColorPicker.addEventListener('change', () => {
    const color = textColorPicker.value;
    applyFormat('foreColor', color);
  });
  
  // Notes editor - update character/word count
  notesEditor.addEventListener('input', updateEditorStats);
  
  // Keyboard shortcuts for formatting
  notesEditor.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          applyFormat('bold');
          break;
        case 'i':
          e.preventDefault();
          applyFormat('italic');
          break;
        case 'u':
          e.preventDefault();
          applyFormat('underline');
          break;
      }
    }
  });
}

/**
 * Set up transcription result listener
 */
function setupTranscriptionListener(): void {
  window.scribeCat.transcription.simulation.onResult((result) => {
    addTranscriptionEntry(result.timestamp, result.text);
  });
}

/**
 * Handle record button toggle
 */
async function handleRecordToggle(): Promise<void> {
  if (!isRecording) {
    await startRecording();
  } else {
    await stopRecording();
  }
}

/**
 * Start recording and transcription
 */
async function startRecording(): Promise<void> {
  try {
    const selectedDeviceId = microphoneSelect.value;
    
    if (!selectedDeviceId) {
      alert('Please select a microphone device');
      return;
    }
    
    console.log('Starting recording...');
    
    // Start audio recording
    await audioManager.startRecording({
      deviceId: selectedDeviceId,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    });
    
    // Start transcription
    const transcriptionResult = await window.scribeCat.transcription.simulation.start();
    
    if (!transcriptionResult.success) {
      throw new Error(transcriptionResult.error || 'Failed to start transcription');
    }
    
    transcriptionSessionId = transcriptionResult.sessionId!;
    
    // Update state
    isRecording = true;
    startTime = Date.now();
    
    // Update UI
    updateUIState('recording');
    clearTranscriptionPanel();
    startElapsedTimer();
    startVUMeterUpdates();
    
    console.log('Recording started successfully');
  } catch (error) {
    console.error('Failed to start recording:', error);
    alert(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    // Clean up on error
    isRecording = false;
    updateUIState('idle');
  }
}

/**
 * Stop recording and transcription
 */
async function stopRecording(): Promise<void> {
  try {
    console.log('Stopping recording...');
    
    // Stop transcription
    if (transcriptionSessionId) {
      await window.scribeCat.transcription.simulation.stop(transcriptionSessionId);
      transcriptionSessionId = null;
    }
    
    // Stop audio recording
    const result = await audioManager.stopRecording();
    console.log('Recording stopped. Duration:', result.duration, 'seconds');
    
    // Update state
    isRecording = false;
    
    // Update UI
    updateUIState('idle');
    stopElapsedTimer();
    stopVUMeterUpdates();
    
    // Show completion message
    sessionInfo.textContent = `Recording saved (${result.duration.toFixed(1)}s)`;
    setTimeout(() => {
      sessionInfo.textContent = '';
    }, 5000);
    
    console.log('Recording stopped successfully');
  } catch (error) {
    console.error('Failed to stop recording:', error);
    alert(`Failed to stop recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update UI state based on recording status
 */
function updateUIState(state: 'idle' | 'recording'): void {
  if (state === 'recording') {
    // Update record button
    recordBtn.classList.add('recording');
    recordBtn.title = 'Stop Recording';
    
    // Update status
    recordingStatus.textContent = 'Recording';
    recordingStatus.classList.remove('idle');
    recordingStatus.classList.add('recording');
    
    // Disable device selection while recording
    microphoneSelect.disabled = true;
  } else {
    // Update record button
    recordBtn.classList.remove('recording');
    recordBtn.title = 'Start Recording';
    
    // Update status
    recordingStatus.textContent = 'Idle';
    recordingStatus.classList.remove('recording');
    recordingStatus.classList.add('idle');
    
    // Re-enable device selection
    microphoneSelect.disabled = false;
    
    // Reset VU meter
    vuMeter.style.width = '0%';
  }
}

/**
 * Start elapsed time timer
 */
function startElapsedTimer(): void {
  updateElapsedTime();
  elapsedTimer = window.setInterval(updateElapsedTime, 1000);
}

/**
 * Stop elapsed time timer
 */
function stopElapsedTimer(): void {
  if (elapsedTimer !== null) {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
  }
}

/**
 * Update elapsed time display
 */
function updateElapsedTime(): void {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  elapsedTime.textContent = formatTime(elapsed);
}

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Start VU meter updates
 */
function startVUMeterUpdates(): void {
  vuMeterInterval = window.setInterval(() => {
    const level = audioManager.getAudioLevel();
    updateVUMeter(level);
  }, 100);
}

/**
 * Stop VU meter updates
 */
function stopVUMeterUpdates(): void {
  if (vuMeterInterval !== null) {
    clearInterval(vuMeterInterval);
    vuMeterInterval = null;
  }
}

/**
 * Update VU meter display
 */
function updateVUMeter(level: number): void {
  // Level is 0-1, convert to percentage
  const percentage = Math.min(100, level * 100);
  vuMeter.style.width = `${percentage}%`;
}

/**
 * Clear transcription panel
 */
function clearTranscriptionPanel(): void {
  transcriptionContainer.innerHTML = '';
}

/**
 * Add transcription entry to panel
 */
function addTranscriptionEntry(timestamp: number, text: string): void {
  // Remove placeholder if it exists
  const placeholder = transcriptionContainer.querySelector('.transcription-placeholder');
  if (placeholder) {
    placeholder.remove();
  }
  
  // Create entry element
  const entry = document.createElement('div');
  entry.className = 'transcription-entry';
  
  const timeStr = formatTime(Math.floor(timestamp));
  entry.innerHTML = `<span class="timestamp">[${timeStr}]</span> ${escapeHtml(text)}`;
  
  transcriptionContainer.appendChild(entry);
  
  // Auto-scroll to bottom
  transcriptionContainer.scrollTop = transcriptionContainer.scrollHeight;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Apply formatting to selected text
 */
function applyFormat(command: string, value?: string): void {
  document.execCommand(command, false, value);
  notesEditor.focus();
}

/**
 * Update editor statistics (character and word count)
 */
function updateEditorStats(): void {
  const text = notesEditor.textContent || '';
  
  // Character count
  const chars = text.length;
  charCount.textContent = `${chars} character${chars !== 1 ? 's' : ''}`;
  
  // Word count
  const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
  wordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;
}

/**
 * Clean up on window unload
 */
window.addEventListener('beforeunload', () => {
  if (isRecording) {
    audioManager.cleanup();
  }
  
  if (transcriptionSessionId) {
    window.scribeCat.transcription.simulation.stop(transcriptionSessionId).catch(err => {
      console.error('Error stopping transcription on unload:', err);
    });
  }
  
  window.scribeCat.transcription.simulation.removeResultListener();
});
