/**
 * Markdown Renderer
 * Safely renders markdown to HTML with XSS protection
 */

import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { escapeHtml } from './utils/formatting.js';

/**
 * Configure marked options for better rendering
 */
marked.setOptions({
  breaks: true, // Convert \n to <br>
  gfm: true, // GitHub Flavored Markdown
});

/**
 * Configure DOMPurify to allow safe HTML elements
 */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote',
  'a',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'hr',
  'span', 'div'
];

const ALLOWED_ATTR = ['href', 'title', 'class', 'target', 'rel'];

/**
 * Renders markdown text to sanitized HTML
 * @param markdown - The markdown text to render
 * @returns Sanitized HTML string
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  try {
    // Parse markdown to HTML
    const rawHtml = marked.parse(markdown) as string;
    
    // Sanitize HTML to prevent XSS
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false,
    });
    
    // Post-process to add security attributes to links
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cleanHtml;
    
    const links = tempDiv.querySelectorAll('a');
    links.forEach(link => {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });
    
    return tempDiv.innerHTML;
  } catch (error) {
    console.error('Error rendering markdown:', error);
    // Return escaped text as fallback
    return escapeHtml(markdown);
  }
}


/**
 * Checks if text contains markdown syntax
 * @param text - Text to check
 * @returns True if text appears to contain markdown
 */
export function hasMarkdownSyntax(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  // Check for common markdown patterns
  const markdownPatterns = [
    /\*\*[^*]+\*\*/,  // Bold
    /\*[^*]+\*/,      // Italic
    /__[^_]+__/,      // Bold (underscore)
    /_[^_]+_/,        // Italic (underscore)
    /`[^`]+`/,        // Inline code
    /```[\s\S]+```/,  // Code block
    /^#{1,6}\s/m,     // Headers
    /^\s*[-*+]\s/m,   // Unordered list
    /^\s*\d+\.\s/m,   // Ordered list
    /^\s*>\s/m,       // Blockquote
    /\[.+\]\(.+\)/,   // Links
  ];

  return markdownPatterns.some(pattern => pattern.test(text));
}
