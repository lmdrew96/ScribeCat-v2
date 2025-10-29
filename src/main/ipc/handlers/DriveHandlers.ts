import { IpcMain } from 'electron';
import { BaseHandler } from '../BaseHandler.js';
import { GoogleDriveService } from '../../../infrastructure/services/drive/GoogleDriveService.js';
import type { GoogleDriveConfig } from '../../../shared/types.js';
import Store from 'electron-store';

/**
 * Handles Google Drive-related IPC channels
 * 
 * Manages Google Drive authentication, file operations, and configuration.
 */
export class DriveHandlers extends BaseHandler {
  constructor(
    private getGoogleDriveService: () => GoogleDriveService | null,
    private store: Store
  ) {
    super();
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
        // Store the refresh token for persistence
        const config = { refreshToken: (googleDriveService as any).config.refreshToken };
        (this.store as any).set('google-drive-credentials', JSON.stringify(config));
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

    // Google Drive: Disconnect
    this.handle(ipcMain, 'drive:disconnect', async () => {
      const googleDriveService = this.getGoogleDriveService();
      if (!googleDriveService) {
        return { success: false, error: 'Google Drive not configured' };
      }
      
      await googleDriveService.disconnect();
      
      // Clear stored credentials
      (this.store as any).delete('google-drive-credentials');
      
      return { success: true };
    });
  }
}
