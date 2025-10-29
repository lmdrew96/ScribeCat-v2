/**
 * IGoogleDriveService Interface
 * 
 * Contract for Google Drive integration service.
 * Allows uploading exported files to Google Drive.
 */

export interface GoogleDriveConfig {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
}

export interface GoogleDriveUploadOptions {
  fileName: string;
  mimeType: string;
  folderId?: string; // Optional parent folder ID
}

export interface GoogleDriveUploadResult {
  success: boolean;
  fileId?: string;
  webViewLink?: string;
  error?: string;
}

export interface GoogleDriveAuthResult {
  success: boolean;
  authUrl?: string;
  error?: string;
}

export interface IGoogleDriveService {
  /**
   * Check if the service is authenticated
   */
  isAuthenticated(): Promise<boolean>;

  /**
   * Get authentication URL for OAuth flow
   */
  getAuthUrl(): Promise<GoogleDriveAuthResult>;

  /**
   * Set authentication credentials
   */
  setCredentials(config: GoogleDriveConfig): Promise<void>;

  /**
   * Upload a file to Google Drive
   */
  uploadFile(
    filePath: string,
    options: GoogleDriveUploadOptions
  ): Promise<GoogleDriveUploadResult>;

  /**
   * List files in Google Drive (optional, for future use)
   */
  listFiles(folderId?: string): Promise<any[]>;

  /**
   * Create a folder in Google Drive (optional, for future use)
   */
  createFolder(folderName: string, parentFolderId?: string): Promise<string>;
}
