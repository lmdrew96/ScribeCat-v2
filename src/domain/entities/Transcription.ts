/**
 * Transcription Value Object
 * 
 * Represents a transcription with segments and metadata.
 * Immutable value object for transcription data.
 */

export interface TranscriptionSegment {
  text: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  confidence?: number; // 0-1 confidence score
}

export class Transcription {
  constructor(
    public readonly fullText: string,
    public readonly segments: TranscriptionSegment[],
    public readonly language: string,
    public readonly provider: 'assemblyai',
    public readonly createdAt: Date,
    public readonly averageConfidence?: number
  ) {
    this.validate();
  }

  /**
   * Validate transcription data
   */
  private validate(): void {
    if (!this.fullText || this.fullText.trim().length === 0) {
      throw new Error('Transcription text cannot be empty');
    }

    if (!this.segments || this.segments.length === 0) {
      throw new Error('Transcription must have at least one segment');
    }

    // Validate segments are in chronological order
    for (let i = 1; i < this.segments.length; i++) {
      if (this.segments[i].startTime < this.segments[i - 1].endTime) {
        throw new Error('Transcription segments must be in chronological order');
      }
    }

    if (this.averageConfidence !== undefined && 
        (this.averageConfidence < 0 || this.averageConfidence > 1)) {
      throw new Error('Average confidence must be between 0 and 1');
    }
  }

  /**
   * Get transcription text for a specific time range
   */
  getTextForTimeRange(startTime: number, endTime: number): string {
    return this.segments
      .filter(segment => 
        segment.startTime >= startTime && segment.endTime <= endTime
      )
      .map(segment => segment.text)
      .join(' ');
  }

  /**
   * Get total duration of transcription
   */
  getDuration(): number {
    if (this.segments.length === 0) return 0;
    const lastSegment = this.segments[this.segments.length - 1];
    return lastSegment.endTime;
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): TranscriptionData {
    return {
      fullText: this.fullText,
      segments: this.segments,
      language: this.language,
      provider: this.provider,
      createdAt: this.createdAt,
      averageConfidence: this.averageConfidence
    };
  }

  /**
   * Create Transcription from plain object
   */
  static fromJSON(data: TranscriptionData): Transcription {
    return new Transcription(
      data.fullText,
      data.segments,
      data.language,
      data.provider,
      new Date(data.createdAt),
      data.averageConfidence
    );
  }
}

/**
 * Plain object representation of Transcription for serialization
 */
export interface TranscriptionData {
  fullText: string;
  segments: TranscriptionSegment[];
  language: string;
  provider: 'assemblyai';
  createdAt: Date;
  averageConfidence?: number;
}
