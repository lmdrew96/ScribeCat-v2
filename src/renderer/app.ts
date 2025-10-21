/**
 * ScribeCat Main Renderer Application
 * 
 * Coordinates audio recording, transcription, and UI updates.
 * This is the main entry point for the renderer process.
 */

import { AudioManager } from './audio-manager.js';
import { SettingsManager } from './settings.js';
import { VoskSetupDialog } from './components/vosk-setup-dialog.js';
// TODO: Re-enable when vosk-browser is properly configured
// import { VoskTranscriptionService } from './vosk-transcription-service.js';

// ===== State Management =====
let audioManager: AudioManager;
let settingsManager: SettingsManager;
// TODO: Re-enable when vosk-browser is properly configured
// let voskService: VoskTranscriptionService | null = null;
let isRecording = false;
let transcriptionSessionId: string | null = null;
let currentTranscriptionMode: 'simulation' | 'vosk' = 'simulation';
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
let transcriptionMode: HTMLElement;
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
  
  // Initialize settings manager
  settingsManager = new SettingsManager();
  
  // Load microphone devices
  await loadMicrophoneDevices();
  
  // Set up event listeners
  setupEventListeners();
  
  // Set up transcription listener
  setupTranscriptionListener();
  
  // Initialize UI state
  updateUIState('idle');
  
  // Check for first-run Vosk setup
  await checkVoskSetup();
  
  console.log('ScribeCat initialized successfully');
});

/**
 * Check if Vosk model is installed and show setup dialog if needed
 */
async function checkVoskSetup(): Promise<void> {
  try {
    const check = await window.scribeCat.transcription.vosk.model.isInstalled();
    
    if (!check.isInstalled) {
      // Check if user previously skipped
      const skipped = localStorage.getItem('vosk-setup-skipped');
      
      if (!skipped) {
        const setupDialog = new VoskSetupDialog();
        await setupDialog.show();
      }
    }
  } catch (error) {
    console.error('Error checking Vosk setup:', error);
  }
}

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
  transcriptionMode = document.getElementById('transcription-mode') as HTMLElement;
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
    console.log('Loading microphone devices...');
    
    // Request permission first
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    
    // Enumerate devices using Web API directly (no IPC needed)
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === 'audioinput');
    
    console.log('Found devices:', audioInputs);
    
    // Clear loading option
    microphoneSelect.innerHTML = '';
    
    if (audioInputs.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No microphones found';
      microphoneSelect.appendChild(option);
      microphoneSelect.disabled = true;
      return;
    }
    
    // Add devices to dropdown
    audioInputs.forEach((device, i) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Microphone ${i + 1}`;
      microphoneSelect.appendChild(option);
    });
    
    console.log(`Loaded ${audioInputs.length} microphone device(s)`);
  } catch (error) {
    console.error('Failed to load microphone devices:', error);
    microphoneSelect.innerHTML = '<option value="">Error loading devices</option>';
    microphoneSelect.disabled = true;
    
    // Show user-friendly error
    alert('Failed to access microphone devices. Please check permissions and grant access in system settings.');
  }
}

/**
 * Set up all event listeners
 */
function setupEventListeners(): void {
  // Record button
  recordBtn.addEventListener('click', handleRecordToggle);
  
  // Settings button is handled by SettingsManager
  // No need to add listener here
  
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
  // Simulation mode listener
  window.scribeCat.transcription.simulation.onResult((result) => {
    if (currentTranscriptionMode === 'simulation') {
      addTranscriptionEntry(result.timestamp, result.text);
    }
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
    
    // Get transcription mode from settings
    const mode = await window.scribeCat.store.get('transcription-mode') as string || 'simulation';
    currentTranscriptionMode = mode as 'simulation' | 'vosk';
    
    console.log(`Starting recording with ${currentTranscriptionMode} mode...`);
    
    // Start audio recording
    await audioManager.startRecording({
      deviceId: selectedDeviceId,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    });
    
    // Start appropriate transcription service
    if (currentTranscriptionMode === 'simulation') {
      await startSimulationTranscription();
    } else {
      await startVoskTranscription();
    }
    
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
    await cleanupRecording();
    isRecording = false;
    updateUIState('idle');
  }
}

/**
 * Start simulation transcription
 */
async function startSimulationTranscription(): Promise<void> {
  const result = await window.scribeCat.transcription.simulation.start();
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to start simulation transcription');
  }
  
  transcriptionSessionId = result.sessionId!;
}

/**
 * Start Vosk transcription
 */
async function startVoskTranscription(): Promise<void> {
  // Get model URL and path from settings
  const modelUrl = await window.scribeCat.store.get('transcription.vosk.modelUrl') as string;
  const modelPath = await window.scribeCat.store.get('transcription.vosk.modelPath') as string;
  
  console.log('=== VOSK DEBUG INFO ===');
  console.log('Model URL:', modelUrl);
  console.log('Model Path:', modelPath);
  console.log('Model Path Type:', typeof modelPath);
  
  if (!modelPath || typeof modelPath !== 'string') {
    throw new Error('Invalid model path in settings. Please re-download the model in Settings.');
  }
  
  if (!modelUrl || typeof modelUrl !== 'string') {
    throw new Error('Vosk model not configured. Please download the model in Settings.');
  }
  
  // Make sure server is running with the correct path
  const serverStatus = await window.scribeCat.transcription.vosk.isServerRunning();
  if (!serverStatus.isRunning) {
    console.log('Vosk server not running, starting it...');
    const startResult = await window.scribeCat.transcription.vosk.startServer(modelPath);
    if (!startResult.success) {
      throw new Error(`Failed to start Vosk server: ${startResult.error || 'Unknown error'}`);
    }
    console.log('Vosk server started successfully');
  }
  
  // Test if server is accessible
  try {
    console.log('Testing server accessibility...');
    const testResponse = await fetch('http://localhost:8765/debug/files');
    const debugInfo = await testResponse.json();
    console.log('Server debug info:', debugInfo);
    console.log('Number of files found:', debugInfo.files?.length || 0);
  } catch (e) {
    console.error('Server not accessible:', e);
  }
  
  // Test if model config is accessible
  console.log('Attempting to fetch model config...');
  try {
    const configTest = await fetch(`${modelUrl}/conf/mfcc.conf`);
    console.log('Config fetch status:', configTest.status);
    if (configTest.ok) {
      const configContent = await configTest.text();
      console.log('Config content (first 200 chars):', configContent.substring(0, 200));
    } else {
      console.error('Config fetch failed with status:', configTest.status);
    }
  } catch (e) {
    console.error('Config fetch failed:', e);
  }
  
  console.log('=== END DEBUG ===');
  
  // Get audio stream from recorder
  const stream = audioManager['recorder'].getAudioStream();
  if (!stream) {
    throw new Error('Failed to get audio stream for transcription');
  }
  
  // TODO: Re-enable when vosk-browser is properly configured
  throw new Error('Vosk transcription not yet available. Please use Simulation mode.');
  
  /*
  // Initialize Vosk service if not already done
  if (!voskService) {
    voskService = new VoskTranscriptionService();
  }
  
  // Set up result listener
  voskService.onResult((result) => {
    if (currentTranscriptionMode === 'vosk') {
      addTranscriptionEntry(result.timestamp, result.text);
    }
  });
  
  // Set up error listener
  voskService.onError((error) => {
    console.error('Vosk error:', error);
    alert(`Transcription error: ${error.message}`);
  });
  
  // Initialize and start with the audio stream
  await voskService.initialize({ modelUrl: modelUrl });
  const sessionId = await voskService.start(stream);
  transcriptionSessionId = sessionId;
  */
}

/**
 * Stop recording and transcription
 */
async function stopRecording(): Promise<void> {
  try {
    console.log('Stopping recording...');
    
    // Stop appropriate transcription service
    if (transcriptionSessionId) {
      if (currentTranscriptionMode === 'simulation') {
        await window.scribeCat.transcription.simulation.stop(transcriptionSessionId);
      }
      // TODO: Re-enable when vosk-browser is properly configured
      // else if (voskService) {
      //   await voskService.stop();
      // }
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
 * Clean up recording resources
 */
async function cleanupRecording(): Promise<void> {
  try {
    if (transcriptionSessionId) {
      if (currentTranscriptionMode === 'simulation') {
        await window.scribeCat.transcription.simulation.stop(transcriptionSessionId);
      }
      // TODO: Re-enable when vosk-browser is properly configured
      // else if (voskService) {
      //   await voskService.stop();
      // }
      transcriptionSessionId = null;
    }
    
    await audioManager.stopRecording();
  } catch (error) {
    console.error('Error during cleanup:', error);
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
    
    // Update transcription mode display
    const modeText = currentTranscriptionMode === 'simulation' ? 'Simulation' : 'Vosk';
    transcriptionMode.textContent = `Mode: ${modeText}`;
    transcriptionMode.className = `mode-indicator ${currentTranscriptionMode}`;
    
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
    
    // Clear mode display
    transcriptionMode.textContent = '';
    transcriptionMode.className = 'mode-indicator';
    
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
    if (currentTranscriptionMode === 'simulation') {
      window.scribeCat.transcription.simulation.stop(transcriptionSessionId).catch(err => {
        console.error('Error stopping transcription on unload:', err);
      });
    }
    // TODO: Re-enable when vosk-browser is properly configured
    // else if (voskService) {
    //   voskService.stop().catch(err => {
    //     console.error('Error stopping Vosk on unload:', err);
    //   });
    // }
  }
  
  window.scribeCat.transcription.simulation.removeResultListener();
});
