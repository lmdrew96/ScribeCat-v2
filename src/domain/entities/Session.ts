import { Transcription, TranscriptionData } from './Transcription.js';

/**
 * Export record for tracking session exports
 */
export interface ExportRecord {
  format: 'txt' | 'pdf' | 'docx' | 'html';
  path: string;
  exportedAt: Date;
}

/**
 * Session Entity
 * 
 * Represents a recording session with audio file and metadata.
 * Pure business entity with no external dependencies.
 */

export class Session {
  constructor(
    public readonly id: string,
    public title: string,
    public readonly recordingPath: string,
    public notes: string,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public readonly duration: number,
    public transcription?: Transcription,
    public tags: string[] = [],
    public exportHistory: ExportRecord[] = [],
    public courseId?: string,
    public courseTitle?: string,
    public courseNumber?: string
  ) {}

  /**
   * Update session notes
   */
  updateNotes(notes: string): void {
    this.notes = notes;
    this.updatedAt = new Date();
  }

  /**
   * Update session title
   */
  updateTitle(title: string): void {
    this.title = title;
    this.updatedAt = new Date();
  }

  /**
   * Add transcription to session
   */
  addTranscription(transcription: Transcription): void {
    this.transcription = transcription;
    this.updatedAt = new Date();
  }

  /**
   * Add a tag to the session
   */
  addTag(tag: string): void {
    const normalizedTag = tag.trim().toLowerCase();
    if (normalizedTag && !this.tags.includes(normalizedTag)) {
      this.tags.push(normalizedTag);
      this.updatedAt = new Date();
    }
  }

  /**
   * Remove a tag from the session
   */
  removeTag(tag: string): void {
    const normalizedTag = tag.trim().toLowerCase();
    const index = this.tags.indexOf(normalizedTag);
    if (index > -1) {
      this.tags.splice(index, 1);
      this.updatedAt = new Date();
    }
  }

  /**
   * Record an export operation
   */
  recordExport(format: ExportRecord['format'], path: string): void {
    this.exportHistory.push({
      format,
      path,
      exportedAt: new Date()
    });
    this.updatedAt = new Date();
  }

  /**
   * Check if session has transcription
   */
  hasTranscription(): boolean {
    return this.transcription !== undefined;
  }

  /**
   * Get all tags
   */
  getTags(): string[] {
    return [...this.tags];
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): SessionData {
    return {
      id: this.id,
      title: this.title,
      recordingPath: this.recordingPath,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      duration: this.duration,
      transcription: this.transcription?.toJSON(),
      tags: this.tags,
      exportHistory: this.exportHistory,
      courseId: this.courseId,
      courseTitle: this.courseTitle,
      courseNumber: this.courseNumber
    };
  }

  /**
   * Create Session from plain object
   */
  static fromJSON(data: SessionData): Session {
    return new Session(
      data.id,
      data.title,
      data.recordingPath,
      data.notes,
      new Date(data.createdAt),
      new Date(data.updatedAt),
      data.duration,
      data.transcription ? Transcription.fromJSON(data.transcription) : undefined,
      data.tags || [],
      data.exportHistory || [],
      data.courseId,
      data.courseTitle,
      data.courseNumber
    );
  }
}

/**
 * Plain object representation of Session for serialization
 */
export interface SessionData {
  id: string;
  title: string;
  recordingPath: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  duration: number;
  transcription?: TranscriptionData;
  tags?: string[];
  exportHistory?: ExportRecord[];
  courseId?: string;
  courseTitle?: string;
  courseNumber?: string;
}
