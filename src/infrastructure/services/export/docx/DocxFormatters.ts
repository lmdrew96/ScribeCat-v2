/**
 * DocxFormatters
 *
 * Utility functions for formatting dates, durations, colors, etc. for DOCX export.
 */

import { formatDurationWithHours, formatTimestampWithHours } from '../../../../renderer/utils/formatting.js';

export class DocxFormatters {
  /**
   * Format a date for display
   */
  static formatDate(date: Date): string {
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
   * @deprecated Use formatDurationWithHours from formatting.ts instead
   */
  static formatDuration(seconds: number): string {
    return formatDurationWithHours(seconds);
  }

  /**
   * Format timestamp in seconds to MM:SS or HH:MM:SS
   * @deprecated Use formatTimestampWithHours from formatting.ts instead
   */
  static formatTimestamp(seconds: number): string {
    return formatTimestampWithHours(seconds);
  }

  /**
   * Strip HTML tags from text
   */
  static stripHtml(html: string): string {
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
   * Parse color from CSS color value
   */
  static parseColor(color: string): string {
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
  static mapHighlightColor(color: string): 'yellow' | 'green' | 'cyan' | 'magenta' | 'blue' | 'red' | 'darkBlue' | 'darkCyan' | 'darkGreen' | 'darkMagenta' | 'darkRed' | 'darkYellow' | 'darkGray' | 'lightGray' | 'black' | 'white' | undefined {
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
}
