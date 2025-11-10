/**
 * PdfExportService
 *
 * Service for exporting sessions to PDF format.
 * Infrastructure layer - implements IExportService.
 */

import { IExportService, ExportOptions, ExportResult } from '../../../domain/services/IExportService.js';
import { Session } from '../../../domain/entities/Session.js';
import { formatDurationWithHours, formatTimestampWithHours } from '../../../renderer/utils/formatting.js';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';

export class PdfExportService implements IExportService {
  /**
   * Export a session to a PDF file
   */
  async export(session: Session, outputPath: string, options?: ExportOptions): Promise<ExportResult> {
    try {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fsPromises.mkdir(outputDir, { recursive: true });

      // Create PDF document
      await this.createPdf(session, outputPath, options);

      return {
        success: true,
        filePath: outputPath,
        format: 'pdf'
      };
    } catch (error) {
      return {
        success: false,
        filePath: outputPath,
        format: 'pdf',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create the PDF document
   */
  private async createPdf(session: Session, outputPath: string, options?: ExportOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const includeMetadata = options?.includeMetadata !== false;
      const includeTranscription = options?.includeTranscription !== false;
      const includeNotes = options?.includeNotes !== false;
      const includeTimestamps = options?.includeTimestamps !== false;

      // Create PDF document
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: {
          top: 72,
          bottom: 72,
          left: 72,
          right: 72
        }
      });

      // Pipe to file
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Title
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .text(session.title, { align: 'center' })
         .moveDown(2);

      // Metadata section
      if (includeMetadata) {
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .text('Metadata')
           .moveDown(0.5);

        doc.fontSize(11)
           .font('Helvetica');

        doc.font('Helvetica-Bold').text('Session ID: ', { continued: true })
           .font('Helvetica').text(session.id);

        doc.font('Helvetica-Bold').text('Created: ', { continued: true })
           .font('Helvetica').text(this.formatDate(session.createdAt));

        doc.font('Helvetica-Bold').text('Updated: ', { continued: true })
           .font('Helvetica').text(this.formatDate(session.updatedAt));

        doc.font('Helvetica-Bold').text('Duration: ', { continued: true })
           .font('Helvetica').text(formatDurationWithHours(session.duration));

        if (session.tags.length > 0) {
          doc.font('Helvetica-Bold').text('Tags: ', { continued: true })
             .font('Helvetica').text(session.tags.join(', '));
        }

        doc.moveDown(1.5);
      }

      // Transcription section
      if (includeTranscription && session.hasTranscription() && session.transcription) {
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .text('Transcription')
           .moveDown(0.5);

        doc.fontSize(11)
           .font('Helvetica');

        if (includeTimestamps && session.transcription.segments.length > 0) {
          // Include timestamped segments
          for (const segment of session.transcription.segments) {
            const timestamp = formatTimestampWithHours(segment.startTime);
            const confidence = segment.confidence
              ? ` (${(segment.confidence * 100).toFixed(1)}%)`
              : '';

            doc.font('Helvetica-Bold')
               .fillColor('#666666')
               .text(`[${timestamp}]${confidence} `, { continued: true })
               .font('Helvetica')
               .fillColor('#000000')
               .text(segment.text);
          }
        } else {
          // Just include the full text
          const paragraphs = session.transcription.fullText.split('\n');
          for (const para of paragraphs) {
            if (para.trim()) {
              doc.text(para);
              doc.moveDown(0.3);
            }
          }
        }

        // Transcription metadata
        if (includeMetadata) {
          doc.moveDown(1);
          doc.font('Helvetica-Bold').text('Provider: ', { continued: true })
             .font('Helvetica').text(session.transcription.provider);

          doc.font('Helvetica-Bold').text('Language: ', { continued: true })
             .font('Helvetica').text(session.transcription.language);

          if (session.transcription.averageConfidence !== undefined) {
            doc.font('Helvetica-Bold').text('Average Confidence: ', { continued: true })
               .font('Helvetica').text(`${(session.transcription.averageConfidence * 100).toFixed(1)}%`);
          }
        }

        doc.moveDown(1.5);
      }

      // Notes section
      if (includeNotes && session.notes.trim().length > 0) {
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .text('Notes')
           .moveDown(0.5);

        doc.fontSize(11)
           .font('Helvetica');

        // Strip HTML and split into paragraphs
        const plainNotes = this.stripHtml(session.notes);
        const noteParagraphs = plainNotes.split('\n');
        
        for (const para of noteParagraphs) {
          if (para.trim()) {
            doc.text(para);
            doc.moveDown(0.3);
          }
        }

        doc.moveDown(1.5);
      }

      // Footer
      doc.fontSize(10)
         .font('Helvetica-Oblique')
         .fillColor('#666666')
         .text(`Exported: ${this.formatDate(new Date())}`, { align: 'center' })
         .text('Generated by ScribeCat v2', { align: 'center' });

      // Finalize PDF
      doc.end();

      stream.on('finish', () => resolve());
      stream.on('error', (error) => reject(error));
    });
  }

  /**
   * Format a date for display
   */
  private formatDate(date: Date): string {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  /**
   * Get the supported export format
   */
  getFormat(): 'txt' | 'pdf' | 'docx' | 'html' {
    return 'pdf';
  }

  /**
   * Check if the service is available
   */
  async isAvailable(): Promise<boolean> {
    // PDF export is always available (no external dependencies beyond npm package)
    return true;
  }
}
