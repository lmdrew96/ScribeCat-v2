/**
 * HtmlExportService
 *
 * Service for exporting sessions to HTML format.
 * Infrastructure layer - implements IExportService.
 */

import { IExportService, ExportOptions, ExportResult } from '../../../domain/services/IExportService.js';
import { Session } from '../../../domain/entities/Session.js';
import { formatDurationWithHours, formatTimestampWithHours } from '../../../renderer/utils/formatting.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export class HtmlExportService implements IExportService {
  /**
   * Export a session to an HTML file
   */
  async export(session: Session, outputPath: string, options?: ExportOptions): Promise<ExportResult> {
    try {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Build the HTML content
      const html = this.buildHtml(session, options);

      // Write to file
      await fs.writeFile(outputPath, html, 'utf-8');

      return {
        success: true,
        filePath: outputPath,
        format: 'html'
      };
    } catch (error) {
      return {
        success: false,
        filePath: outputPath,
        format: 'html',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Build the HTML content
   */
  private buildHtml(session: Session, options?: ExportOptions): string {
    const includeMetadata = options?.includeMetadata !== false;
    const includeTranscription = options?.includeTranscription !== false;
    const includeNotes = options?.includeNotes !== false;
    const includeTimestamps = options?.includeTimestamps !== false;

    const sections: string[] = [];

    // Start HTML
    sections.push('<!DOCTYPE html>');
    sections.push('<html lang="en">');
    sections.push('<head>');
    sections.push('  <meta charset="UTF-8">');
    sections.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0">');
    sections.push(`  <title>${this.escapeHtml(session.title)}</title>`);
    sections.push(this.getStyles());
    sections.push('</head>');
    sections.push('<body>');
    sections.push('  <div class="container">');

    // Title
    sections.push(`    <h1 class="title">${this.escapeHtml(session.title)}</h1>`);

    // Metadata section
    if (includeMetadata) {
      sections.push('    <section class="metadata">');
      sections.push('      <h2>Metadata</h2>');
      sections.push('      <div class="metadata-grid">');
      sections.push(`        <div class="metadata-item"><strong>Session ID:</strong> ${this.escapeHtml(session.id)}</div>`);
      sections.push(`        <div class="metadata-item"><strong>Created:</strong> ${this.escapeHtml(this.formatDate(session.createdAt))}</div>`);
      sections.push(`        <div class="metadata-item"><strong>Updated:</strong> ${this.escapeHtml(this.formatDate(session.updatedAt))}</div>`);
      sections.push(`        <div class="metadata-item"><strong>Duration:</strong> ${this.escapeHtml(formatDurationWithHours(session.duration))}</div>`);
      
      if (session.tags.length > 0) {
        const tagsHtml = session.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join(' ');
        sections.push(`        <div class="metadata-item"><strong>Tags:</strong> ${tagsHtml}</div>`);
      }
      
      sections.push('      </div>');
      sections.push('    </section>');
    }

    // Transcription section
    if (includeTranscription && session.hasTranscription() && session.transcription) {
      sections.push('    <section class="transcription">');
      sections.push('      <h2>Transcription</h2>');
      
      if (includeTimestamps && session.transcription.segments.length > 0) {
        // Include timestamped segments
        sections.push('      <div class="segments">');
        for (const segment of session.transcription.segments) {
          const timestamp = formatTimestampWithHours(segment.startTime);
          const confidence = segment.confidence
            ? ` <span class="confidence">(${(segment.confidence * 100).toFixed(1)}%)</span>`
            : '';

          sections.push(`        <div class="segment">`);
          sections.push(`          <span class="timestamp">[${timestamp}]</span>${confidence}`);
          sections.push(`          <span class="text">${this.escapeHtml(segment.text)}</span>`);
          sections.push(`        </div>`);
        }
        sections.push('      </div>');
      } else {
        // Just include the full text
        const paragraphs = session.transcription.fullText.split('\n');
        sections.push('      <div class="text-content">');
        for (const para of paragraphs) {
          if (para.trim()) {
            sections.push(`        <p>${this.escapeHtml(para)}</p>`);
          }
        }
        sections.push('      </div>');
      }
      
      // Transcription metadata
      if (includeMetadata) {
        sections.push('      <div class="transcription-meta">');
        sections.push(`        <div><strong>Provider:</strong> ${this.escapeHtml(session.transcription.provider)}</div>`);
        sections.push(`        <div><strong>Language:</strong> ${this.escapeHtml(session.transcription.language)}</div>`);
        if (session.transcription.averageConfidence !== undefined) {
          sections.push(`        <div><strong>Average Confidence:</strong> ${(session.transcription.averageConfidence * 100).toFixed(1)}%</div>`);
        }
        sections.push('      </div>');
      }
      
      sections.push('    </section>');
    }

    // Notes section
    if (includeNotes && session.notes.trim().length > 0) {
      sections.push('    <section class="notes">');
      sections.push('      <h2>Notes</h2>');
      sections.push('      <div class="notes-content">');
      // Notes are already in HTML format, but sanitize them
      sections.push(`        ${this.sanitizeHtml(session.notes)}`);
      sections.push('      </div>');
      sections.push('    </section>');
    }

    // Footer
    sections.push('    <footer>');
    sections.push(`      <p><em>Exported: ${this.escapeHtml(this.formatDate(new Date()))}</em></p>`);
    sections.push('      <p>Generated by ScribeCat v2</p>');
    sections.push('    </footer>');

    sections.push('  </div>');
    sections.push('</body>');
    sections.push('</html>');

    return sections.join('\n');
  }

  /**
   * Get CSS styles for the HTML document
   */
  private getStyles(): string {
    return `  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      padding: 20px;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      background-color: white;
      padding: 40px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      border-radius: 8px;
    }
    
    .title {
      text-align: center;
      color: #2c3e50;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #3498db;
    }
    
    h2 {
      color: #2c3e50;
      margin-top: 30px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #ecf0f1;
    }
    
    section {
      margin-bottom: 30px;
    }
    
    .metadata-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    
    .metadata-item {
      padding: 10px;
      background-color: #f8f9fa;
      border-radius: 4px;
    }
    
    .tag {
      display: inline-block;
      background-color: #3498db;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.9em;
      margin-right: 5px;
    }
    
    .segments {
      margin-top: 15px;
    }
    
    .segment {
      margin-bottom: 12px;
      padding: 10px;
      background-color: #f8f9fa;
      border-left: 3px solid #3498db;
      border-radius: 4px;
    }
    
    .timestamp {
      font-weight: bold;
      color: #7f8c8d;
      margin-right: 8px;
    }
    
    .confidence {
      color: #95a5a6;
      font-size: 0.9em;
    }
    
    .text {
      color: #2c3e50;
    }
    
    .text-content p {
      margin-bottom: 12px;
      text-align: justify;
    }
    
    .transcription-meta {
      margin-top: 20px;
      padding: 15px;
      background-color: #ecf0f1;
      border-radius: 4px;
    }
    
    .transcription-meta div {
      margin-bottom: 5px;
    }
    
    .notes-content {
      margin-top: 15px;
      padding: 15px;
      background-color: #fffef7;
      border: 1px solid #f1c40f;
      border-radius: 4px;
    }
    
    footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #ecf0f1;
      text-align: center;
      color: #7f8c8d;
      font-size: 0.9em;
    }
    
    footer p {
      margin-bottom: 5px;
    }
    
    @media print {
      body {
        background-color: white;
        padding: 0;
      }
      
      .container {
        box-shadow: none;
        padding: 20px;
      }
    }
  </style>`;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Sanitize HTML content (basic sanitization)
   */
  private sanitizeHtml(html: string): string {
    // Allow only safe HTML tags
    const allowedTags = ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    
    // Remove script tags and event handlers
    let sanitized = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '');
    
    return sanitized;
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
   * Get the supported export format
   */
  getFormat(): 'txt' | 'pdf' | 'docx' | 'html' {
    return 'html';
  }

  /**
   * Check if the service is available
   */
  async isAvailable(): Promise<boolean> {
    // HTML export is always available (no external dependencies)
    return true;
  }
}
