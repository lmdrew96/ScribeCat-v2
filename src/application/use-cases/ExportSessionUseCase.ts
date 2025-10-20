/**
 * ExportSessionUseCase
 * 
 * Business logic for exporting sessions to various formats.
 * Application layer - orchestrates export services and session updates.
 */

import { Session } from '../../domain/entities/Session.js';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';
import { IExportService, ExportOptions, ExportResult } from '../../domain/services/IExportService.js';

export class ExportSessionUseCase {
  constructor(
    private sessionRepository: ISessionRepository,
    private exportServices: Map<string, IExportService>
  ) {}

  /**
   * Execute the use case to export a session
   * @param sessionId The ID of the session to export
   * @param format The export format (txt, pdf, docx, html)
   * @param outputPath The path where the file should be saved
   * @param options Optional export settings
   * @returns Export result with file path and status
   */
  async execute(
    sessionId: string,
    format: 'txt' | 'pdf' | 'docx' | 'html',
    outputPath: string,
    options?: ExportOptions
  ): Promise<ExportResult> {
    try {
      // Load the session
      const session = await this.sessionRepository.findById(sessionId);
      
      if (!session) {
        throw new Error(`Session with ID ${sessionId} not found`);
      }

      // Get the appropriate export service
      const exportService = this.exportServices.get(format);
      
      if (!exportService) {
        throw new Error(`No export service available for format: ${format}`);
      }

      // Check if service is available
      const isAvailable = await exportService.isAvailable();
      if (!isAvailable) {
        throw new Error(`Export service for ${format} is not available`);
      }

      // Perform the export
      const result = await exportService.export(session, outputPath, options);

      // If export was successful, record it in session history
      if (result.success) {
        session.recordExport(format, result.filePath);
        await this.sessionRepository.save(session);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        filePath: outputPath,
        format,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Export session with default options
   * @param sessionId The ID of the session to export
   * @param format The export format
   * @param outputPath The output path
   * @returns Export result
   */
  async executeWithDefaults(
    sessionId: string,
    format: 'txt' | 'pdf' | 'docx' | 'html',
    outputPath: string
  ): Promise<ExportResult> {
    const defaultOptions: ExportOptions = {
      includeMetadata: true,
      includeTranscription: true,
      includeNotes: true,
      includeTimestamps: true
    };

    return this.execute(sessionId, format, outputPath, defaultOptions);
  }

  /**
   * Get available export formats
   * @returns Array of available export formats
   */
  async getAvailableFormats(): Promise<Array<'txt' | 'pdf' | 'docx' | 'html'>> {
    const formats: Array<'txt' | 'pdf' | 'docx' | 'html'> = [];

    for (const [format, service] of this.exportServices.entries()) {
      const isAvailable = await service.isAvailable();
      if (isAvailable) {
        formats.push(format as 'txt' | 'pdf' | 'docx' | 'html');
      }
    }

    return formats;
  }

  /**
   * Export multiple sessions to the same format
   * @param sessionIds Array of session IDs to export
   * @param format The export format
   * @param outputDirectory Directory where files should be saved
   * @param options Optional export settings
   * @returns Array of export results
   */
  async exportMultiple(
    sessionIds: string[],
    format: 'txt' | 'pdf' | 'docx' | 'html',
    outputDirectory: string,
    options?: ExportOptions
  ): Promise<ExportResult[]> {
    const results: ExportResult[] = [];

    for (const sessionId of sessionIds) {
      try {
        const session = await this.sessionRepository.findById(sessionId);
        if (!session) {
          results.push({
            success: false,
            filePath: '',
            format,
            error: `Session ${sessionId} not found`
          });
          continue;
        }

        // Generate output path based on session title
        const sanitizedTitle = session.title.replace(/[^a-z0-9]/gi, '_');
        const outputPath = `${outputDirectory}/${sanitizedTitle}.${format}`;

        const result = await this.execute(sessionId, format, outputPath, options);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          filePath: '',
          format,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }
}
