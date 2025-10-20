/**
 * IExportService Interface
 * 
 * Contract for export service implementations.
 * Allows for multiple export formats (txt, pdf, docx, html)
 */

import { Session } from '../entities/Session.js';

export interface ExportOptions {
  includeMetadata?: boolean;
  includeTranscription?: boolean;
  includeNotes?: boolean;
  includeTimestamps?: boolean;
}

export interface ExportResult {
  success: boolean;
  filePath: string;
  format: 'txt' | 'pdf' | 'docx' | 'html';
  error?: string;
}

export interface IExportService {
  /**
   * Export a session to a file
   * @param session The session to export
   * @param outputPath The path where the file should be saved
   * @param options Optional export settings
   * @returns Export result with file path and status
   */
  export(session: Session, outputPath: string, options?: ExportOptions): Promise<ExportResult>;

  /**
   * Get the supported export format
   */
  getFormat(): 'txt' | 'pdf' | 'docx' | 'html';

  /**
   * Check if the service is available
   */
  isAvailable(): Promise<boolean>;
}
