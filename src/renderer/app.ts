/**
 * ScribeCat Main Renderer Application
 * 
 * Coordinates audio recording, transcription, and UI updates.
 * This is the main entry point for the renderer process.
 */

import { AudioManager } from './audio-manager.js';
import { SettingsManager } from './settings.js';
import { AssemblyAITranscriptionService } from './assemblyai-transcription-service.js';
import { AIManager } from './ai-manager.js';
import { ExportManager } from './export-manager.js';

// ===== State Management =====
let audioManager: AudioManager;
let settingsManager: SettingsManager;
let aiManager: AIManager;
let exportManager: ExportManager;
let assemblyAIService: AssemblyAITranscriptionService | null = null;
let isRecording = false;
let transcriptionSessionId: string | null = null;
let currentTranscriptionMode: 'simulation' | 'assemblyai' = 'simulation';
let elapsedTimer: number | null = null;
let startTime: number = 0;
let vuMeterInterval: number | null = null;
let lastPartialText = '';

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

// ===== Helper Functions for AI Manager =====

/**
 * Get current transcription text
 */
function getTranscriptionText(): string {
  const flowingText = transcriptionContainer.querySelector('.flowing-transcription');
  if (flowingText) {
    return flowingText.textContent || '';
  }
  return '';
}

/**
 * Get current notes text
 */
function getNotesText(): string {
  return notesEditor.textContent || '';
}

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log('ScribeCat initializing...');
  
  // Get DOM element references
  initializeDOMReferences();
  
  // Initialize audio manager
  audioManager = new AudioManager();
  
  // Initialize settings manager
  settingsManager = new SettingsManager();
  
  // Initialize AI manager
  aiManager = new AIManager(
    () => getTranscriptionText(),
    () => getNotesText()
  );
  await aiManager.initialize();
  
  // Initialize export manager
  exportManager = new ExportManager();
  
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
    currentTranscriptionMode = mode as 'simulation' | 'assemblyai';
    
    console.log(`Starting recording with ${currentTranscriptionMode} mode...`);
    
    // Start audio recording with optimized settings for transcription
    await audioManager.startRecording({
      deviceId: selectedDeviceId,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false
    });
    
    // Start appropriate transcription service
    if (currentTranscriptionMode === 'simulation') {
      await startSimulationTranscription();
    } else if (currentTranscriptionMode === 'assemblyai') {
      await startAssemblyAITranscription();
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
    
    // Clean up on error
    await cleanupRecording();
    isRecording = false;
    updateUIState('idle');
    
    alert(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
 * Start AssemblyAI transcription
 */
async function startAssemblyAITranscription(): Promise<void> {
  const apiKey = await window.scribeCat.store.get('assemblyai-api-key') as string;
  
  if (!apiKey) {
    throw new Error('AssemblyAI API key not configured. Please add it in Settings.');
  }

  console.log('Starting AssemblyAI transcription...');
  
  // Create and initialize service (runs in renderer)
  assemblyAIService = new AssemblyAITranscriptionService();
  await assemblyAIService.initialize(apiKey);
  
  // Set up result callback
  assemblyAIService.onResult((text: string, isFinal: boolean) => {
    console.log('🎤 AssemblyAI:', isFinal ? 'Final' : 'Partial', text);
    updateFlowingTranscription(text, isFinal);
  });
  
  // Start session
  transcriptionSessionId = await assemblyAIService.start();
  
  // Start audio streaming
  startAssemblyAIAudioStreaming();
  
  console.log('AssemblyAI transcription started');
}

/**
 * Start streaming audio to AssemblyAI
 */
function startAssemblyAIAudioStreaming(): void {
  const CHUNK_INTERVAL = 100; // Send audio every 100ms for low latency
  let audioBuffer: Float32Array[] = [];

  audioManager.onAudioData((audioData: Float32Array) => {
    if (currentTranscriptionMode !== 'assemblyai') return;
    audioBuffer.push(new Float32Array(audioData));
  });

  // Send buffered audio regularly
  const intervalId = setInterval(() => {
    if (audioBuffer.length === 0 || currentTranscriptionMode !== 'assemblyai') return;
    
    // Combine buffered audio
    const totalLength = audioBuffer.reduce((sum, arr) => sum + arr.length, 0);
    const combined = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of audioBuffer) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    audioBuffer = [];

    // Get sample rate and resample to 16kHz
    const sourceSampleRate = (audioManager as any)['analyzer']['audioContext']?.sampleRate || 48000;
    const resampled = resampleAudioForAssemblyAI(combined, sourceSampleRate, 16000);

    // Convert to Int16 PCM
    const int16Data = new Int16Array(resampled.length);
    for (let i = 0; i < resampled.length; i++) {
      const s = Math.max(-1, Math.min(1, resampled[i]));
      int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Send directly to service (no IPC!)
    if (assemblyAIService) {
      assemblyAIService.sendAudio(int16Data.buffer);
    }
  }, CHUNK_INTERVAL);

  // Store interval ID for cleanup
  (window as any).assemblyAIStreamingInterval = intervalId;
  
  console.log('AssemblyAI audio streaming enabled');
}

/**
 * Resample audio for AssemblyAI (16kHz)
 */
function resampleAudioForAssemblyAI(audioData: Float32Array, sourceSampleRate: number, targetSampleRate: number = 16000): Float32Array {
  if (sourceSampleRate === targetSampleRate) {
    return audioData;
  }

  const sampleRateRatio = sourceSampleRate / targetSampleRate;
  const newLength = Math.round(audioData.length / sampleRateRatio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * sampleRateRatio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1);
    const t = srcIndex - srcIndexFloor;
    result[i] = audioData[srcIndexFloor] * (1 - t) + audioData[srcIndexCeil] * t;
  }

  return result;
}

/**
 * Stop AssemblyAI audio streaming
 */
function stopAssemblyAIAudioStreaming(): void {
  const intervalId = (window as any).assemblyAIStreamingInterval;
  if (intervalId) {
    clearInterval(intervalId);
    delete (window as any).assemblyAIStreamingInterval;
  }
  
  if (assemblyAIService) {
    assemblyAIService.stop();
    assemblyAIService = null;
  }
  
  audioManager.removeAudioDataCallback();
  console.log('AssemblyAI audio streaming stopped');
}

/**
 * Update flowing transcription with partial/final results
 */
function updateFlowingTranscription(text: string, isFinal: boolean): void {
  let flowingText = transcriptionContainer.querySelector('.flowing-transcription') as HTMLElement;
  
  if (!flowingText) {
    const placeholder = transcriptionContainer.querySelector('.transcription-placeholder');
    if (placeholder) placeholder.remove();
    
    flowingText = document.createElement('div');
    flowingText.className = 'flowing-transcription';
    transcriptionContainer.appendChild(flowingText);
  }

  if (isFinal) {
    // Final text - append permanently and clear partial
    if (lastPartialText) {
      // Remove the partial span
      const partialSpan = flowingText.querySelector('.partial-text');
      if (partialSpan) partialSpan.remove();
      lastPartialText = '';
    }
    
    // Add final text
    const textNode = document.createTextNode(' ' + text);
    flowingText.appendChild(textNode);
  } else {
    // Partial text - update the temporary span
    let partialSpan = flowingText.querySelector('.partial-text') as HTMLElement;
    
    if (!partialSpan) {
      partialSpan = document.createElement('span');
      partialSpan.className = 'partial-text';
      flowingText.appendChild(partialSpan);
    }
    
    partialSpan.textContent = ' ' + text;
    lastPartialText = text;
  }

  transcriptionContainer.scrollTop = transcriptionContainer.scrollHeight;
}

/**
 * Stop recording and transcription
 */
async function stopRecording(): Promise<void> {
  try {
    console.log('Stopping recording...');
    
    // Stop transcription first
    if (transcriptionSessionId) {
      if (currentTranscriptionMode === 'simulation') {
        await window.scribeCat.transcription.simulation.stop(transcriptionSessionId);
      } else if (currentTranscriptionMode === 'assemblyai') {
        stopAssemblyAIAudioStreaming();
      }
      transcriptionSessionId = null;
    }
    
    // Stop audio recording
    const result = await audioManager.stopRecording();
    const durationSeconds = result.duration / 1000;
    console.log('Recording stopped. Duration:', durationSeconds, 'seconds');
    
    // Save the recording to disk
    const saveResult = await window.scribeCat.recording.stop(
      result.audioData.buffer as ArrayBuffer,
      durationSeconds
    );
    
    if (!saveResult.success) {
      throw new Error(saveResult.error || 'Failed to save recording');
    }
    
    console.log('✅ Recording saved to:', saveResult.filePath);
    
    // Save transcription to session
    if (saveResult.sessionId) {
      const transcriptionText = getTranscriptionText();
      if (transcriptionText && transcriptionText.trim().length > 0) {
        console.log('Saving transcription to session...');
        const transcriptionResult = await window.scribeCat.session.updateTranscription(
          saveResult.sessionId,
          transcriptionText,
          currentTranscriptionMode
        );
        
        if (transcriptionResult.success) {
          console.log('✅ Transcription saved to session');
        } else {
          console.error('❌ Failed to save transcription:', transcriptionResult.error);
        }
      }
      
      // Save notes to session if any
      const notes = getNotesText();
      if (notes && notes.trim().length > 0) {
        console.log('Saving notes to session...');
        const notesResult = await window.scribeCat.session.updateNotes(
          saveResult.sessionId,
          notes
        );
        
        if (notesResult.success) {
          console.log('✅ Notes saved to session');
        } else {
          console.error('❌ Failed to save notes:', notesResult.error);
        }
      }
    }
    
    // Update state
    isRecording = false;
    
    // Update UI
    updateUIState('idle');
    stopElapsedTimer();
    stopVUMeterUpdates();
    
    // Show completion message with session ID
    sessionInfo.textContent = `Recording saved: ${saveResult.sessionId}`;
    setTimeout(() => {
      sessionInfo.textContent = '';
    }, 5000);
    
    // Enable export for this session
    if (saveResult.sessionId) {
      exportManager.enableExport(saveResult.sessionId);
    }
    
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
      } else if (currentTranscriptionMode === 'assemblyai') {
        stopAssemblyAIAudioStreaming();
        await window.scribeCat.transcription.assemblyai.stop(transcriptionSessionId);
      }
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
    const modeText = currentTranscriptionMode === 'assemblyai' ? 'AssemblyAI' : 'Simulation';
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
  lastPartialText = '';
}

/**
 * Add transcription entry to panel (for simulation mode)
 */
function addTranscriptionEntry(timestamp: number, text: string): void {
  // Get or create the flowing text container
  let flowingText = transcriptionContainer.querySelector('.flowing-transcription') as HTMLElement;
  
  if (!flowingText) {
    // Remove placeholder if it exists
    const placeholder = transcriptionContainer.querySelector('.transcription-placeholder');
    if (placeholder) {
      placeholder.remove();
    }
    
    // Create flowing text container
    flowingText = document.createElement('div');
    flowingText.className = 'flowing-transcription';
    transcriptionContainer.appendChild(flowingText);
  }
  
  // Append text with a space
  const textNode = document.createTextNode(' ' + text);
  flowingText.appendChild(textNode);
  
  // Auto-scroll to bottom
  transcriptionContainer.scrollTop = transcriptionContainer.scrollHeight;
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
      window.scribeCat.transcription.simulation.stop(transcriptionSessionId).catch((err: Error) => {
        console.error('Error stopping transcription on unload:', err);
      });
    } else if (currentTranscriptionMode === 'assemblyai') {
      stopAssemblyAIAudioStreaming();
    }
  }
  
  window.scribeCat.transcription.simulation.removeResultListener();
});
