/**
 * DocxExportService
 *
 * Service for exporting sessions to Microsoft Word (DOCX) format.
 * Infrastructure layer - implements IExportService.
 */

import { IExportService, ExportOptions, ExportResult } from '../../../domain/services/IExportService.js';
import { Session } from '../../../domain/entities/Session.js';
import { Packer } from 'docx';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DocxDocumentBuilder } from './docx/DocxDocumentBuilder.js';

export class DocxExportService implements IExportService {
  /**
   * Export a session to a DOCX file
   */
  async export(session: Session, outputPath: string, options?: ExportOptions): Promise<ExportResult> {
    try {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Build the document using the builder
      const doc = DocxDocumentBuilder.buildDocument(session, options);

      // Generate buffer
      const buffer = await Packer.toBuffer(doc);

      // Write to file
      await fs.writeFile(outputPath, buffer);

      return {
        success: true,
        filePath: outputPath,
        format: 'docx'
      };
    } catch (error) {
      return {
        success: false,
        filePath: outputPath,
        format: 'docx',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get the supported export format
   */
  getFormat(): 'txt' | 'pdf' | 'docx' | 'html' {
    return 'docx';
  }

  /**
   * Check if the service is available
   */
  async isAvailable(): Promise<boolean> {
    // DOCX export is always available (no external dependencies beyond npm package)
    return true;
  }
}
