import electron from 'electron';
import type { IpcMain } from 'electron';
import { BaseHandler } from '../BaseHandler.js';
import { ListSessionsUseCase } from '../../../application/use-cases/ListSessionsUseCase.js';
import { DeleteSessionUseCase } from '../../../application/use-cases/DeleteSessionUseCase.js';
import { ExportSessionUseCase } from '../../../application/use-cases/ExportSessionUseCase.js';
import { UpdateSessionUseCase } from '../../../application/use-cases/UpdateSessionUseCase.js';
import { RestoreSessionUseCase } from '../../../application/use-cases/RestoreSessionUseCase.js';
import { PermanentlyDeleteSessionUseCase } from '../../../application/use-cases/PermanentlyDeleteSessionUseCase.js';
import { GetDeletedSessionsUseCase } from '../../../application/use-cases/GetDeletedSessionsUseCase.js';
import { CreateMultiSessionStudySetUseCase } from '../../../application/use-cases/CreateMultiSessionStudySetUseCase.js';
import type { ExportOptions } from '../../../shared/types.js';

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
    private updateSessionUseCase: UpdateSessionUseCase,
    private restoreSessionUseCase: RestoreSessionUseCase,
    private permanentlyDeleteSessionUseCase: PermanentlyDeleteSessionUseCase,
    private getDeletedSessionsUseCase: GetDeletedSessionsUseCase,
    private createMultiSessionStudySetUseCase: CreateMultiSessionStudySetUseCase
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
    this.handle(ipcMain, 'sessions:update', async (event, sessionId: string, updates: {
      title?: string;
      notes?: string;
      tags?: string[];
      courseId?: string;
      courseTitle?: string;
      courseNumber?: string;
    }) => {
      const success = await this.updateSessionUseCase.execute(sessionId, updates, this.currentUserId);
      return { success };
    });

    // Export handler
    this.handle(ipcMain, 'session:export', async (_event, ...args: unknown[]) => {
      const sessionId = args[0] as string;
      const format = args[1] as string;
      const outputPath = args[2] as string;
      const options = args[3] as ExportOptions | undefined;
      
      const result = await this.exportSessionUseCase.execute(
        sessionId,
        format as 'txt' | 'pdf' | 'docx' | 'html',
        outputPath,
        options
      );
      return result;
    });

    // Export with defaults handler
    this.handle(ipcMain, 'session:exportWithDefaults', async (_event, ...args: unknown[]) => {
      const sessionId = args[0] as string;
      const format = args[1] as string;
      const outputPath = args[2] as string;
      
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

    // Get deleted sessions handler (for trash view)
    this.handle(ipcMain, 'sessions:getDeleted', async (event, userId?: string) => {
      const sessions = await this.getDeletedSessionsUseCase.execute(userId || this.currentUserId || undefined);
      return { success: true, sessions: sessions.map(s => s.toJSON()) };
    });

    // Restore session handler
    this.handle(ipcMain, 'sessions:restore', async (event, sessionId: string) => {
      await this.restoreSessionUseCase.execute(sessionId);
      return { success: true };
    });

    // Restore multiple sessions handler
    this.handle(ipcMain, 'sessions:restoreMultiple', async (event, sessionIds: string[]) => {
      const result = await this.restoreSessionUseCase.executeMultiple(sessionIds);
      return { success: true, result };
    });

    // Permanently delete session handler
    this.handle(ipcMain, 'sessions:permanentlyDelete', async (event, sessionId: string) => {
      await this.permanentlyDeleteSessionUseCase.execute(sessionId);
      return { success: true };
    });

    // Permanently delete multiple sessions handler (for "Empty Trash")
    this.handle(ipcMain, 'sessions:permanentlyDeleteMultiple', async (event, sessionIds: string[]) => {
      const result = await this.permanentlyDeleteSessionUseCase.executeMultiple(sessionIds);
      return { success: true, result };
    });

    // Create multi-session study set handler
    this.handle(ipcMain, 'sessions:createMultiSessionStudySet', async (event, sessionIds: string[], title: string) => {
      const multiSession = await this.createMultiSessionStudySetUseCase.execute({
        sessionIds,
        title,
        userId: this.currentUserId || undefined
      });
      return { success: true, session: multiSession.toJSON() };
    });
  }
}
