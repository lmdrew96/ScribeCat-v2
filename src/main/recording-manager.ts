// src/main/recording-manager.ts

import { ipcMain, BrowserWindow } from 'electron';
import { SaveRecordingUseCase } from '../application/use-cases/SaveRecordingUseCase.js';
import { LoadSessionUseCase } from '../application/use-cases/LoadSessionUseCase.js';
import { UpdateSessionNotesUseCase } from '../application/use-cases/UpdateSessionNotesUseCase.js';
import { UpdateSessionTranscriptionUseCase } from '../application/use-cases/UpdateSessionTranscriptionUseCase.js';
import { FileAudioRepository } from '../infrastructure/repositories/FileAudioRepository.js';
import { FileSessionRepository } from '../infrastructure/repositories/FileSessionRepository.js';

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

  constructor() {
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
      sessionRepository
    );
    this.updateSessionTranscriptionUseCase = new UpdateSessionTranscriptionUseCase(
      sessionRepository
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

    ipcMain.handle('recording:start', async () => {
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

    ipcMain.handle('recording:stop', async (event, audioData: ArrayBuffer, duration: number) => {
      try {
        const result = await this.saveRecordingUseCase.execute({
          audioData,
          duration
        });

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

    ipcMain.handle('recording:pause', async () => {
      // Pause is handled in renderer
      return { success: true };
    });

    ipcMain.handle('recording:resume', async () => {
      // Resume is handled in renderer
      return { success: true };
    });

    ipcMain.handle('recording:getStatus', async () => {
      // Status is tracked in renderer
      return {
        isRecording: false,
        isPaused: false,
        duration: 0,
        audioLevel: 0
      };
    });

    ipcMain.handle('session:load', async (event, sessionId: string) => {
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

    ipcMain.handle('session:loadAll', async () => {
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

    ipcMain.handle('session:updateNotes', async (event, sessionId: string, notes: string) => {
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

    ipcMain.handle('session:updateTranscription', async (event, sessionId: string, transcriptionText: string, provider?: string) => {
      try {
        // Map UI provider names to domain provider names
        // 'simulation' -> 'vosk', otherwise use the provider as-is
        const transcriptionProvider = (provider === 'simulation' ? 'vosk' : provider || 'vosk') as 'vosk' | 'whisper' | 'assemblyai';
        const success = await this.updateSessionTranscriptionUseCase.execute(
          sessionId,
          transcriptionText,
          transcriptionProvider
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
  }
}
