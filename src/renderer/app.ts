/**
 * ScribeCat Main Renderer Application
 * 
 * Coordinates audio recording, transcription, and UI updates.
 * This is the main entry point for the renderer process.
 */

import { AudioManager } from './audio-manager.js';
import { SettingsManager } from './settings.js';
import { VoskSetupDialog } from './components/vosk-setup-dialog.js';
import { VoskTranscriptionService } from './vosk-transcription-service.js';

// ===== State Management =====
let audioManager: AudioManager;
let settingsManager: SettingsManager;
let voskService: VoskTranscriptionService | null = null;
let isRecording = false;
let transcriptionSessionId: string | null = null;
let currentTranscriptionMode: 'simulation' | 'vosk' | 'whisper' = 'simulation';
let elapsedTimer: number | null = null;
let startTime: number = 0;
let vuMeterInterval: number | null = null;
let whisperAudioBuffer: Float32Array[] = [];
let whisperLastProcessTime: number = 0;

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
  
  // Whisper result listener
  window.scribeCat.transcription.whisper.onResult((result) => {
    if (currentTranscriptionMode === 'whisper') {
      console.log('🎤 Whisper transcription:', result.text);
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
    currentTranscriptionMode = mode as 'simulation' | 'vosk' | 'whisper';
    
    console.log(`Starting recording with ${currentTranscriptionMode} mode...`);
    
    // Start audio recording with optimized settings for transcription
    await audioManager.startRecording({
      deviceId: selectedDeviceId,
      echoCancellation: true,   // ✅ Keep - removes echo
      noiseSuppression: true,   // ✅ Keep - reduces background noise  
      autoGainControl: false    // ❌ DISABLE - causes level fluctuations
    });
    
    // Start appropriate transcription service
    if (currentTranscriptionMode === 'simulation') {
      await startSimulationTranscription();
    } else if (currentTranscriptionMode === 'whisper') {
      await startWhisperTranscription();
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
    
    // IMPORTANT: Clean up on error to prevent "already recording" state
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
 * Start Whisper transcription
 */
async function startWhisperTranscription(): Promise<void> {
  // Get model path
  const pathResult = await window.scribeCat.transcription.whisper.model.getPath('base');
  
  if (!pathResult.success) {
    throw new Error('Failed to get Whisper model path');
  }
  
  const modelPath = pathResult.modelPath;
  
  // Check if model is installed
  const installedCheck = await window.scribeCat.transcription.whisper.model.isInstalled('base');
  if (!installedCheck.isInstalled) {
    throw new Error('Whisper model not installed. Please download it in Settings.');
  }
  
  console.log('Starting Whisper transcription with model:', modelPath);
  
  // Start transcription
  const result = await window.scribeCat.transcription.whisper.start(modelPath);
  
  if (!result.success) {
    throw new Error(`Failed to start Whisper: ${result.error}`);
  }
  
  transcriptionSessionId = result.sessionId!;
  
  // Start audio streaming
  startWhisperAudioStreaming();
  
  console.log('Whisper transcription and audio streaming started');
}

/**
 * Start streaming audio to Whisper transcription service
 */
function startWhisperAudioStreaming(): void {
  whisperAudioBuffer = [];
  whisperLastProcessTime = Date.now();
  const PROCESS_INTERVAL = 2000; // Process every 2 seconds (faster response!)

  // Set up audio data callback
  audioManager.onAudioData((audioData: Float32Array) => {
    if (currentTranscriptionMode !== 'whisper') return;

    // Buffer audio data
    whisperAudioBuffer.push(new Float32Array(audioData));

    // Process every 2 seconds
    const now = Date.now();
    if (now - whisperLastProcessTime >= PROCESS_INTERVAL) {
      processWhisperBuffer();
      whisperLastProcessTime = now;
    }
  });

  console.log('Whisper audio streaming enabled');
}

/**
 * Resample audio from source sample rate to 16kHz for Whisper
 */
function resampleAudio(audioData: Float32Array, sourceSampleRate: number, targetSampleRate: number = 16000): Float32Array {
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

    // Linear interpolation
    result[i] = audioData[srcIndexFloor] * (1 - t) + audioData[srcIndexCeil] * t;
  }

  return result;
}

/**
 * Process buffered audio and send to Whisper
 */
async function processWhisperBuffer(): Promise<void> {
  if (whisperAudioBuffer.length === 0 || !transcriptionSessionId) return;

  try {
    // Combine all buffered audio
    const totalLength = whisperAudioBuffer.reduce((sum, arr) => sum + arr.length, 0);
    const combined = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of whisperAudioBuffer) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    // 🎯 Calculate current audio level
    let maxLevel = 0;
    for (let i = 0; i < combined.length; i++) {
      const abs = Math.abs(combined[i]);
      if (abs > maxLevel) maxLevel = abs;
    }
    
    // 🎯 Apply adaptive gain if audio is too quiet
    const targetLevel = 0.3; // Target 30% of max range
    if (maxLevel > 0 && maxLevel < targetLevel) {
      const gain = targetLevel / maxLevel;
      const safeGain = Math.min(gain, 4.0); // Limit to 4x boost max
      console.log(`🔊 Boosting quiet audio: ${maxLevel.toFixed(3)} → ${(maxLevel * safeGain).toFixed(3)} (${safeGain.toFixed(1)}x gain)`);
      
      for (let i = 0; i < combined.length; i++) {
        combined[i] = Math.max(-1, Math.min(1, combined[i] * safeGain));
      }
    }

    // Get the actual sample rate from AudioContext
    const sourceSampleRate = audioManager['analyzer']['audioContext']?.sampleRate || 48000;
    
    console.log('🔊 SAMPLE RATE DEBUG:');
    console.log('  Source sample rate:', sourceSampleRate, 'Hz');
    console.log('  Target sample rate: 16000 Hz');
    console.log('  Original samples:', combined.length);

    // Resample to 16kHz for Whisper
    const resampled = resampleAudio(combined, sourceSampleRate, 16000);
    
    console.log('  Resampled samples:', resampled.length);
    console.log('  Original duration:', (combined.length / sourceSampleRate).toFixed(2), 's');
    console.log('  Resampled duration:', (resampled.length / 16000).toFixed(2), 's');

    // ===== WAVEFORM DEBUG CODE =====
    // Sample first 50 values to see waveform pattern
    console.log('📊 WAVEFORM SAMPLE (first 50 values):');
    const sampleValues = [];
    for (let i = 0; i < Math.min(50, resampled.length); i++) {
      sampleValues.push(resampled[i].toFixed(4));
    }
    console.log('  Values:', sampleValues.join(', '));

    // Check if it's just noise (values should vary significantly for speech)
    const firstHalf = resampled.slice(0, Math.floor(resampled.length / 2));
    const secondHalf = resampled.slice(Math.floor(resampled.length / 2));
    const firstAvg = firstHalf.reduce((sum, val) => sum + Math.abs(val), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + Math.abs(val), 0) / secondHalf.length;

    console.log('  First half avg:', firstAvg.toFixed(4));
    console.log('  Second half avg:', secondAvg.toFixed(4));

    if (Math.abs(firstAvg - secondAvg) < 0.001) {
      console.warn('⚠️ Audio looks like uniform noise (both halves similar)');
    } else {
      console.log('  ✅ Audio has variation (likely real signal)');
    }
    // ===== END DEBUG CODE =====

    // Check audio levels on resampled data
    let resampledMaxLevel = 0;
    let sumLevel = 0;
    for (let i = 0; i < resampled.length; i++) {
      const abs = Math.abs(resampled[i]);
      if (abs > resampledMaxLevel) resampledMaxLevel = abs;
      sumLevel += abs;
    }
    const avgLevel = sumLevel / resampled.length;
    
    console.log('🎤 AUDIO DEBUG (after resampling):');
    console.log('  Max level:', resampledMaxLevel.toFixed(4));
    console.log('  Avg level:', avgLevel.toFixed(4));
    
    if (resampledMaxLevel < 0.01) {
      console.warn('⚠️ WARNING: Audio level is very low after resampling!');
    } else {
      console.log('  ✅ Audio levels look good!');
    }

    // Convert Float32Array to Int16Array (PCM 16-bit)
    const int16Data = new Int16Array(resampled.length);
    for (let i = 0; i < resampled.length; i++) {
      const s = Math.max(-1, Math.min(1, resampled[i]));
      int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Send to main process
    await window.scribeCat.transcription.whisper.processAudio(
      transcriptionSessionId,
      Array.from(int16Data)
    );

    // Clear buffer
    whisperAudioBuffer = [];
    
    console.log('📤 Sent resampled audio chunk to Whisper for processing');
  } catch (error) {
    console.error('Error processing Whisper audio buffer:', error);
  }
}

/**
 * Stop Whisper audio streaming
 */
function stopWhisperAudioStreaming(): void {
  audioManager.removeAudioDataCallback();
  whisperAudioBuffer = [];
  console.log('Whisper audio streaming stopped');
}

/**
 * Start Vosk transcription
 */
async function startVoskTranscription(): Promise<void> {
  const modelPath = await window.scribeCat.store.get('transcription.vosk.modelPath') as string;
  
  console.log('=== VOSK STARTUP DEBUG ===');
  console.log('Model Path:', modelPath);
  
  if (!modelPath || typeof modelPath !== 'string') {
    throw new Error('Vosk model path not configured. Please download a model in Settings.');
  }
  
  // Check if server is already running
  console.log('Checking server status...');
  const serverStatus = await window.scribeCat.transcription.vosk.isServerRunning();
  console.log('Server status:', serverStatus);
  
  let serverUrl: string;
  
  if (!serverStatus.success) {
    throw new Error(`Failed to check server status: ${serverStatus.error || 'Unknown error'}`);
  }
  
  if (!serverStatus.isRunning) {
    console.log('Server not running, starting it with path:', modelPath);
    
    // Start the server
    const startResult = await window.scribeCat.transcription.vosk.startServer(modelPath);
    console.log('Start server result:', startResult);
    
    if (!startResult.success) {
      throw new Error(`Failed to start Vosk server: ${startResult.error || 'Unknown error'}`);
    }
    
    if (!startResult.serverUrl) {
      console.error('Server started but no URL returned. Full result:', startResult);
      throw new Error('Server started but no URL returned');
    }
    
    serverUrl = startResult.serverUrl;
    console.log('Server started successfully at:', serverUrl);
  } else {
    if (!serverStatus.serverUrl) {
      throw new Error('Server is running but no URL available');
    }
    serverUrl = serverStatus.serverUrl;
    console.log('Using already-running server at:', serverUrl);
  }
  
  // Verify server is accessible
  console.log('Testing server accessibility...');
  try {
    const testResponse = await fetch(`${serverUrl}/debug/files`);
    if (!testResponse.ok) {
      throw new Error(`Server returned status ${testResponse.status}`);
    }
    const debugInfo = await testResponse.json();
    console.log('Server accessible! Files found:', debugInfo.files?.length || 0);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    throw new Error(`Vosk server not accessible: ${errorMsg}`);
  }
  
  // Test if model config is accessible
  console.log('Testing model config...');
  try {
    const configTest = await fetch(`${serverUrl}/conf/mfcc.conf`);
    if (!configTest.ok) {
      throw new Error(`Config file not found (status ${configTest.status})`);
    }
    console.log('Model config verified!');
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    throw new Error(`Model files not accessible: ${errorMsg}`);
  }
  
  console.log('=== VOSK VERIFIED SUCCESSFULLY ===');
  
  // Get audio stream from recorder
  const stream = audioManager['recorder'].getAudioStream();
  if (!stream) {
    throw new Error('Failed to get audio stream for transcription');
  }
  
  // Initialize Vosk service if not already done
  if (!voskService) {
    voskService = new VoskTranscriptionService();
  }
  
  // Set up result listener
  voskService.onResult((result) => {
    if (currentTranscriptionMode === 'vosk') {
      // Only show final results in transcription panel
      if (result.isFinal) {
        addTranscriptionEntry(result.timestamp, result.text);
      }
      // Partial results are ignored for now, but could be shown in a separate area
    }
  });
  
  // Set up error listener
  voskService.onError((error) => {
    console.error('Vosk transcription error:', error);
    alert(`Transcription error: ${error.message}`);
  });
  
  // Initialize with server URL
  await voskService.initialize({ modelUrl: serverUrl });
  
  // Start transcription with audio stream
  const sessionId = await voskService.start(stream);
  transcriptionSessionId = sessionId;
  
  console.log('Real Vosk transcription started!');
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
      } else if (currentTranscriptionMode === 'whisper') {
        // Process any remaining buffered audio before stopping
        if (whisperAudioBuffer.length > 0) {
          await processWhisperBuffer();
        }
        stopWhisperAudioStreaming();
        await window.scribeCat.transcription.whisper.stop(transcriptionSessionId);
      } else if (voskService) {
        await voskService.stop();
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
      } else if (currentTranscriptionMode === 'whisper') {
        stopWhisperAudioStreaming();
        await window.scribeCat.transcription.whisper.stop(transcriptionSessionId);
      } else if (voskService) {
        await voskService.stop();
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
    let modeText = 'Simulation';
    if (currentTranscriptionMode === 'whisper') {
      modeText = 'Whisper';
    } else if (currentTranscriptionMode === 'vosk') {
      modeText = 'Vosk';
    }
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
    } else if (currentTranscriptionMode === 'whisper') {
      stopWhisperAudioStreaming();
      window.scribeCat.transcription.whisper.stop(transcriptionSessionId).catch(err => {
        console.error('Error stopping Whisper on unload:', err);
      });
    } else if (voskService) {
      voskService.stop().catch(err => {
        console.error('Error stopping Vosk on unload:', err);
      });
    }
  }
  
  window.scribeCat.transcription.simulation.removeResultListener();
  window.scribeCat.transcription.whisper.removeResultListener();
});
