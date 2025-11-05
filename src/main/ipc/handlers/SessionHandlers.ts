import electron from 'electron';
import type { IpcMain } from 'electron';
import { BaseHandler } from '../BaseHandler.js';
import { ListSessionsUseCase } from '../../../application/use-cases/ListSessionsUseCase.js';
import { DeleteSessionUseCase } from '../../../application/use-cases/DeleteSessionUseCase.js';
import { ExportSessionUseCase } from '../../../application/use-cases/ExportSessionUseCase.js';
import { UpdateSessionUseCase } from '../../../application/use-cases/UpdateSessionUseCase.js';

/**
 * Handles session-related IPC channels
 *
 * Manages session listing, deletion, update, and export operations.
 */
export class SessionHandlers extends BaseHandler {
  private currentUserId: string | null = null;

  constructor(
    private listSessionsUseCase: ListSessionsUseCase,
    private deleteSessionUseCase: DeleteSessionUseCase,
    private exportSessionUseCase: ExportSessionUseCase,
    private updateSessionUseCase: UpdateSessionUseCase
  ) {
    super();
  }

  /**
   * Set the current user ID for session claiming
   */
  setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
  }

  register(ipcMain: IpcMain): void {
    // Session list handler
    this.handle(ipcMain, 'sessions:list', async (event, sortOrder?: 'asc' | 'desc') => {
      const sessions = await this.listSessionsUseCase.execute(sortOrder);
      return { success: true, sessions: sessions.map(s => s.toJSON()) };
    });

    // Session list with tags handler
    this.handle(ipcMain, 'sessions:listWithTags', async (event, tags: string[], sortOrder?: 'asc' | 'desc') => {
      const sessions = await this.listSessionsUseCase.executeWithTags(tags, sortOrder);
      return { success: true, sessions: sessions.map(s => s.toJSON()) };
    });

    // Session delete handler
    this.handle(ipcMain, 'sessions:delete', async (event, sessionId: string) => {
      await this.deleteSessionUseCase.execute(sessionId);
      return { success: true };
    });

    // Session delete multiple handler
    this.handle(ipcMain, 'sessions:deleteMultiple', async (event, sessionIds: string[]) => {
      const result = await this.deleteSessionUseCase.executeMultiple(sessionIds);
      return { success: true, result };
    });

    // Session update handler
    this.handle(ipcMain, 'sessions:update', async (event, sessionId: string, updates: { title?: string; notes?: string; tags?: string[] }) => {
      const success = await this.updateSessionUseCase.execute(sessionId, updates, this.currentUserId);
      return { success };
    });

    // Export handler
    this.handle(ipcMain, 'session:export', async (event, sessionId: string, format: string, outputPath: string, options?: any) => {
      const result = await this.exportSessionUseCase.execute(
        sessionId,
        format as 'txt' | 'pdf' | 'docx' | 'html',
        outputPath,
        options
      );
      return result;
    });

    // Export with defaults handler
    this.handle(ipcMain, 'session:exportWithDefaults', async (event, sessionId: string, format: string, outputPath: string) => {
      const result = await this.exportSessionUseCase.executeWithDefaults(
        sessionId,
        format as 'txt' | 'pdf' | 'docx' | 'html',
        outputPath
      );
      return result;
    });

    // Get available export formats handler
    this.handle(ipcMain, 'export:getAvailableFormats', async () => {
      const formats = await this.exportSessionUseCase.getAvailableFormats();
      return { success: true, formats };
    });
  }
}
