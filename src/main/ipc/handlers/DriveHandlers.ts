import electron from 'electron';
import type { IpcMain } from 'electron';
import { BaseHandler } from '../BaseHandler.js';
import { GoogleDriveService } from '../../../infrastructure/services/drive/GoogleDriveService.js';
import type { GoogleDriveConfig } from '../../../shared/types.js';
import Store from 'electron-store';
import { SupabaseAuthService } from '../../../infrastructure/services/supabase/SupabaseAuthService.js';
import { encrypt, decrypt } from '../../../infrastructure/utils/encryption.js';

/**
 * Handles Google Drive-related IPC channels
 *
 * Manages Google Drive authentication, file operations, and configuration.
 * Syncs refresh tokens to Supabase user_profiles for cross-device access.
 */
export class DriveHandlers extends BaseHandler {
  private currentUserId: string | null = null;
  private authService: SupabaseAuthService;

  constructor(
    private getGoogleDriveService: () => GoogleDriveService | null,
    private store: Store
  ) {
    super();
    this.authService = new SupabaseAuthService();
  }

  /**
   * Set the current user ID (called when auth state changes)
   */
  setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
  }

  /**
   * Restore Google Drive credentials from cloud
   * This is called directly from main.ts after successful sign-in
   */
  async restoreFromCloud(): Promise<{ success: boolean; data?: { restored: boolean }; error?: string }> {
    if (!this.currentUserId) {
      return { success: false, error: 'No user authenticated' };
    }

    try {
      const result = await this.authService.getUserPreference(
        this.currentUserId,
        'googleDriveRefreshToken'
      );

      if (!result.success || !result.data) {
        return { success: true, data: { restored: false } }; // No token stored, that's OK
      }

      // Decrypt the refresh token
      const encryptedToken = result.data;
      const refreshToken = decrypt(encryptedToken, this.currentUserId);

      // Store locally for immediate use
      const config = { refreshToken };
      (this.store as any).set('google-drive-credentials', JSON.stringify(config));

      // Re-initialize Drive service with restored credentials
      const googleDriveService = this.getGoogleDriveService();
      if (googleDriveService) {
        await googleDriveService.setCredentials(config);
      }

      console.log('✓ Google Drive credentials restored from cloud');
      return { success: true, data: { restored: true } };
    } catch (error) {
      console.error('Failed to restore Drive credentials from cloud:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  register(ipcMain: IpcMain): void {
    // Note: drive:configure is handled in main.ts because it needs to modify this.googleDriveService
    
    // Google Drive: Check if authenticated
    this.handle(ipcMain, 'drive:isAuthenticated', async () => {
      const googleDriveService = this.getGoogleDriveService();
      if (!googleDriveService) {
        return { success: true, data: false };
      }
      
      const isAuthenticated = await googleDriveService.isAuthenticated();
      return { success: true, data: isAuthenticated };
    });

    // Google Drive: Get auth URL
    this.handle(ipcMain, 'drive:getAuthUrl', async () => {
      const googleDriveService = this.getGoogleDriveService();
      if (!googleDriveService) {
        return { success: false, error: 'Google Drive not configured' };
      }
      
      const authUrl = await googleDriveService.getAuthUrl();
      return { success: true, data: authUrl };
    });

    // Google Drive: Exchange authorization code for tokens
    this.handle(ipcMain, 'drive:exchangeCodeForTokens', async (event, code: string) => {
      const googleDriveService = this.getGoogleDriveService();
      if (!googleDriveService) {
        return { success: false, error: 'Google Drive not configured' };
      }

      const result = await googleDriveService.exchangeCodeForTokens(code);

      if (result.success && googleDriveService) {
        const refreshToken = (googleDriveService as any).config.refreshToken;
        const config = { refreshToken };

        // Store locally in electron-store for quick access
        (this.store as any).set('google-drive-credentials', JSON.stringify(config));

        // Sync to Supabase user_profiles.preferences for cross-device access
        if (this.currentUserId && refreshToken) {
          try {
            // Encrypt the refresh token before storing in cloud
            const encryptedToken = encrypt(refreshToken, this.currentUserId);

            await this.authService.setUserPreference(
              this.currentUserId,
              'googleDriveRefreshToken',
              encryptedToken
            );

            console.log('✓ Google Drive refresh token synced to cloud');
          } catch (error) {
            console.error('Failed to sync Drive token to cloud:', error);
            // Don't fail the whole operation if cloud sync fails
          }
        }
      }

      return result;
    });

    // Google Drive: Set credentials
    this.handle(ipcMain, 'drive:setCredentials', async (event, config: GoogleDriveConfig) => {
      const googleDriveService = this.getGoogleDriveService();
      if (!googleDriveService) {
        return { success: false, error: 'Google Drive not configured' };
      }
      
      await googleDriveService.setCredentials(config);
      
      // Store credentials for persistence
      (this.store as any).set('google-drive-credentials', JSON.stringify(config));
      
      return { success: true };
    });

    // Google Drive: Upload file
    this.handle(ipcMain, 'drive:uploadFile', async (event, filePath: string, options?: any) => {
      const googleDriveService = this.getGoogleDriveService();
      if (!googleDriveService) {
        return { success: false, error: 'Google Drive not configured' };
      }
      
      // GoogleDriveService.uploadFile already returns { success, fileId, webViewLink, error }
      // So we return it directly instead of wrapping it
      const result = await googleDriveService.uploadFile(filePath, options);
      return result;
    });

    // Google Drive: List files
    this.handle(ipcMain, 'drive:listFiles', async (event, folderId?: string) => {
      const googleDriveService = this.getGoogleDriveService();
      if (!googleDriveService) {
        return { success: false, error: 'Google Drive not configured' };
      }
      
      const files = await googleDriveService.listFiles(folderId);
      return { success: true, data: files };
    });

    // Google Drive: Create folder
    this.handle(ipcMain, 'drive:createFolder', async (event, name: string, parentId?: string) => {
      const googleDriveService = this.getGoogleDriveService();
      if (!googleDriveService) {
        return { success: false, error: 'Google Drive not configured' };
      }
      
      const folder = await googleDriveService.createFolder(name, parentId);
      return { success: true, data: folder };
    });

    // Google Drive: Get user email
    this.handle(ipcMain, 'drive:getUserEmail', async () => {
      const googleDriveService = this.getGoogleDriveService();
      if (!googleDriveService) {
        return { success: false, error: 'Google Drive not configured' };
      }
      
      const email = await googleDriveService.getUserEmail();
      return { success: true, data: email };
    });

    // Google Drive: Disconnect locally (clear local credentials only, keep cloud)
    this.handle(ipcMain, 'drive:disconnectLocal', async () => {
      const googleDriveService = this.getGoogleDriveService();
      if (!googleDriveService) {
        return { success: false, error: 'Google Drive not configured' };
      }

      await googleDriveService.disconnect();

      // Clear stored credentials from local store only
      (this.store as any).delete('google-drive-credentials');

      console.log('✓ Google Drive disconnected locally (cloud credentials preserved for auto-reconnect)');
      return { success: true };
    });

    // Google Drive: Disconnect completely (clear both local and cloud credentials)
    this.handle(ipcMain, 'drive:disconnect', async () => {
      const googleDriveService = this.getGoogleDriveService();
      if (!googleDriveService) {
        return { success: false, error: 'Google Drive not configured' };
      }

      await googleDriveService.disconnect();

      // Clear stored credentials from local store
      (this.store as any).delete('google-drive-credentials');

      // Clear from Supabase user_profiles.preferences
      // Get current user from auth service (don't rely on instance variable)
      try {
        const currentUser = await this.authService.getCurrentUser();
        if (currentUser?.id) {
          await this.authService.setUserPreference(
            currentUser.id,
            'googleDriveRefreshToken',
            null
          );
          console.log('✓ Google Drive refresh token cleared from cloud for user:', currentUser.id);
        } else {
          console.log('ℹ️  No user authenticated, skipping cloud clear');
        }
      } catch (error) {
        console.error('Failed to clear Drive token from cloud:', error);
        // Don't fail the whole operation if cloud sync fails
      }

      return { success: true };
    });

    // Google Drive: Restore credentials from cloud (IPC handler)
    this.handle(ipcMain, 'drive:restoreFromCloud', async () => {
      return await this.restoreFromCloud();
    });
  }
}
