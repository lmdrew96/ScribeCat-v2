/**
 * NuggetNotesOrchestrator
 * Coordinates the two-model pipeline for real-time note generation.
 * Uses Sonnet 4.5 for lecture understanding and Haiku 4.5 for note generation.
 * Handles transcript buffering, timing thresholds, and auto-save.
 */

import { AIClient } from './AIClient.js';
import { LectureContextService, type LectureContext } from './LectureContextService.js';
import { NuggetNotesService, type NuggetNote } from './NuggetNotesService.js';
import { NuggetNotesPanel } from './NuggetNotesPanel.js';

/**
 * Configuration for NuggetNotesOrchestrator
 */
export interface NuggetNotesOrchestratorConfig {
  /** Auto-save interval in ms (default: 300000 = 5 min) */
  autoSaveIntervalMs?: number;
}

const DEFAULT_CONFIG: Required<NuggetNotesOrchestratorConfig> = {
  autoSaveIntervalMs: 300000, // 5 minutes
};

/**
 * Orchestrates the two-model note generation pipeline
 */
export class NuggetNotesOrchestrator {
  private aiClient: AIClient;
  private contextService: LectureContextService;
  private notesService: NuggetNotesService;
  private panel: NuggetNotesPanel;
  
  private transcriptBuffer = '';
  private isRecording = false;
  private enabled = true;
  private autoSaveInterval: ReturnType<typeof setInterval> | null = null;
  private autoSaveCallback: ((notes: NuggetNote[]) => Promise<void>) | null = null;
  private config: Required<NuggetNotesOrchestratorConfig>;
  private recordingStartTime = 0;

  constructor(config?: NuggetNotesOrchestratorConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.aiClient = new AIClient();
    this.contextService = new LectureContextService(this.aiClient);
    this.notesService = new NuggetNotesService(this.aiClient);
    this.panel = new NuggetNotesPanel();
  }

  /**
   * Initialize panel in container
   */
  initializePanel(container: HTMLElement): void {
    this.panel.initialize(container);
  }

  /**
   * Check if Nugget's Notes is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable or disable note generation
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`📝 Nugget's Notes ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set callback for auto-save
   */
  setAutoSaveCallback(callback: (notes: NuggetNote[]) => Promise<void>): void {
    this.autoSaveCallback = callback;
  }

  /**
   * Start recording mode
   */
  startRecording(): void {
    this.isRecording = true;
    this.recordingStartTime = Date.now();
    this.panel.startRecording();
    this.startAutoSave();
    console.log('🎙️ NuggetNotesOrchestrator recording started');
  }

  /**
   * Stop recording mode (but keep notes visible)
   * Processes any remaining transcript before stopping
   */
  async stopRecording(finalTranscript?: string): Promise<void> {
    if (!this.isRecording) return;

    console.log('⏹️ NuggetNotesOrchestrator stopping, processing final chunk...');

    // Process final chunk if we have new content
    if (finalTranscript && this.enabled) {
      const newChunk = finalTranscript.slice(this.transcriptBuffer.length);
      if (newChunk.trim()) {
        this.transcriptBuffer = finalTranscript;
        const recordingTimeSeconds = (Date.now() - this.recordingStartTime) / 1000;

        // Force generate final notes (skip shouldGenerate check)
        const context = this.contextService.getContext();
        const recentTranscript = this.getRecentTranscript();
        
        try {
          await this.notesService.generateNotes(
            recentTranscript,
            context,
            recordingTimeSeconds
          );
          this.panel.updateNotes(this.notesService.getNotes());
          console.log('📝 Final notes generated');
        } catch (error) {
          console.warn('⚠️ Failed to generate final notes:', error);
        }
      }
    }

    this.isRecording = false;
    this.panel.stopRecording();
    this.stopAutoSave();
    
    // Final save on stop
    this.triggerAutoSave();
    console.log('⏹️ NuggetNotesOrchestrator recording stopped');
  }

  /**
   * Process incoming transcript chunk
   * Called by RecordingManager every ~30 seconds
   * @param transcription Full transcription text
   * @param durationMinutes Recording duration in minutes
   */
  async processTranscriptChunk(transcription: string, durationMinutes: number): Promise<void> {
    if (!this.enabled || !this.isRecording) return;

    // Calculate new chunk (difference from what we've already processed)
    const newChunk = transcription.slice(this.transcriptBuffer.length);
    if (!newChunk.trim()) return;

    this.transcriptBuffer = transcription;
    const recordingTimeSeconds = durationMinutes * 60;

    // Check if we should update context (Sonnet - every ~2 min)
    if (this.contextService.shouldUpdate(newChunk)) {
      await this.contextService.updateContext(this.transcriptBuffer);
    }

    // Check if we should generate notes (Haiku - every ~45s)
    if (this.notesService.shouldGenerate(newChunk)) {
      const context = this.contextService.getContext();
      const recentTranscript = this.getRecentTranscript();
      
      await this.notesService.generateNotes(
        recentTranscript,
        context,
        recordingTimeSeconds
      );

      // Update panel with all notes
      this.panel.updateNotes(this.notesService.getNotes());
    }
  }

  /**
   * Get recent transcript for note generation (~100 words)
   */
  private getRecentTranscript(): string {
    const words = this.transcriptBuffer.trim().split(/\s+/);
    return words.slice(-100).join(' ');
  }

  /**
   * Get all generated notes
   */
  getAllNotes(): NuggetNote[] {
    return this.notesService.getNotes();
  }

  /**
   * Reset for new session
   */
  reset(): void {
    this.stopAutoSave();
    this.transcriptBuffer = '';
    this.isRecording = false;
    this.recordingStartTime = 0;
    this.contextService.reset();
    this.notesService.clearNotes();
    this.panel.clearNotes();
    console.log('🔄 NuggetNotesOrchestrator reset');
  }

  /**
   * Start auto-save interval
   */
  private startAutoSave(): void {
    if (this.autoSaveInterval) return;

    this.autoSaveInterval = setInterval(() => {
      this.triggerAutoSave();
    }, this.config.autoSaveIntervalMs);
  }

  /**
   * Stop auto-save interval
   */
  private stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * Trigger auto-save callback
   */
  private async triggerAutoSave(): Promise<void> {
    const notes = this.getAllNotes();
    if (notes.length === 0) return;

    if (this.autoSaveCallback) {
      try {
        await this.autoSaveCallback(notes);
        console.log(`💾 Auto-saved ${notes.length} Nugget notes`);
      } catch (error) {
        console.warn('⚠️ Failed to auto-save Nugget notes:', error);
      }
    }
  }

  /**
   * Get the panel instance for direct access
   */
  getPanel(): NuggetNotesPanel {
    return this.panel;
  }

  /**
   * Load settings from storage
   */
  async loadSettings(): Promise<void> {
    try {
      const settings = await window.scribeCat.store.get('nugget-notes-settings') as { enabled?: boolean } | null;
      if (settings && typeof settings.enabled === 'boolean') {
        this.enabled = settings.enabled;
      }
    } catch (error) {
      console.warn('⚠️ Failed to load Nugget notes settings:', error);
    }
  }
}
