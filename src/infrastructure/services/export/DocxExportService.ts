/**
 * DocxExportService
 * 
 * Service for exporting sessions to Microsoft Word (DOCX) format.
 * Infrastructure layer - implements IExportService.
 */

import { IExportService, ExportOptions, ExportResult } from '../../../domain/services/IExportService.js';
import { Session } from '../../../domain/entities/Session.js';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import * as fs from 'fs/promises';
import * as path from 'path';

export class DocxExportService implements IExportService {
  /**
   * Export a session to a DOCX file
   */
  async export(session: Session, outputPath: string, options?: ExportOptions): Promise<ExportResult> {
    try {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Build the document
      const doc = this.buildDocument(session, options);

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
   * Build the DOCX document
   */
  private buildDocument(session: Session, options?: ExportOptions): Document {
    const includeMetadata = options?.includeMetadata !== false;
    const includeTranscription = options?.includeTranscription !== false;
    const includeNotes = options?.includeNotes !== false;
    const includeTimestamps = options?.includeTimestamps !== false;

    const sections: Paragraph[] = [];

    // Title
    sections.push(
      new Paragraph({
        text: session.title,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    );

    // Metadata section
    if (includeMetadata) {
      sections.push(
        new Paragraph({
          text: 'Metadata',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 200 }
        })
      );

      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Session ID: ', bold: true }),
            new TextRun(session.id)
          ],
          spacing: { after: 100 }
        })
      );

      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Created: ', bold: true }),
            new TextRun(this.formatDate(session.createdAt))
          ],
          spacing: { after: 100 }
        })
      );

      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Updated: ', bold: true }),
            new TextRun(this.formatDate(session.updatedAt))
          ],
          spacing: { after: 100 }
        })
      );

      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Duration: ', bold: true }),
            new TextRun(this.formatDuration(session.duration))
          ],
          spacing: { after: 100 }
        })
      );

      if (session.tags.length > 0) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Tags: ', bold: true }),
              new TextRun(session.tags.join(', '))
            ],
            spacing: { after: 200 }
          })
        );
      }
    }

    // Transcription section
    if (includeTranscription && session.hasTranscription() && session.transcription) {
      sections.push(
        new Paragraph({
          text: 'Transcription',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        })
      );

      if (includeTimestamps && session.transcription.segments.length > 0) {
        // Include timestamped segments
        for (const segment of session.transcription.segments) {
          const timestamp = this.formatTimestamp(segment.startTime);
          const confidence = segment.confidence 
            ? ` (${(segment.confidence * 100).toFixed(1)}%)`
            : '';

          sections.push(
            new Paragraph({
              children: [
                new TextRun({ text: `[${timestamp}]${confidence} `, bold: true, color: '666666' }),
                new TextRun(segment.text)
              ],
              spacing: { after: 100 }
            })
          );
        }
      } else {
        // Just include the full text
        const paragraphs = session.transcription.fullText.split('\n');
        for (const para of paragraphs) {
          if (para.trim()) {
            sections.push(
              new Paragraph({
                text: para,
                spacing: { after: 100 }
              })
            );
          }
        }
      }

      // Transcription metadata
      if (includeMetadata) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Provider: ', bold: true }),
              new TextRun(session.transcription.provider)
            ],
            spacing: { before: 200, after: 100 }
          })
        );

        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Language: ', bold: true }),
              new TextRun(session.transcription.language)
            ],
            spacing: { after: 100 }
          })
        );

        if (session.transcription.averageConfidence !== undefined) {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Average Confidence: ', bold: true }),
                new TextRun(`${(session.transcription.averageConfidence * 100).toFixed(1)}%`)
              ],
              spacing: { after: 200 }
            })
          );
        }
      }
    }

    // Notes section
    if (includeNotes && session.notes.trim().length > 0) {
      sections.push(
        new Paragraph({
          text: 'Notes',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        })
      );

      // Strip HTML and split into paragraphs
      const plainNotes = this.stripHtml(session.notes);
      const noteParagraphs = plainNotes.split('\n');
      
      for (const para of noteParagraphs) {
        if (para.trim()) {
          sections.push(
            new Paragraph({
              text: para,
              spacing: { after: 100 }
            })
          );
        }
      }
    }

    // Footer
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Exported: ', italics: true }),
          new TextRun({ text: this.formatDate(new Date()), italics: true })
        ],
        spacing: { before: 400 },
        alignment: AlignmentType.CENTER
      })
    );

    sections.push(
      new Paragraph({
        text: 'Generated by ScribeCat v2',
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 }
      })
    );

    return new Document({
      sections: [{
        properties: {},
        children: sections
      }]
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
   * Format duration in seconds to readable format
   */
  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Format timestamp in seconds to MM:SS or HH:MM:SS
   */
  private formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
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
