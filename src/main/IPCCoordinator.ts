/**
 * IPCCoordinator
 *
 * Centralized IPC handler registration and coordination
 * Manages all IPC communication between main and renderer processes
 *
 * Responsibilities:
 * - Register all modular IPC handlers
 * - Set up special handlers (auth, sync, drive, shell)
 * - Coordinate handler access to services and state
 * - Handle auth state changes and propagate to services
 */

import { ipcMain, type BrowserWindow } from 'electron';
import { HandlerRegistry } from './ipc/HandlerRegistry.js';
import { SessionHandlers } from './ipc/handlers/SessionHandlers.js';
import { AudioHandlers } from './ipc/handlers/AudioHandlers.js';
import { TranscriptionHandlers } from './ipc/handlers/TranscriptionHandlers.js';
import { AIHandlers } from './ipc/handlers/AIHandlers.js';
import { AuthHandlers } from './ipc/handlers/AuthHandlers.js';
import { DriveHandlers } from './ipc/handlers/DriveHandlers.js';
import { SettingsHandlers } from './ipc/handlers/SettingsHandlers.js';
import { DialogHandlers } from './ipc/handlers/DialogHandlers.js';
import { CanvasHandlers } from './ipc/handlers/CanvasHandlers.js';
import { ShareHandlers } from './ipc/handlers/ShareHandlers.js';
import { PowerHandlers } from './ipc/handlers/PowerHandlers.js';
import { FriendsHandlers } from './ipc/handlers/FriendsHandlers.js';
import { StudyRoomsHandlers } from './ipc/handlers/StudyRoomsHandlers.js';
import { ChatHandlers } from './ipc/handlers/ChatHandlers.js';
import { MessagesHandlers } from './ipc/handlers/MessagesHandlers.js';
import { registerGameHandlers } from './ipc/handlers/GameHandlers.js';
import { registerStudyQuestHandlers } from './ipc/handlers/StudyQuestHandlers.js';
import { GoogleDriveService } from '../infrastructure/services/drive/GoogleDriveService.js';
import type { GoogleDriveConfig } from '../shared/types.js';
import type { Services } from './ServiceBootstrapper.js';
import type Store from 'electron-store';

interface StoreSchema {
  'google-drive-credentials'?: string;
}

export interface IPCCoordinatorDependencies {
  services: Services;
  store: Store<StoreSchema>;
  getMainWindow: () => BrowserWindow | null;
}

export class IPCCoordinator {
  private services: Services;
  private store: Store<StoreSchema>;
  private getMainWindow: () => BrowserWindow | null;
  private currentUserId: string | null = null;

  // Handler references for setting user ID and cleanup
  private sessionHandlers: SessionHandlers | null = null;
  private driveHandlers: DriveHandlers | null = null;
  private shareHandlers: ShareHandlers | null = null;
  private friendsHandlers: FriendsHandlers | null = null;
  private studyRoomsHandlers: StudyRoomsHandlers | null = null;
  private chatHandlers: ChatHandlers | null = null;
  private messagesHandlers: MessagesHandlers | null = null;

  constructor(deps: IPCCoordinatorDependencies) {
    this.services = deps.services;
    this.store = deps.store;
    this.getMainWindow = deps.getMainWindow;
  }

  /**
   * Set up all IPC handlers
   */
  setupHandlers(): void {
    this.registerModularHandlers();
    this.registerSpecialHandlers();
  }

  /**
   * Register all modular IPC handlers
   */
  private registerModularHandlers(): void {
    const registry = new HandlerRegistry();

    // Register all modular handlers
    this.sessionHandlers = new SessionHandlers(
      this.services.listSessionsUseCase,
      this.services.deleteSessionUseCase,
      this.services.exportSessionUseCase,
      this.services.updateSessionUseCase,
      this.services.restoreSessionUseCase,
      this.services.permanentlyDeleteSessionUseCase,
      this.services.getDeletedSessionsUseCase,
      this.services.createMultiSessionStudySetUseCase
    );
    registry.add(this.sessionHandlers);

    registry.add(new AudioHandlers());

    registry.add(new TranscriptionHandlers());

    registry.add(new AIHandlers(
      () => this.services.aiService,
      this.getMainWindow
    ));

    // Add auth handlers
    registry.add(new AuthHandlers(
      this.services.signInWithEmailUseCase,
      this.services.signUpWithEmailUseCase,
      this.services.signInWithGoogleUseCase,
      this.services.signOutUseCase,
      this.services.getCurrentUserUseCase
    ));

    this.driveHandlers = new DriveHandlers(
      () => this.services.googleDriveService,
      this.store
    );
    registry.add(this.driveHandlers);

    registry.add(new SettingsHandlers(this.store));

    registry.add(new DialogHandlers(this.getMainWindow));

    registry.add(new CanvasHandlers());

    registry.add(new PowerHandlers());

    // Add sharing handlers if Supabase is configured
    if (this.services.shareSessionUseCase) {
      this.shareHandlers = new ShareHandlers(
        this.services.shareSessionUseCase,
        this.services.removeShareUseCase,
        this.services.updateSharePermissionUseCase,
        this.services.getSessionSharesUseCase,
        this.services.getSharedSessionsUseCase,
        this.services.acceptShareInvitationUseCase
      );
      registry.add(this.shareHandlers);
    }

    // Add friends handlers
    this.friendsHandlers = new FriendsHandlers();
    registry.add(this.friendsHandlers);

    // Add study rooms handlers
    this.studyRoomsHandlers = new StudyRoomsHandlers();
    registry.add(this.studyRoomsHandlers);

    // Add chat handlers
    this.chatHandlers = new ChatHandlers();
    registry.add(this.chatHandlers);

    // Add messages handlers (Neomail-style private messaging)
    this.messagesHandlers = new MessagesHandlers();
    registry.add(this.messagesHandlers);

    // Register all handlers with ipcMain
    registry.registerAll(ipcMain);
  }

  /**
   * Register special IPC handlers that need direct access to services
   */
  private registerSpecialHandlers(): void {
    this.registerAIHandlers();
    this.registerDriveHandlers();
    this.registerAuthHandlers();
    this.registerShellHandlers();
    this.registerAppHandlers();
    this.registerSyncHandlers();
    registerGameHandlers();
    registerStudyQuestHandlers();
  }

  /**
   * Register AI-related handlers
   */
  private registerAIHandlers(): void {
    // API keys are now hardcoded from environment, not user-configurable
    ipcMain.handle('ai:setApiKey', async (event, apiKey: string) => {
      return { success: true };
    });
  }

  /**
   * Register Drive-related handlers
   */
  private registerDriveHandlers(): void {
    ipcMain.handle('drive:configure', async (event, config: GoogleDriveConfig) => {
      try {
        this.services.googleDriveService = new GoogleDriveService(config);
        return { success: true };
      } catch (error) {
        console.error('Failed to configure Google Drive:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
  }

  /**
   * Register auth-related handlers
   */
  private registerAuthHandlers(): void {
    // Auth state handler - receives user session from renderer when auth state changes
    ipcMain.handle('auth:sessionChanged', async (event, data: { userId: string | null; accessToken?: string; refreshToken?: string }) => {
      try {
        // Store current user ID for session claiming
        this.currentUserId = data.userId;

        // Update local repository (FileSessionRepository) to filter by user ID
        if ('setUserId' in this.services.sessionRepository) {
          (this.services.sessionRepository as any).setUserId(data.userId);
        }

        // Update SessionHandlers with user ID for auto-claiming orphaned sessions
        if (this.sessionHandlers) {
          this.sessionHandlers.setCurrentUserId(data.userId);
        }

        // Update SyncManager with user ID (which also updates SupabaseSessionRepository)
        if (this.services.syncManager) {
          this.services.syncManager.setCurrentUserId(data.userId);
        }

        // Update ShareHandlers with user ID
        if (this.shareHandlers) {
          this.shareHandlers.setCurrentUserId(data.userId);
        }

        // Update DriveHandlers with user ID
        if (this.driveHandlers) {
          this.driveHandlers.setCurrentUserId(data.userId);
        }

        // Update FriendsHandlers with user ID
        if (this.friendsHandlers) {
          this.friendsHandlers.setCurrentUserId(data.userId);
        }

        // Update StudyRoomsHandlers with user ID
        if (this.studyRoomsHandlers) {
          this.studyRoomsHandlers.setCurrentUserId(data.userId);
        }

        // Update MessagesHandlers with user ID
        if (this.messagesHandlers) {
          this.messagesHandlers.setCurrentUserId(data.userId);
        }

        // Set session on SupabaseClient for authenticated requests
        if (data.userId && data.accessToken && data.refreshToken && this.services.supabaseClient) {
          await this.services.supabaseClient.setSession(data.accessToken, data.refreshToken);

          // Auto-restore Google Drive credentials from cloud if user just signed in
          setTimeout(async () => {
            try {
              if (this.driveHandlers) {
                const restoreResult = await this.driveHandlers.restoreFromCloud();

                if (restoreResult.success && restoreResult.data?.restored) {
                  // Notify renderer that Drive was reconnected
                  const mainWindow = this.getMainWindow();
                  if (mainWindow) {
                    mainWindow.webContents.send('drive:auto-reconnected');
                  }
                } else if (!restoreResult.success) {
                  console.warn('Failed to restore Drive credentials:', restoreResult.error);
                }
              }
            } catch (error) {
              console.error('Failed to auto-restore Drive credentials:', error);
            }
          }, 1000); // Small delay to ensure everything is initialized
        } else if (!data.userId && this.services.supabaseClient) {
          await this.services.supabaseClient.clearSession();
        }

        return { success: true };
      } catch (error) {
        console.error('Failed to handle auth state change:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Note: Auth operations (updateProfile, resetPassword, deleteAccount) are handled
    // directly in the renderer process via RendererSupabaseClient where the auth session lives.
    // This follows the architecture where all auth happens in renderer, not main process.
  }

  /**
   * Register shell-related handlers
   */
  private registerShellHandlers(): void {
    // Shell handler - open external URLs in system browser
    ipcMain.handle('shell:openExternal', async (_event, url: string) => {
      try {
        const { shell } = await import('electron');
        await shell.openExternal(url);
      } catch (error) {
        console.error('Failed to open external URL:', error);
        throw error;
      }
    });
  }

  /**
   * Register app-related handlers
   */
  private registerAppHandlers(): void {
    // Get app version from package.json
    ipcMain.handle('app:getVersion', async () => {
      const { app } = await import('electron');
      return app.getVersion();
    });
  }

  /**
   * Register sync-related handlers
   */
  private registerSyncHandlers(): void {
    ipcMain.handle('sync:uploadSession', async (event, sessionId: string) => {
      try {
        if (!this.services.syncManager) {
          return { success: false, error: 'Sync not initialized' };
        }

        // Find the session
        const session = await this.services.sessionRepository.findById(sessionId);
        if (!session) {
          return { success: false, error: 'Session not found' };
        }

        // Upload it
        const result = await this.services.syncManager.uploadSession(session);
        return result;
      } catch (error) {
        console.error('Failed to upload session:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('sync:getStatus', async (event, sessionId: string) => {
      try {
        if (!this.services.syncManager) {
          return { status: 'not_synced' };
        }

        const status = this.services.syncManager.getSyncStatus(sessionId);
        return { status };
      } catch (error) {
        console.error('Failed to get sync status:', error);
        return { status: 'not_synced' };
      }
    });

    ipcMain.handle('sync:retrySync', async (event, sessionId: string) => {
      try {
        if (!this.services.syncManager) {
          return { success: false, error: 'Sync not initialized' };
        }

        const result = await this.services.syncManager.retrySync(sessionId);
        return result;
      } catch (error) {
        console.error('Failed to retry sync:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('sync:syncAllFromCloud', async () => {
      try {
        if (!this.services.syncManager) {
          return { success: false, error: 'Sync not initialized' };
        }

        const result = await this.services.syncManager.syncAllFromCloud();
        return result;
      } catch (error) {
        console.error('Failed to sync from cloud:', error);
        return {
          success: false,
          count: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
  }

  /**
   * Cleanup all handlers on app quit
   */
  public async cleanup(): Promise<void> {
    console.log('[IPCCoordinator] Cleaning up handlers on app quit');

    // Cleanup friends presence and subscriptions
    if (this.friendsHandlers) {
      await this.friendsHandlers.cleanup();
    }

    // Cleanup chat subscriptions
    if (this.chatHandlers) {
      await this.chatHandlers.cleanup();
    }

    // Cleanup messages subscriptions
    if (this.messagesHandlers) {
      await this.messagesHandlers.cleanup();
    }

    console.log('[IPCCoordinator] Cleanup complete');
  }
}
