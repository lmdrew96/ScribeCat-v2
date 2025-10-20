/**
 * TranscriptionEnhancer
 * 
 * Utility for enhancing and cleaning up transcription text.
 * Infrastructure layer - text processing utilities.
 */

export class TranscriptionEnhancer {
  /**
   * Enhance transcription text with basic cleanup and formatting
   * @param text Raw transcription text
   * @returns Enhanced text
   */
  static enhance(text: string): string {
    let enhanced = text;

    // Remove extra whitespace
    enhanced = this.removeExtraWhitespace(enhanced);

    // Fix punctuation spacing
    enhanced = this.fixPunctuationSpacing(enhanced);

    // Capitalize sentences
    enhanced = this.capitalizeSentences(enhanced);

    // Capitalize "I" and contractions
    enhanced = this.capitalizeI(enhanced);

    // Basic grammar corrections
    enhanced = this.basicGrammarCorrections(enhanced);

    return enhanced;
  }

  /**
   * Remove extra whitespace (multiple spaces, tabs, etc.)
   */
  private static removeExtraWhitespace(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim();
  }

  /**
   * Fix spacing around punctuation marks
   */
  private static fixPunctuationSpacing(text: string): string {
    return text
      .replace(/\s+([.,!?;:])/g, '$1') // Remove space before punctuation
      .replace(/([.,!?;:])([^\s])/g, '$1 $2') // Add space after punctuation
      .replace(/\s+'/g, "'") // Fix apostrophe spacing
      .replace(/"\s+/g, '" ') // Fix quote spacing
      .replace(/\s+"/g, ' "');
  }

  /**
   * Capitalize the first letter of sentences
   */
  private static capitalizeSentences(text: string): string {
    // Capitalize first character
    text = text.charAt(0).toUpperCase() + text.slice(1);

    // Capitalize after sentence-ending punctuation
    return text.replace(/([.!?]\s+)([a-z])/g, (match, punctuation, letter) => {
      return punctuation + letter.toUpperCase();
    });
  }

  /**
   * Capitalize standalone "i" and "i" in contractions
   */
  private static capitalizeI(text: string): string {
    return text
      .replace(/\bi\b/g, 'I') // Standalone "i"
      .replace(/\bi'/g, "I'") // "i" in contractions like "i'm", "i'll"
      .replace(/\bi'/g, "I'"); // Handle different apostrophe types
  }

  /**
   * Apply basic grammar corrections
   */
  private static basicGrammarCorrections(text: string): string {
    return text
      // Common contractions
      .replace(/\bim\b/gi, "I'm")
      .replace(/\bive\b/gi, "I've")
      .replace(/\bill\b/gi, "I'll")
      .replace(/\bwont\b/gi, "won't")
      .replace(/\bcant\b/gi, "can't")
      .replace(/\bdont\b/gi, "don't")
      .replace(/\bdidnt\b/gi, "didn't")
      .replace(/\bwouldnt\b/gi, "wouldn't")
      .replace(/\bcouldnt\b/gi, "couldn't")
      .replace(/\bshouldnt\b/gi, "shouldn't")
      .replace(/\bisnt\b/gi, "isn't")
      .replace(/\barent\b/gi, "aren't")
      .replace(/\bwasnt\b/gi, "wasn't")
      .replace(/\bwerent\b/gi, "weren't")
      .replace(/\bhasnt\b/gi, "hasn't")
      .replace(/\bhavent\b/gi, "haven't")
      .replace(/\bhadnt\b/gi, "hadn't")
      
      // Common misspellings
      .replace(/\bteh\b/gi, 'the')
      .replace(/\brecieve\b/gi, 'receive')
      .replace(/\boccured\b/gi, 'occurred');
  }

  /**
   * Clean up filler words (optional, can be aggressive)
   * @param text Text to clean
   * @param aggressive If true, removes more filler words
   * @returns Cleaned text
   */
  static removeFillerWords(text: string, aggressive: boolean = false): string {
    const basicFillers = /\b(um|uh|er|ah|like|you know)\b/gi;
    const aggressiveFillers = /\b(um|uh|er|ah|like|you know|basically|actually|literally|sort of|kind of)\b/gi;

    const pattern = aggressive ? aggressiveFillers : basicFillers;
    return text.replace(pattern, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Add paragraph breaks based on pauses or topic changes
   * @param text Text to format
   * @param segments Optional segments with timing information
   * @returns Text with paragraph breaks
   */
  static addParagraphBreaks(text: string, segments?: Array<{ text: string; startTime: number; endTime: number }>): string {
    if (!segments || segments.length === 0) {
      // Simple heuristic: break on long sentences
      return text.replace(/([.!?])\s+/g, '$1\n\n');
    }

    // Use timing information to detect pauses
    let result = '';
    for (let i = 0; i < segments.length; i++) {
      result += segments[i].text;
      
      // Add paragraph break if there's a significant pause (>2 seconds)
      if (i < segments.length - 1) {
        const pause = segments[i + 1].startTime - segments[i].endTime;
        if (pause > 2) {
          result += '\n\n';
        } else {
          result += ' ';
        }
      }
    }

    return result.trim();
  }
}
