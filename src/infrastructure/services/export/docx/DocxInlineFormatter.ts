/**
 * DocxInlineFormatter
 *
 * Handles parsing inline HTML formatting (bold, italic, underline, etc.) into DOCX TextRuns.
 */

import { TextRun } from 'docx';
import { DocxFormatters } from './DocxFormatters.js';

interface FormattedSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  color?: string;
  highlight?: string;
}

export class DocxInlineFormatter {
  /**
   * Parse inline formatting (bold, italic, underline, etc.) from HTML
   */
  static parseInlineFormatting(html: string): TextRun[] {
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
          const mappedHighlight = DocxFormatters.mapHighlightColor(segment.highlight);
          if (mappedHighlight) {
            textRunOptions.highlight = mappedHighlight;
          }
        }

        runs.push(new TextRun(textRunOptions));
      }
    }

    // If no runs were created, add at least one with plain text
    if (runs.length === 0) {
      const plainText = DocxFormatters.stripHtml(html);
      if (plainText.trim()) {
        runs.push(new TextRun(plainText));
      }
    }

    return runs;
  }

  /**
   * Segment HTML into formatted text segments
   */
  private static segmentInlineHtml(html: string): FormattedSegment[] {
    const segments: FormattedSegment[] = [];

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
            newFormat.color = DocxFormatters.parseColor(colorMatch[1]);
          }
          const bgMatch = styleMatch[1].match(/background-color:\s*([^;]+)/);
          if (bgMatch) {
            newFormat.highlight = DocxFormatters.parseColor(bgMatch[1]);
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
}
