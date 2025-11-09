/**
 * SearchQuery Value Object
 *
 * Represents a user's search query with parsed components.
 * Immutable value object with validation.
 */

export class SearchQuery {
  public readonly rawQuery: string;
  public readonly normalizedQuery: string;
  public readonly tokens: string[];

  constructor(query: string) {
    this.rawQuery = query;
    this.normalizedQuery = this.normalize(query);
    this.tokens = this.tokenize(this.normalizedQuery);
  }

  /**
   * Normalize query (trim, lowercase)
   */
  private normalize(query: string): string {
    return query.trim().toLowerCase();
  }

  /**
   * Tokenize query into searchable terms
   */
  private tokenize(query: string): string[] {
    // Split on whitespace and punctuation, filter empty strings
    return query
      .split(/[\s,;]+/)
      .filter(token => token.length > 0);
  }

  /**
   * Check if query is empty
   */
  isEmpty(): boolean {
    return this.normalizedQuery.length === 0;
  }

  /**
   * Check if query matches a string (case-insensitive)
   */
  matches(text: string): boolean {
    if (!text) return false;

    const normalizedText = text.toLowerCase();

    // Check if the full query exists in the text
    if (normalizedText.includes(this.normalizedQuery)) {
      return true;
    }

    // Check if all tokens exist in the text (AND logic)
    return this.tokens.every(token => normalizedText.includes(token));
  }

  /**
   * Get highlighted version of text with query matches
   */
  highlightIn(text: string): string {
    if (this.isEmpty() || !text) return text;

    let result = text;
    const regex = new RegExp(`(${this.normalizedQuery})`, 'gi');
    result = result.replace(regex, '<mark>$1</mark>');

    return result;
  }

  /**
   * Check equality with another SearchQuery
   */
  equals(other: SearchQuery): boolean {
    return this.normalizedQuery === other.normalizedQuery;
  }
}
