/**
 * DocxHtmlParser
 *
 * Parses HTML content from TipTap editor into structured blocks for DOCX export.
 */

import { DocxFormatters } from './DocxFormatters.js';

export interface HtmlBlock {
  type: string;
  content: string;
  level?: number;
  indentLevel?: number;
}

export class DocxHtmlParser {
  /**
   * Convert HTML from TipTap editor to structured blocks
   */
  static parseHtml(html: string): HtmlBlock[] {
    const cleanHtml = html.replace(/&nbsp;/g, ' ');
    return this.parseHtmlBlocks(cleanHtml);
  }

  /**
   * Parse HTML into block-level elements
   */
  private static parseHtmlBlocks(html: string): HtmlBlock[] {
    const blocks: HtmlBlock[] = [];
    this.parseHtmlBlocksRecursive(html, blocks, 0);
    return blocks;
  }

  /**
   * Recursively parse HTML blocks, handling nested lists
   */
  private static parseHtmlBlocksRecursive(
    html: string,
    blocks: HtmlBlock[],
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
        const textContent = DocxFormatters.stripHtml(content);
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
  private static parseListItems(
    listContent: string,
    blocks: HtmlBlock[],
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
  private static extractListItemContent(liContent: string): string {
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
    return DocxFormatters.stripHtml(content).trim();
  }
}
