/**
 * GoogleDriveService
 * 
 * Service for integrating with Google Drive API.
 * Allows uploading exported files to Google Drive.
 * Infrastructure layer - implements IGoogleDriveService.
 */

import {
  IGoogleDriveService,
  GoogleDriveConfig,
  GoogleDriveUploadOptions,
  GoogleDriveUploadResult,
  GoogleDriveAuthResult
} from '../../../domain/services/IGoogleDriveService.js';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../../../config.js';

export class GoogleDriveService implements IGoogleDriveService {
  private oauth2Client: any;
  private drive: any;
  private driveConfig: GoogleDriveConfig;
  private userEmail?: string;

  // OAuth credentials loaded from environment variables
  private readonly CLIENT_ID = config.googleDrive.clientId;
  private readonly CLIENT_SECRET = config.googleDrive.clientSecret;
  private readonly SCOPES = ['https://www.googleapis.com/auth/drive.file'];
  private readonly REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'; // For desktop apps

  constructor(driveConfig?: GoogleDriveConfig) {
    this.driveConfig = driveConfig || {};

    // Warn if OAuth credentials are not configured
    if (!this.CLIENT_ID || !this.CLIENT_SECRET) {
      console.warn('⚠️  Google Drive OAuth credentials not configured. Set GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET environment variables.');
    }

    this.initializeClient();
  }

  /**
   * Initialize the OAuth2 client with pre-configured credentials
   */
  private initializeClient(): void {
    this.oauth2Client = new google.auth.OAuth2(
      this.CLIENT_ID,
      this.CLIENT_SECRET,
      this.REDIRECT_URI
    );

    // Load stored refresh token if available
    if (this.driveConfig.refreshToken) {
      this.oauth2Client.setCredentials({
        refresh_token: this.driveConfig.refreshToken
      });
    }

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Check if the service is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    if (!this.oauth2Client) {
      return false;
    }

    try {
      const credentials = this.oauth2Client.credentials;
      return !!(credentials && credentials.refresh_token);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get authentication URL for OAuth flow
   */
  async getAuthUrl(): Promise<GoogleDriveAuthResult> {
    try {
      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: this.SCOPES,
        prompt: 'consent' // Force consent screen to get refresh token
      });

      return {
        success: true,
        authUrl
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Set authentication credentials
   */
  async setCredentials(config: GoogleDriveConfig): Promise<void> {
    this.driveConfig = { ...this.driveConfig, ...config };
    this.initializeClient();
  }

  /**
   * Exchange authorization code for tokens and get user info
   */
  async exchangeCodeForTokens(code: string): Promise<{ success: boolean; error?: string; email?: string }> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      
      // Store refresh token for future use
      if (tokens.refresh_token) {
        this.driveConfig.refreshToken = tokens.refresh_token;
      }

      // Get user's email
      try {
        const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        this.userEmail = userInfo.data.email || undefined;
      } catch (emailError) {
        console.warn('Could not fetch user email:', emailError);
      }

      return { 
        success: true,
        email: this.userEmail
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Upload a file to Google Drive
   */
  async uploadFile(
    filePath: string,
    options: GoogleDriveUploadOptions
  ): Promise<GoogleDriveUploadResult> {
    try {
      if (!this.drive) {
        return {
          success: false,
          error: 'Google Drive not initialized. Please authenticate first.'
        };
      }

      // Check if file exists
      try {
        await fs.promises.access(filePath);
      } catch {
        return {
          success: false,
          error: `File not found: ${filePath}`
        };
      }

      // Prepare file metadata
      const fileMetadata: any = {
        name: options.fileName,
      };

      if (options.folderId) {
        fileMetadata.parents = [options.folderId];
      }

      // Create file stream
      const media = {
        mimeType: options.mimeType,
        body: fs.createReadStream(filePath)
      };

      // Upload file
      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink'
      });

      return {
        success: true,
        fileId: response.data.id,
        webViewLink: response.data.webViewLink
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List files in Google Drive
   */
  async listFiles(folderId?: string): Promise<any[]> {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      const query = folderId 
        ? `'${folderId}' in parents and trashed=false`
        : 'trashed=false';

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, createdTime, modifiedTime, webViewLink)',
        orderBy: 'modifiedTime desc',
        pageSize: 100
      });

      return response.data.files || [];
    } catch (error) {
      console.error('Failed to list files:', error);
      return [];
    }
  }

  /**
   * Create a folder in Google Drive
   */
  async createFolder(folderName: string, parentFolderId?: string): Promise<string> {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      const fileMetadata: any = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      };

      if (parentFolderId) {
        fileMetadata.parents = [parentFolderId];
      }

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        fields: 'id'
      });

      return response.data.id;
    } catch (error) {
      throw new Error(
        `Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get the authenticated user's email
   */
  async getUserEmail(): Promise<string | undefined> {
    if (this.userEmail) {
      return this.userEmail;
    }

    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      this.userEmail = userInfo.data.email || undefined;
      return this.userEmail;
    } catch (error) {
      console.error('Failed to get user email:', error);
      return undefined;
    }
  }

  /**
   * Disconnect (revoke credentials)
   */
  async disconnect(): Promise<void> {
    this.driveConfig.refreshToken = undefined;
    this.userEmail = undefined;
    this.oauth2Client.setCredentials({});
  }

  /**
   * Get MIME type for file extension
   */
  static getMimeType(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      'txt': 'text/plain',
      'pdf': 'application/pdf',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'html': 'text/html',
      'json': 'application/json'
    };

    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }
}
