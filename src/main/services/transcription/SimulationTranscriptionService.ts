/**
 * Simulation Transcription Service
 * 
 * Provides simulated transcription for testing without requiring Vosk/Whisper.
 * Emits predefined phrases at regular intervals to simulate real-time transcription.
 */

import { ITranscriptionService, TranscriptionResult, TranscriptionConfig } from './ITranscriptionService';

/**
 * Simulation phrases (from v1 analysis)
 */
const SIMULATION_PHRASES = [
  "This is a simulated transcription.",
  "The simulation mode is working correctly.",
  "These are test phrases to demonstrate functionality.",
  "Real transcription would connect to Vosk or Whisper services.",
  "Switch to real mode in settings to use actual transcription."
];

/**
 * Interval between phrases in milliseconds
 */
const PHRASE_INTERVAL_MS = 3000;

/**
 * Simulation Transcription Service
 * 
 * Implements ITranscriptionService with simulated transcription for testing.
 * Emits predefined phrases at regular intervals to simulate real-time speech-to-text.
 */
export class SimulationTranscriptionService implements ITranscriptionService {
  private isInitialized = false;
  private activeSessionId: string | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private currentPhraseIndex = 0;
  private startTime = 0;
  private resultCallback: ((result: TranscriptionResult) => void) | null = null;

  /**
   * Initialize the simulation service
   * @param config Configuration (not used in simulation)
   */
  async initialize(config?: TranscriptionConfig): Promise<void> {
    if (this.isInitialized) {
      console.warn('SimulationTranscriptionService already initialized');
      return;
    }

    console.log('Initializing SimulationTranscriptionService', config);
    this.isInitialized = true;
  }

  /**
   * Start a new transcription session
   * @returns Session ID
   */
  async start(): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized. Call initialize() first.');
    }

    if (this.activeSessionId) {
      throw new Error('A transcription session is already active. Stop it before starting a new one.');
    }

    // Generate unique session ID
    this.activeSessionId = `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.startTime = Date.now();
    this.currentPhraseIndex = 0;

    console.log(`Starting simulation transcription session: ${this.activeSessionId}`);

    // Start emitting phrases
    this.startEmittingPhrases();

    return this.activeSessionId;
  }

  /**
   * Stop an active transcription session
   * @param sessionId The session to stop
   */
  async stop(sessionId: string): Promise<void> {
    if (!this.activeSessionId) {
      console.warn('No active transcription session to stop');
      return;
    }

    if (this.activeSessionId !== sessionId) {
      throw new Error(`Session ID mismatch. Active: ${this.activeSessionId}, Requested: ${sessionId}`);
    }

    console.log(`Stopping simulation transcription session: ${sessionId}`);

    // Stop interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.activeSessionId = null;
    this.currentPhraseIndex = 0;
  }

  /**
   * Register callback for transcription results
   * @param callback Function to call when results are available
   */
  onResult(callback: (result: TranscriptionResult) => void): void {
    this.resultCallback = callback;
  }

  /**
   * Check if service is currently active
   */
  isActive(): boolean {
    return this.activeSessionId !== null;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.activeSessionId = null;
    this.resultCallback = null;
    this.isInitialized = false;
    console.log('SimulationTranscriptionService disposed');
  }

  /**
   * Start emitting simulation phrases at regular intervals
   */
  private startEmittingPhrases(): void {
    // Emit first phrase immediately
    this.emitNextPhrase();

    // Set up interval for subsequent phrases
    this.intervalId = setInterval(() => {
      this.emitNextPhrase();
    }, PHRASE_INTERVAL_MS);
  }

  /**
   * Emit the next phrase in the sequence
   */
  private emitNextPhrase(): void {
    if (!this.activeSessionId || !this.resultCallback) {
      return;
    }

    const phrase = SIMULATION_PHRASES[this.currentPhraseIndex];
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;

    const result: TranscriptionResult = {
      text: phrase,
      timestamp: elapsedSeconds,
      isFinal: true
    };

    console.log(`Emitting simulation phrase [${this.currentPhraseIndex}]: "${phrase}" at ${elapsedSeconds.toFixed(1)}s`);
    this.resultCallback(result);

    // Move to next phrase, loop back to start if at end
    this.currentPhraseIndex = (this.currentPhraseIndex + 1) % SIMULATION_PHRASES.length;
  }
}
