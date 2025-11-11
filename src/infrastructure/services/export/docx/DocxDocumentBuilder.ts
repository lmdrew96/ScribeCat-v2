/**
 * DocxDocumentBuilder
 *
 * Builds DOCX documents from session data, using parsers and formatters.
 */

import { Session } from '../../../../domain/entities/Session.js';
import { ExportOptions } from '../../../../domain/services/IExportService.js';
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ImageRun,
  HorizontalPositionAlign,
  VerticalPositionAlign,
  TextWrappingType,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom
} from 'docx';
import { DocxHtmlParser, HtmlBlock } from './DocxHtmlParser.js';
import { DocxInlineFormatter } from './DocxInlineFormatter.js';
import { DocxFormatters } from './DocxFormatters.js';

export class DocxDocumentBuilder {
  /**
   * Build the DOCX document from session data
   */
  static buildDocument(session: Session, options?: ExportOptions): Document {
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
      this.addMetadataSection(sections, session);
    }

    // Transcription section
    if (includeTranscription && session.hasTranscription() && session.transcription) {
      this.addTranscriptionSection(sections, session, includeTimestamps, includeMetadata);
    }

    // Notes section
    if (includeNotes && session.notes.trim().length > 0) {
      this.addNotesSection(sections, session);
    }

    // Footer
    this.addFooter(sections);

    return new Document({
      sections: [{
        properties: {},
        children: sections
      }]
    });
  }

  /**
   * Add metadata section to document
   */
  private static addMetadataSection(sections: Paragraph[], session: Session): void {
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
          new TextRun(DocxFormatters.formatDate(session.createdAt))
        ],
        spacing: { after: 100 }
      })
    );

    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Updated: ', bold: true }),
          new TextRun(DocxFormatters.formatDate(session.updatedAt))
        ],
        spacing: { after: 100 }
      })
    );

    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Duration: ', bold: true }),
          new TextRun(DocxFormatters.formatDuration(session.duration))
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

  /**
   * Add transcription section to document
   */
  private static addTranscriptionSection(
    sections: Paragraph[],
    session: Session,
    includeTimestamps: boolean,
    includeMetadata: boolean
  ): void {
    sections.push(
      new Paragraph({
        text: 'Transcription',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      })
    );

    if (includeTimestamps && session.transcription!.segments.length > 0) {
      // Include timestamped segments
      for (const segment of session.transcription!.segments) {
        const timestamp = DocxFormatters.formatTimestamp(segment.startTime);
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
      const paragraphs = session.transcription!.fullText.split('\n');
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
            new TextRun(session.transcription!.provider)
          ],
          spacing: { before: 200, after: 100 }
        })
      );

      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Language: ', bold: true }),
            new TextRun(session.transcription!.language)
          ],
          spacing: { after: 100 }
        })
      );

      if (session.transcription!.averageConfidence !== undefined) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Average Confidence: ', bold: true }),
              new TextRun(`${(session.transcription!.averageConfidence * 100).toFixed(1)}%`)
            ],
            spacing: { after: 200 }
          })
        );
      }
    }
  }

  /**
   * Add notes section to document
   */
  private static addNotesSection(sections: Paragraph[], session: Session): void {
    sections.push(
      new Paragraph({
        text: 'Notes',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      })
    );

    // Convert HTML to DOCX paragraphs with formatting preserved
    const htmlBlocks = DocxHtmlParser.parseHtml(session.notes);
    const noteParagraphs = htmlBlocks
      .map(block => this.createParagraphFromBlock(block))
      .filter((p): p is Paragraph => p !== null);

    sections.push(...noteParagraphs);
  }

  /**
   * Add footer to document
   */
  private static addFooter(sections: Paragraph[]): void {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Exported: ', italics: true }),
          new TextRun({ text: DocxFormatters.formatDate(new Date()), italics: true })
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
  }

  /**
   * Create a DOCX paragraph from an HTML block
   */
  private static createParagraphFromBlock(block: HtmlBlock): Paragraph | null {
    // Handle image blocks
    if (block.type === 'image' && block.imageSrc) {
      return this.createImageParagraph(block);
    }

    const textRuns = DocxInlineFormatter.parseInlineFormatting(block.content);

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
   * Create a paragraph containing an image
   */
  private static createImageParagraph(block: HtmlBlock): Paragraph | null {
    if (!block.imageSrc) return null;

    try {
      // Decode base64 image
      const imageBuffer = this.decodeBase64Image(block.imageSrc);

      // Get dimensions in EMUs (default to 200px if not specified)
      const widthInPixels = block.imageWidth || 200;
      const heightInPixels = block.imageHeight || 200;
      const widthInEMUs = this.pixelsToEMUs(widthInPixels);
      const heightInEMUs = this.pixelsToEMUs(heightInPixels);

      const anchorType = block.anchorType || 'paragraph';
      const wrapType = block.wrapType || 'square';
      const textWrappingType = this.getTextWrappingType(wrapType);

      // Create ImageRun based on anchor type
      if (anchorType === 'page' && block.posX !== undefined && block.posY !== undefined) {
        // Page-anchored: Floating image with absolute positioning
        const xInEMUs = this.pixelsToEMUs(block.posX);
        const yInEMUs = this.pixelsToEMUs(block.posY);

        const imageRun = new ImageRun({
          data: imageBuffer,
          transformation: {
            width: widthInEMUs,
            height: heightInEMUs
          },
          floating: {
            horizontalPosition: {
              offset: xInEMUs
            },
            verticalPosition: {
              offset: yInEMUs
            },
            wrap: {
              type: TextWrappingType.NONE,  // No text wrapping for page-anchored
              side: 'bothSides'
            }
          }
        });

        return new Paragraph({
          children: [imageRun],
          spacing: { after: 100 }
        });
      } else if (anchorType === 'paragraph') {
        // Paragraph-anchored: Floating image with text wrapping
        const imageRun = new ImageRun({
          data: imageBuffer,
          transformation: {
            width: widthInEMUs,
            height: heightInEMUs
          },
          floating: {
            horizontalPosition: {
              align: HorizontalPositionAlign.LEFT,  // Align left for wrapping
            },
            verticalPosition: {
              align: VerticalPositionAlign.TOP,  // Align top
            },
            wrap: {
              type: textWrappingType,  // Use selected wrap type
              side: 'bothSides'
            }
          }
        });

        return new Paragraph({
          children: [imageRun],
          spacing: { after: 100 }
        });
      } else {
        // Inline-anchored: Image flows with text like a character
        const imageRun = new ImageRun({
          data: imageBuffer,
          transformation: {
            width: widthInEMUs,
            height: heightInEMUs
          }
        });

        return new Paragraph({
          children: [imageRun],
          spacing: { after: 100 }
        });
      }
    } catch (error) {
      // If image processing fails, skip it
      console.warn('Failed to process image for DOCX export:', error);
      return null;
    }
  }

  /**
   * Decode base64 image to buffer
   */
  private static decodeBase64Image(dataUrl: string): Buffer {
    if (dataUrl.startsWith('data:')) {
      // Extract base64 data from data URL
      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        throw new Error('Invalid data URL format');
      }
      return Buffer.from(matches[2], 'base64');
    } else {
      throw new Error('Only base64 images are supported in DOCX export');
    }
  }

  /**
   * Convert pixels to EMUs (English Metric Units)
   * 1 pixel = 9525 EMUs at 96 DPI
   */
  private static pixelsToEMUs(pixels: number): number {
    return Math.round(pixels * 9525);
  }

  /**
   * Map wrap type to DOCX TextWrappingType
   */
  private static getTextWrappingType(wrapType: string): TextWrappingType {
    switch (wrapType) {
      case 'square':
        return TextWrappingType.SQUARE;
      case 'tight':
        return TextWrappingType.TIGHT;
      case 'top-bottom':
        return TextWrappingType.TOP_AND_BOTTOM;
      case 'none':
        return TextWrappingType.NONE;
      case 'inline':
      default:
        return TextWrappingType.SQUARE; // Default to square wrapping
    }
  }
}
