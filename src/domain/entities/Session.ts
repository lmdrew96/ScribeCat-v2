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
 * Sync status for cloud synchronization
 */
export enum SyncStatus {
  NOT_SYNCED = 'not_synced',
  SYNCING = 'syncing',
  SYNCED = 'synced',
  FAILED = 'failed',
  CONFLICT = 'conflict'
}

/**
 * AI tool result record for persistent storage
 */
export interface AIToolResult {
  toolType: 'summary' | 'flashcards' | 'quiz' | 'concept' | 'weak_spots' | 'learn_mode' | 'eli5' | 'study_plan' | 'concept_map';
  data: any; // Flexible structure for each tool's data
  generatedAt: Date;
  regenerationCount: number; // Track how many times this was regenerated
}

/**
 * Session type for distinguishing single sessions from multi-session study sets
 */
export enum SessionType {
  SINGLE = 'single',
  MULTI_SESSION_STUDY_SET = 'multi-session-study-set'
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
    public courseNumber?: string,
    // Cloud sync fields
    public userId?: string,
    public cloudId?: string,
    public syncStatus: SyncStatus = SyncStatus.NOT_SYNCED,
    public lastSyncedAt?: Date,
    // Shared session fields
    public permissionLevel?: 'viewer' | 'editor',
    // Trash/soft delete field
    public deletedAt?: Date,
    // Multi-session study set fields
    public type: SessionType = SessionType.SINGLE,
    public childSessionIds?: string[],
    public sessionOrder?: number,
    // AI-generated summary
    public summary?: string,
    // AI tool results storage
    public aiToolResults: Record<string, AIToolResult> = {}
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
   * Update course information
   */
  updateCourse(courseId?: string, courseTitle?: string, courseNumber?: string): void {
    this.courseId = courseId;
    this.courseTitle = courseTitle;
    this.courseNumber = courseNumber;
    this.updatedAt = new Date();
  }

  /**
   * Update session summary
   */
  updateSummary(summary: string): void {
    this.summary = summary;
    this.updatedAt = new Date();
  }

  /**
   * Save AI tool result
   */
  saveAIToolResult(toolType: AIToolResult['toolType'], data: any): void {
    const existingResult = this.aiToolResults[toolType];

    this.aiToolResults[toolType] = {
      toolType,
      data,
      generatedAt: new Date(),
      regenerationCount: existingResult ? existingResult.regenerationCount + 1 : 0
    };

    this.updatedAt = new Date();
  }

  /**
   * Get AI tool result
   */
  getAIToolResult(toolType: AIToolResult['toolType']): AIToolResult | null {
    return this.aiToolResults[toolType] || null;
  }

  /**
   * Check if AI tool result exists
   */
  hasAIToolResult(toolType: AIToolResult['toolType']): boolean {
    return !!this.aiToolResults[toolType];
  }

  /**
   * Clear AI tool result
   */
  clearAIToolResult(toolType: AIToolResult['toolType']): void {
    delete this.aiToolResults[toolType];
    this.updatedAt = new Date();
  }

  /**
   * Get all AI tool results
   */
  getAllAIToolResults(): Record<string, AIToolResult> {
    return { ...this.aiToolResults };
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
   * Mark session as synced
   */
  markAsSynced(cloudId: string): void {
    this.cloudId = cloudId;
    this.syncStatus = SyncStatus.SYNCED;
    this.lastSyncedAt = new Date();
  }

  /**
   * Mark session as syncing
   */
  markAsSyncing(): void {
    this.syncStatus = SyncStatus.SYNCING;
  }

  /**
   * Mark session as sync failed
   */
  markAsSyncFailed(): void {
    this.syncStatus = SyncStatus.FAILED;
  }

  /**
   * Mark session as not synced
   */
  markAsNotSynced(): void {
    this.syncStatus = SyncStatus.NOT_SYNCED;
  }

  /**
   * Check if session is synced
   */
  isSynced(): boolean {
    return this.syncStatus === SyncStatus.SYNCED;
  }

  /**
   * Check if session needs sync
   */
  needsSync(): boolean {
    if (!this.userId) return false; // Can't sync without user
    if (this.syncStatus === SyncStatus.NOT_SYNCED || this.syncStatus === SyncStatus.FAILED) {
      return true;
    }
    // Check if session was updated after last sync
    if (this.lastSyncedAt && this.updatedAt > this.lastSyncedAt) {
      return true;
    }
    return false;
  }

  /**
   * Check if session is a multi-session study set
   */
  isMultiSessionStudySet(): boolean {
    return this.type === SessionType.MULTI_SESSION_STUDY_SET;
  }

  /**
   * Check if session is a single session
   */
  isSingleSession(): boolean {
    return this.type === SessionType.SINGLE;
  }

  /**
   * Get child session IDs for multi-session study sets
   */
  getChildSessionIds(): string[] {
    return this.childSessionIds || [];
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
      courseNumber: this.courseNumber,
      userId: this.userId,
      cloudId: this.cloudId,
      syncStatus: this.syncStatus,
      lastSyncedAt: this.lastSyncedAt,
      permissionLevel: this.permissionLevel,
      deletedAt: this.deletedAt,
      type: this.type,
      childSessionIds: this.childSessionIds,
      sessionOrder: this.sessionOrder,
      summary: this.summary,
      aiToolResults: this.aiToolResults
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
      data.courseNumber,
      data.userId,
      data.cloudId,
      data.syncStatus || SyncStatus.NOT_SYNCED,
      data.lastSyncedAt ? new Date(data.lastSyncedAt) : undefined,
      data.permissionLevel,
      data.deletedAt ? new Date(data.deletedAt) : undefined,
      data.type || SessionType.SINGLE,
      data.childSessionIds,
      data.sessionOrder,
      data.summary,
      data.aiToolResults || {}
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
  // Cloud sync fields
  userId?: string;
  cloudId?: string;
  syncStatus?: SyncStatus;
  lastSyncedAt?: Date;
  // Shared session fields
  permissionLevel?: 'viewer' | 'editor';
  // Trash/soft delete field
  deletedAt?: Date;
  // Multi-session study set fields
  type?: SessionType;
  childSessionIds?: string[];
  sessionOrder?: number;
  // AI-generated summary
  summary?: string;
  // AI tool results
  aiToolResults?: Record<string, AIToolResult>;
}
