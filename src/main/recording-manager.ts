// src/main/recording-manager.ts

import electron from 'electron';
import type { BrowserWindow } from 'electron';
import { SaveRecordingUseCase } from '../application/use-cases/SaveRecordingUseCase.js';
import { LoadSessionUseCase } from '../application/use-cases/LoadSessionUseCase.js';
import { UpdateSessionNotesUseCase } from '../application/use-cases/UpdateSessionNotesUseCase.js';
import { UpdateSessionTranscriptionUseCase } from '../application/use-cases/UpdateSessionTranscriptionUseCase.js';
import { UpdateSessionSummaryUseCase } from '../application/use-cases/UpdateSessionSummaryUseCase.js';
import { CreateDraftSessionUseCase } from '../application/use-cases/CreateDraftSessionUseCase.js';
import { AddStudyModeTimeUseCase } from '../application/use-cases/AddStudyModeTimeUseCase.js';
import { IncrementAIToolUsageUseCase } from '../application/use-cases/IncrementAIToolUsageUseCase.js';
import { IncrementAIChatMessagesUseCase } from '../application/use-cases/IncrementAIChatMessagesUseCase.js';
import { FileAudioRepository } from '../infrastructure/repositories/FileAudioRepository.js';
import { FileSessionRepository } from '../infrastructure/repositories/FileSessionRepository.js';
import type { ISessionRepository } from '../domain/repositories/ISessionRepository.js';

/**
 * RecordingManager
 * 
 * Presentation layer component that handles IPC communication.
 * Delegates business logic to use cases.
 */

export class RecordingManager {
  private mainWindow: BrowserWindow | null = null;

  // Use cases
  private saveRecordingUseCase: SaveRecordingUseCase;
  private loadSessionUseCase: LoadSessionUseCase;
  private updateSessionNotesUseCase: UpdateSessionNotesUseCase;
  private updateSessionTranscriptionUseCase: UpdateSessionTranscriptionUseCase;
  private updateSessionSummaryUseCase: UpdateSessionSummaryUseCase;
  private createDraftSessionUseCase: CreateDraftSessionUseCase;
  private addStudyModeTimeUseCase: AddStudyModeTimeUseCase;
  private incrementAIToolUsageUseCase: IncrementAIToolUsageUseCase;
  private incrementAIChatMessagesUseCase: IncrementAIChatMessagesUseCase;

  // Optional callback for post-save actions (e.g., cloud sync)
  private onRecordingSaved?: (sessionId: string) => Promise<void>;

  constructor(
    onRecordingSaved?: (sessionId: string) => Promise<void>,
    supabaseSessionRepository?: ISessionRepository
  ) {
    this.onRecordingSaved = onRecordingSaved;
    // Initialize repositories
    const audioRepository = new FileAudioRepository();
    const sessionRepository = new FileSessionRepository();

    // Initialize use cases with repositories
    this.saveRecordingUseCase = new SaveRecordingUseCase(
      audioRepository,
      sessionRepository
    );
    this.loadSessionUseCase = new LoadSessionUseCase(sessionRepository);
    this.updateSessionNotesUseCase = new UpdateSessionNotesUseCase(
      sessionRepository,
      supabaseSessionRepository
    );
    this.updateSessionTranscriptionUseCase = new UpdateSessionTranscriptionUseCase(
      sessionRepository,
      supabaseSessionRepository
    );
    this.updateSessionSummaryUseCase = new UpdateSessionSummaryUseCase(
      sessionRepository,
      supabaseSessionRepository
    );
    this.createDraftSessionUseCase = new CreateDraftSessionUseCase(
      sessionRepository
    );
    this.addStudyModeTimeUseCase = new AddStudyModeTimeUseCase(
      sessionRepository,
      supabaseSessionRepository
    );
    this.incrementAIToolUsageUseCase = new IncrementAIToolUsageUseCase(
      sessionRepository,
      supabaseSessionRepository
    );
    this.incrementAIChatMessagesUseCase = new IncrementAIChatMessagesUseCase(
      sessionRepository,
      supabaseSessionRepository
    );

    // Set up IPC handlers
    this.setupIPC();
  }

  /**
   * Set the main window reference (called from main.ts)
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Set up IPC handlers for recording operations
   */
  private setupIPC(): void {
    // Note: The actual recording happens in the renderer process
    // These handlers are for file operations and session management

    electron.ipcMain.handle('recording:start', async () => {
      try {
        // The renderer will handle the actual recording
        // This just confirms readiness
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    electron.ipcMain.handle('recording:stop', async (event, audioData: ArrayBuffer, duration: number, courseData?: { courseId?: string; courseTitle?: string; courseNumber?: string }, userId?: string | null, transcription?: string, title?: string) => {
      try {
        const result = await this.saveRecordingUseCase.execute({
          audioData,
          duration,
          title,
          courseId: courseData?.courseId,
          courseTitle: courseData?.courseTitle,
          courseNumber: courseData?.courseNumber,
          userId: userId || undefined,
          transcription
        });

        // NOTE: Cloud sync is now triggered from renderer process AFTER transcription is saved
        // to ensure we upload the complete session with all data

        return {
          success: true,
          sessionId: result.sessionId,
          filePath: result.filePath
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    electron.ipcMain.handle('recording:pause', async () => {
      // Pause is handled in renderer
      return { success: true };
    });

    electron.ipcMain.handle('recording:resume', async () => {
      // Resume is handled in renderer
      return { success: true };
    });

    electron.ipcMain.handle('recording:getStatus', async () => {
      // Status is tracked in renderer
      return {
        isRecording: false,
        isPaused: false,
        duration: 0,
        audioLevel: 0
      };
    });

    electron.ipcMain.handle('session:load', async (event, sessionId: string) => {
      try {
        const session = await this.loadSessionUseCase.execute(sessionId);
        
        if (!session) {
          return {
            success: false,
            error: 'Session not found'
          };
        }

        return {
          success: true,
          session: session.toJSON()
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    electron.ipcMain.handle('session:loadAll', async () => {
      try {
        const sessions = await this.loadSessionUseCase.loadAll();
        
        return {
          success: true,
          sessions: sessions.map(s => s.toJSON())
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    electron.ipcMain.handle('session:updateNotes', async (event, sessionId: string, notes: string) => {
      try {
        const success = await this.updateSessionNotesUseCase.execute(sessionId, notes);

        if (!success) {
          return {
            success: false,
            error: 'Session not found'
          };
        }

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    electron.ipcMain.handle('session:updateSummary', async (event, sessionId: string, summary: string) => {
      try {
        const success = await this.updateSessionSummaryUseCase.execute(sessionId, summary);

        if (!success) {
          return {
            success: false,
            error: 'Session not found'
          };
        }

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    electron.ipcMain.handle('session:updateTranscription', async (event, sessionId: string, transcriptionText: string, provider?: string, timestampedEntries?: Array<{ startTime: number; endTime: number; text: string }>) => {
      try {
        // Use the provider as-is, defaulting to 'assemblyai'
        const transcriptionProvider = (provider || 'assemblyai') as 'assemblyai';
        const success = await this.updateSessionTranscriptionUseCase.execute(
          sessionId,
          transcriptionText,
          transcriptionProvider,
          timestampedEntries
        );

        if (!success) {
          return {
            success: false,
            error: 'Session not found or transcription update failed'
          };
        }

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    electron.ipcMain.handle('session:createDraft', async () => {
      try {
        const result = await this.createDraftSessionUseCase.execute();

        return {
          success: true,
          sessionId: result.sessionId
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    electron.ipcMain.handle('session:addStudyModeTime', async (event, sessionId: string, seconds: number) => {
      try {
        const success = await this.addStudyModeTimeUseCase.execute(sessionId, seconds);

        if (!success) {
          return {
            success: false,
            error: 'Session not found'
          };
        }

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    electron.ipcMain.handle('session:incrementAIToolUsage', async (event, sessionId: string) => {
      try {
        const success = await this.incrementAIToolUsageUseCase.execute(sessionId);

        if (!success) {
          return {
            success: false,
            error: 'Session not found'
          };
        }

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    electron.ipcMain.handle('session:incrementAIChatMessages', async (event, sessionId: string, count: number) => {
      try {
        const success = await this.incrementAIChatMessagesUseCase.execute(sessionId, count);

        if (!success) {
          return {
            success: false,
            error: 'Session not found'
          };
        }

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
  }
}
