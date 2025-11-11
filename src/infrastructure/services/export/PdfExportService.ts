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

        // Parse HTML to extract text and images
        const { text, images } = this.parseHtmlContent(session.notes);

        // Render text content
        const noteParagraphs = text.split('\n');
        for (const para of noteParagraphs) {
          if (para.trim()) {
            doc.text(para);
            doc.moveDown(0.3);
          }
        }

        // Render images
        if (images.length > 0) {
          doc.moveDown(1);

          for (const img of images) {
            try {
              // Decode base64 image
              const imageBuffer = this.decodeBase64Image(img.src);

              if (img.anchorType === 'page' && img.posX !== null && img.posY !== null) {
                // Page-anchored image - place at specific coordinates
                // Note: PDF coordinates are in points (72 points per inch)
                // We'll scale positions proportionally to fit the page
                const scaleFactor = 0.5; // Adjust as needed
                const x = doc.page.margins.left + (img.posX * scaleFactor);
                const y = doc.page.margins.top + (img.posY * scaleFactor);

                doc.image(imageBuffer, x, y, {
                  fit: [img.width || 200, img.height || 200],
                  align: 'left'
                });
              } else {
                // Paragraph-anchored or inline image - place inline with text
                doc.image(imageBuffer, {
                  fit: [img.width || 200, img.height || 200],
                  align: img.align || 'left'
                });
                doc.moveDown(0.5);
              }
            } catch (error) {
              // Skip invalid images
              console.warn('Failed to render image in PDF:', error);
            }
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
   * Parse HTML content to extract text and images
   */
  private parseHtmlContent(html: string): { text: string; images: Array<{
    src: string;
    width?: number;
    height?: number;
    anchorType?: string;
    posX?: number | null;
    posY?: number | null;
    align?: string;
  }> } {
    const images: Array<any> = [];

    // Extract images with their attributes
    const imgRegex = /<img[^>]*>/gi;
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
      const imgTag = match[0];

      // Extract src
      const srcMatch = imgTag.match(/src="([^"]*)"/i);
      if (!srcMatch) continue;

      const img: any = {
        src: srcMatch[1],
        anchorType: 'paragraph',
        posX: null,
        posY: null
      };

      // Extract width
      const widthMatch = imgTag.match(/style="[^"]*width:\s*(\d+)px/i) || imgTag.match(/width="(\d+)"/i);
      if (widthMatch) img.width = parseInt(widthMatch[1], 10);

      // Extract height
      const heightMatch = imgTag.match(/style="[^"]*height:\s*(\d+)px/i) || imgTag.match(/height="(\d+)"/i);
      if (heightMatch) img.height = parseInt(heightMatch[1], 10);

      // Check parent div for positioning attributes
      const beforeImg = html.substring(0, match.index);
      const divMatch = beforeImg.match(/<div[^>]*(data-anchor-type="([^"]*)"|data-position-mode="([^"]*)")[ ^>]*>(?![\s\S]*<div)/i);

      if (divMatch) {
        const fullDivTag = html.substring(divMatch.index!, match.index);

        // Extract anchor type (prefer new attribute, fall back to position mode for backward compatibility)
        const anchorTypeMatch = fullDivTag.match(/data-anchor-type="([^"]*)"/i);
        const positionModeMatch = fullDivTag.match(/data-position-mode="([^"]*)"/i);

        if (anchorTypeMatch) {
          img.anchorType = anchorTypeMatch[1];
        } else if (positionModeMatch) {
          // Backward compatibility: convert old position mode to anchor type
          img.anchorType = positionModeMatch[1] === 'absolute' ? 'page' : 'paragraph';
        }

        // Extract posX and posY (for page-anchored images)
        const posXMatch = fullDivTag.match(/data-pos-x="(\d+)"/i);
        if (posXMatch) img.posX = parseInt(posXMatch[1], 10);

        const posYMatch = fullDivTag.match(/data-pos-y="(\d+)"/i);
        if (posYMatch) img.posY = parseInt(posYMatch[1], 10);
      }

      // Extract text-align
      const alignMatch = imgTag.match(/style="[^"]*text-align:\s*(left|center|right)/i);
      if (alignMatch) img.align = alignMatch[1];

      images.push(img);
    }

    // Strip all HTML for text content
    const text = this.stripHtml(html);

    return { text, images };
  }

  /**
   * Decode base64 image to buffer
   */
  private decodeBase64Image(dataUrl: string): Buffer {
    // Handle both data URLs and regular URLs
    if (dataUrl.startsWith('data:')) {
      // Extract base64 data from data URL
      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        throw new Error('Invalid data URL format');
      }
      return Buffer.from(matches[2], 'base64');
    } else {
      // For regular URLs, we'd need to fetch the image
      // For now, throw an error as we primarily support base64
      throw new Error('Only base64 images are supported in PDF export');
    }
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
