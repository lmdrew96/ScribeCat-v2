/**
 * DocxExportService
 * 
 * Service for exporting sessions to Microsoft Word (DOCX) format.
 * Infrastructure layer - implements IExportService.
 */

import { IExportService, ExportOptions, ExportResult } from '../../../domain/services/IExportService.js';
import { Session } from '../../../domain/entities/Session.js';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
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

      // Convert HTML to DOCX paragraphs with formatting preserved
      const noteParagraphs = this.convertHtmlToDocx(session.notes);
      sections.push(...noteParagraphs);
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
   * Convert HTML from TipTap editor to DOCX paragraphs with formatting
   */
  private convertHtmlToDocx(html: string): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    // Parse HTML into a DOM-like structure
    const cleanHtml = html.replace(/&nbsp;/g, ' ');

    // Split by block-level elements
    const blocks = this.parseHtmlBlocks(cleanHtml);

    for (const block of blocks) {
      const paragraph = this.createParagraphFromBlock(block);
      if (paragraph) {
        paragraphs.push(paragraph);
      }
    }

    return paragraphs;
  }

  /**
   * Parse HTML into block-level elements
   */
  private parseHtmlBlocks(html: string): Array<{ type: string; content: string; level?: number; indentLevel?: number }> {
    const blocks: Array<{ type: string; content: string; level?: number; indentLevel?: number }> = [];

    // Parse the HTML recursively to handle nested structures
    this.parseHtmlBlocksRecursive(html, blocks, 0);

    return blocks;
  }

  /**
   * Recursively parse HTML blocks, handling nested lists
   */
  private parseHtmlBlocksRecursive(
    html: string,
    blocks: Array<{ type: string; content: string; level?: number; indentLevel?: number }>,
    currentIndent: number
  ): void {
    let position = 0;

    while (position < html.length) {
      // Try to match block-level elements
      const remainingHtml = html.substring(position);

      // Match opening tags for block elements
      const blockMatch = remainingHtml.match(/^<(p|h[1-6]|ul|ol|li|blockquote|br)(?:\s[^>]*)?>/i);

      if (!blockMatch) {
        // No more block elements, check if there's remaining text
        const trimmed = remainingHtml.trim();
        if (trimmed && !trimmed.startsWith('<')) {
          blocks.push({ type: 'p', content: trimmed, indentLevel: currentIndent });
        }
        break;
      }

      const tag = blockMatch[1].toLowerCase();
      const tagStart = position + blockMatch.index!;
      const tagLength = blockMatch[0].length;

      // Find the matching closing tag
      const closingTag = `</${tag}>`;
      let depth = 1;
      let searchPos = tagStart + tagLength;
      let closingTagPos = -1;

      while (depth > 0 && searchPos < html.length) {
        const nextOpen = html.indexOf(`<${tag}`, searchPos);
        const nextClose = html.indexOf(closingTag, searchPos);

        if (nextClose === -1) {
          break;
        }

        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth++;
          searchPos = nextOpen + tag.length + 1;
        } else {
          depth--;
          if (depth === 0) {
            closingTagPos = nextClose;
          }
          searchPos = nextClose + closingTag.length;
        }
      }

      if (closingTagPos === -1) {
        // No closing tag found, skip this tag
        position = tagStart + tagLength;
        continue;
      }

      const content = html.substring(tagStart + tagLength, closingTagPos);

      // Handle different block types
      if (tag === 'ul' || tag === 'ol') {
        // Parse list items
        this.parseListItems(content, blocks, currentIndent);
      } else if (tag === 'li') {
        // Extract text content from list item, handling nested elements
        const textContent = this.extractListItemContent(content);
        blocks.push({ type: 'li', content: textContent, indentLevel: currentIndent });

        // Check for nested lists within this list item
        const nestedListMatch = content.match(/<(ul|ol)(?:\s[^>]*)?>/i);
        if (nestedListMatch) {
          // Find the nested list and parse it
          const nestedListStart = content.indexOf(nestedListMatch[0]);
          const nestedListTag = nestedListMatch[1].toLowerCase();
          const nestedListClose = `</${nestedListTag}>`;

          let nestedDepth = 1;
          let nestedPos = nestedListStart + nestedListMatch[0].length;
          let nestedClosePos = -1;

          while (nestedDepth > 0 && nestedPos < content.length) {
            const nextOpen = content.indexOf(`<${nestedListTag}`, nestedPos);
            const nextClose = content.indexOf(nestedListClose, nestedPos);

            if (nextClose === -1) break;

            if (nextOpen !== -1 && nextOpen < nextClose) {
              nestedDepth++;
              nestedPos = nextOpen + nestedListTag.length + 1;
            } else {
              nestedDepth--;
              if (nestedDepth === 0) {
                nestedClosePos = nextClose;
              }
              nestedPos = nextClose + nestedListClose.length;
            }
          }

          if (nestedClosePos !== -1) {
            const nestedListContent = content.substring(nestedListStart + nestedListMatch[0].length, nestedClosePos);
            this.parseListItems(nestedListContent, blocks, currentIndent + 1);
          }
        }
      } else if (tag.startsWith('h')) {
        const level = parseInt(tag[1]);
        const textContent = this.stripHtml(content);
        blocks.push({ type: 'heading', content: textContent, level, indentLevel: currentIndent });
      } else if (tag === 'blockquote') {
        this.parseHtmlBlocksRecursive(content, blocks, currentIndent);
        // Mark the last added blocks as blockquotes
        const startIndex = blocks.length - 1;
        if (blocks[startIndex]) {
          blocks[startIndex].type = 'blockquote';
        }
      } else if (tag === 'p') {
        const textContent = content.trim();
        if (textContent) {
          blocks.push({ type: 'p', content: textContent, indentLevel: currentIndent });
        }
      } else if (tag === 'br') {
        blocks.push({ type: 'p', content: '', indentLevel: currentIndent });
      }

      position = closingTagPos + closingTag.length;
    }
  }

  /**
   * Parse list items from list content
   */
  private parseListItems(
    listContent: string,
    blocks: Array<{ type: string; content: string; level?: number; indentLevel?: number }>,
    indentLevel: number
  ): void {
    let position = 0;

    while (position < listContent.length) {
      const remainingContent = listContent.substring(position);
      const liMatch = remainingContent.match(/^<li(?:\s[^>]*)?>/i);

      if (!liMatch) {
        position++;
        continue;
      }

      const liStart = position + liMatch.index!;
      const liTagLength = liMatch[0].length;

      // Find closing </li>
      const closingLi = '</li>';
      let depth = 1;
      let searchPos = liStart + liTagLength;
      let closingPos = -1;

      while (depth > 0 && searchPos < listContent.length) {
        const nextOpen = listContent.indexOf('<li', searchPos);
        const nextClose = listContent.indexOf(closingLi, searchPos);

        if (nextClose === -1) break;

        if (nextOpen !== -1 && nextOpen < nextClose && listContent[nextOpen + 3] !== '/') {
          depth++;
          searchPos = nextOpen + 3;
        } else {
          depth--;
          if (depth === 0) {
            closingPos = nextClose;
          }
          searchPos = nextClose + closingLi.length;
        }
      }

      if (closingPos === -1) {
        position = liStart + liTagLength;
        continue;
      }

      const liContent = listContent.substring(liStart + liTagLength, closingPos);

      // Extract the text content (before any nested list)
      const textContent = this.extractListItemContent(liContent);
      if (textContent.trim()) {
        blocks.push({ type: 'li', content: textContent, indentLevel });
      }

      // Check for nested lists
      const nestedListMatch = liContent.match(/<(ul|ol)(?:\s[^>]*)?>/i);
      if (nestedListMatch) {
        const nestedListStart = liContent.indexOf(nestedListMatch[0]);
        const nestedListTag = nestedListMatch[1].toLowerCase();
        const nestedListClose = `</${nestedListTag}>`;

        let nestedDepth = 1;
        let nestedPos = nestedListStart + nestedListMatch[0].length;
        let nestedClosePos = -1;

        while (nestedDepth > 0 && nestedPos < liContent.length) {
          const nextOpen = liContent.indexOf(`<${nestedListTag}`, nestedPos);
          const nextClose = liContent.indexOf(nestedListClose, nestedPos);

          if (nextClose === -1) break;

          if (nextOpen !== -1 && nextOpen < nextClose) {
            nestedDepth++;
            nestedPos = nextOpen + nestedListTag.length + 1;
          } else {
            nestedDepth--;
            if (nestedDepth === 0) {
              nestedClosePos = nextClose;
            }
            nestedPos = nextClose + nestedListClose.length;
          }
        }

        if (nestedClosePos !== -1) {
          const nestedContent = liContent.substring(nestedListStart + nestedListMatch[0].length, nestedClosePos);
          this.parseListItems(nestedContent, blocks, indentLevel + 1);
        }
      }

      position = closingPos + closingLi.length;
    }
  }

  /**
   * Extract text content from a list item, excluding nested lists
   */
  private extractListItemContent(liContent: string): string {
    // Remove nested ul/ol tags and their content
    let content = liContent;

    // Find the first nested list
    const nestedListMatch = content.match(/<(ul|ol)(?:\s[^>]*)?>/i);
    if (nestedListMatch) {
      const nestedStart = content.indexOf(nestedListMatch[0]);
      content = content.substring(0, nestedStart);
    }

    // Extract text from any <p> tags
    const pMatch = content.match(/<p(?:\s[^>]*)?>([^<]*)<\/p>/i);
    if (pMatch) {
      return pMatch[1].trim();
    }

    // Otherwise strip all HTML and return
    return this.stripHtml(content).trim();
  }

  /**
   * Create a DOCX paragraph from an HTML block
   */
  private createParagraphFromBlock(block: { type: string; content: string; level?: number; indentLevel?: number }): Paragraph | null {
    const textRuns = this.parseInlineFormatting(block.content);

    if (textRuns.length === 0 && !block.content.trim()) {
      return null;
    }

    const paragraphOptions: any = {
      children: textRuns,
      spacing: { after: 100 }
    };

    // Apply block-level formatting
    if (block.type === 'heading' && block.level) {
      const headingLevels = [
        HeadingLevel.HEADING_1,
        HeadingLevel.HEADING_2,
        HeadingLevel.HEADING_3,
        HeadingLevel.HEADING_4,
        HeadingLevel.HEADING_5,
        HeadingLevel.HEADING_6
      ];
      paragraphOptions.heading = headingLevels[block.level - 1] || HeadingLevel.HEADING_1;
      paragraphOptions.spacing = { before: 200, after: 100 };
    } else if (block.type === 'blockquote') {
      paragraphOptions.indent = { left: 720 }; // 0.5 inch
      paragraphOptions.spacing = { before: 100, after: 100 };
    } else if (block.type === 'li') {
      // Use the indentLevel to set the bullet level
      const bulletLevel = block.indentLevel || 0;
      paragraphOptions.bullet = { level: bulletLevel };
    }

    return new Paragraph(paragraphOptions);
  }

  /**
   * Parse inline formatting (bold, italic, underline, etc.) from HTML
   */
  private parseInlineFormatting(html: string): TextRun[] {
    const runs: TextRun[] = [];

    if (!html || !html.trim()) {
      return runs;
    }

    // Parse the HTML content with inline formatting
    const segments = this.segmentInlineHtml(html);

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (segment.text) {
        let text = segment.text;

        // Add space before if previous segment didn't end with whitespace
        // and current doesn't start with whitespace
        if (i > 0 && runs.length > 0) {
          const prevSegment = segments[i - 1];
          if (prevSegment.text &&
              !prevSegment.text.endsWith(' ') &&
              !prevSegment.text.endsWith('\n') &&
              !text.startsWith(' ') &&
              !text.startsWith('\n')) {
            // Check if there's punctuation - don't add space before punctuation
            if (!/^[.,!?;:)]/.test(text)) {
              text = ' ' + text;
            }
          }
        }

        const textRunOptions: any = {
          text: text,
          bold: segment.bold,
          italics: segment.italic,
          underline: segment.underline ? {} : undefined,
          strike: segment.strike,
          superScript: segment.superscript,
          subScript: segment.subscript
        };

        // Only add color if it's valid
        if (segment.color) {
          textRunOptions.color = segment.color;
        }

        // Map highlight to valid DOCX colors
        if (segment.highlight) {
          const mappedHighlight = this.mapHighlightColor(segment.highlight);
          if (mappedHighlight) {
            textRunOptions.highlight = mappedHighlight;
          }
        }

        runs.push(new TextRun(textRunOptions));
      }
    }

    // If no runs were created, add at least one with plain text
    if (runs.length === 0) {
      const plainText = this.stripHtml(html);
      if (plainText.trim()) {
        runs.push(new TextRun(plainText));
      }
    }

    return runs;
  }

  /**
   * Segment HTML into formatted text segments
   */
  private segmentInlineHtml(html: string): Array<{
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
    superscript?: boolean;
    subscript?: boolean;
    color?: string;
    highlight?: string;
  }> {
    const segments: any[] = [];

    // Stack to track active formatting
    const formatStack: any[] = [{}];
    let currentText = '';

    // Simple HTML parser
    const tagRegex = /<\/?([a-z]+)(?:\s+[^>]*)?>/gi;
    let lastIndex = 0;
    let match;

    while ((match = tagRegex.exec(html)) !== null) {
      // Add text before the tag
      const textBefore = html.substring(lastIndex, match.index);
      if (textBefore) {
        currentText += textBefore;
      }

      const tagName = match[1].toLowerCase();
      const isClosing = match[0].startsWith('</');

      // Tags that should not affect formatting (just ignore them)
      const ignoreTags = ['span', 'div', 'a', 'code', 'pre'];

      if (isClosing) {
        // Save current text with current formatting
        if (currentText) {
          const currentFormat = { ...formatStack[formatStack.length - 1] };
          segments.push({ text: currentText, ...currentFormat });
          currentText = '';
        }

        // Pop format from stack (but not for ignored tags)
        if (!ignoreTags.includes(tagName) && formatStack.length > 1) {
          formatStack.pop();
        }
      } else {
        // Save current text with current formatting
        if (currentText) {
          const currentFormat = { ...formatStack[formatStack.length - 1] };
          segments.push({ text: currentText, ...currentFormat });
          currentText = '';
        }

        // For ignored tags, don't modify the format stack
        if (ignoreTags.includes(tagName)) {
          lastIndex = match.index + match[0].length;
          continue;
        }

        // Push new format to stack
        const newFormat = { ...formatStack[formatStack.length - 1] };

        switch (tagName) {
          case 'strong':
          case 'b':
            newFormat.bold = true;
            break;
          case 'em':
          case 'i':
            newFormat.italic = true;
            break;
          case 'u':
            newFormat.underline = true;
            break;
          case 's':
          case 'strike':
          case 'del':
            newFormat.strike = true;
            break;
          case 'sup':
            newFormat.superscript = true;
            break;
          case 'sub':
            newFormat.subscript = true;
            break;
          case 'mark':
            newFormat.highlight = 'yellow';
            break;
        }

        // Extract color from style attribute if present
        const styleMatch = match[0].match(/style=["']([^"']+)["']/);
        if (styleMatch) {
          const colorMatch = styleMatch[1].match(/color:\s*([^;]+)/);
          if (colorMatch) {
            newFormat.color = this.parseColor(colorMatch[1]);
          }
          const bgMatch = styleMatch[1].match(/background-color:\s*([^;]+)/);
          if (bgMatch) {
            newFormat.highlight = this.parseColor(bgMatch[1]);
          }
        }

        formatStack.push(newFormat);
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    const remainingText = html.substring(lastIndex);
    if (remainingText) {
      currentText += remainingText;
    }

    if (currentText) {
      const currentFormat = { ...formatStack[formatStack.length - 1] };
      // Decode HTML entities
      currentText = currentText
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      segments.push({ text: currentText, ...currentFormat });
    }

    return segments;
  }

  /**
   * Parse color from CSS color value
   */
  private parseColor(color: string): string {
    // Remove whitespace
    color = color.trim();

    // If it's a hex color, return without #
    if (color.startsWith('#')) {
      return color.substring(1);
    }

    // If it's rgb/rgba, convert to hex
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
      const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
      const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
      return r + g + b;
    }

    // Return as-is for named colors (DOCX may not support all)
    return color;
  }

  /**
   * Map arbitrary color to valid DOCX highlight color
   */
  private mapHighlightColor(color: string): 'yellow' | 'green' | 'cyan' | 'magenta' | 'blue' | 'red' | 'darkBlue' | 'darkCyan' | 'darkGreen' | 'darkMagenta' | 'darkRed' | 'darkYellow' | 'darkGray' | 'lightGray' | 'black' | 'white' | undefined {
    const normalizedColor = color.toLowerCase().replace(/\s/g, '');

    // Direct matches
    const directMatches: { [key: string]: any } = {
      'yellow': 'yellow',
      'green': 'green',
      'cyan': 'cyan',
      'magenta': 'magenta',
      'blue': 'blue',
      'red': 'red',
      'darkblue': 'darkBlue',
      'darkcyan': 'darkCyan',
      'darkgreen': 'darkGreen',
      'darkmagenta': 'darkMagenta',
      'darkred': 'darkRed',
      'darkyellow': 'darkYellow',
      'darkgray': 'darkGray',
      'darkgrey': 'darkGray',
      'lightgray': 'lightGray',
      'lightgrey': 'lightGray',
      'black': 'black',
      'white': 'white'
    };

    if (directMatches[normalizedColor]) {
      return directMatches[normalizedColor];
    }

    // Try to map hex/rgb colors to closest match
    const hex = this.parseColor(color);
    if (hex) {
      // Convert hex to RGB
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      // Simple heuristic mapping
      if (r > 200 && g > 200 && b < 100) return 'yellow';
      if (r < 100 && g > 200 && b < 100) return 'green';
      if (r < 100 && g > 200 && b > 200) return 'cyan';
      if (r > 200 && g < 100 && b > 200) return 'magenta';
      if (r < 100 && g < 100 && b > 200) return 'blue';
      if (r > 200 && g < 100 && b < 100) return 'red';
    }

    // Default to yellow for unrecognized highlights
    return 'yellow';
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
