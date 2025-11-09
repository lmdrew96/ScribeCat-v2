/**
 * SearchFilter Value Object
 *
 * Represents filter criteria for session search.
 * Immutable value object for filtering logic.
 */

export interface DateRange {
  start?: Date;
  end?: Date;
}

export interface DurationRange {
  min?: number; // seconds
  max?: number; // seconds
}

export interface SearchFilterOptions {
  // Basic filters
  courseId?: string;
  tags?: string[];

  // Date filters
  dateRange?: DateRange;

  // Duration filters
  durationRange?: DurationRange;

  // Content filters
  hasTranscription?: boolean;
  hasNotes?: boolean;
  hasSummary?: boolean;

  // Metadata filters
  isMultiSession?: boolean;
  isSynced?: boolean;
}

export class SearchFilter {
  public readonly courseId?: string;
  public readonly tags: string[];
  public readonly dateRange?: DateRange;
  public readonly durationRange?: DurationRange;
  public readonly hasTranscription?: boolean;
  public readonly hasNotes?: boolean;
  public readonly hasSummary?: boolean;
  public readonly isMultiSession?: boolean;
  public readonly isSynced?: boolean;

  constructor(options: SearchFilterOptions = {}) {
    this.courseId = options.courseId;
    this.tags = options.tags || [];
    this.dateRange = options.dateRange;
    this.durationRange = options.durationRange;
    this.hasTranscription = options.hasTranscription;
    this.hasNotes = options.hasNotes;
    this.hasSummary = options.hasSummary;
    this.isMultiSession = options.isMultiSession;
    this.isSynced = options.isSynced;
  }

  /**
   * Check if filter is empty (no criteria set)
   */
  isEmpty(): boolean {
    return (
      !this.courseId &&
      this.tags.length === 0 &&
      !this.dateRange &&
      !this.durationRange &&
      this.hasTranscription === undefined &&
      this.hasNotes === undefined &&
      this.hasSummary === undefined &&
      this.isMultiSession === undefined &&
      this.isSynced === undefined
    );
  }

  /**
   * Create a new filter with updated course
   */
  withCourse(courseId?: string): SearchFilter {
    return new SearchFilter({
      ...this.toOptions(),
      courseId
    });
  }

  /**
   * Create a new filter with updated tags
   */
  withTags(tags: string[]): SearchFilter {
    return new SearchFilter({
      ...this.toOptions(),
      tags
    });
  }

  /**
   * Create a new filter with updated date range
   */
  withDateRange(dateRange?: DateRange): SearchFilter {
    return new SearchFilter({
      ...this.toOptions(),
      dateRange
    });
  }

  /**
   * Create a new filter with updated duration range
   */
  withDurationRange(durationRange?: DurationRange): SearchFilter {
    return new SearchFilter({
      ...this.toOptions(),
      durationRange
    });
  }

  /**
   * Convert to options object
   */
  private toOptions(): SearchFilterOptions {
    return {
      courseId: this.courseId,
      tags: [...this.tags],
      dateRange: this.dateRange,
      durationRange: this.durationRange,
      hasTranscription: this.hasTranscription,
      hasNotes: this.hasNotes,
      hasSummary: this.hasSummary,
      isMultiSession: this.isMultiSession,
      isSynced: this.isSynced
    };
  }

  /**
   * Count active filters
   */
  getActiveFilterCount(): number {
    let count = 0;
    if (this.courseId) count++;
    if (this.tags.length > 0) count++;
    if (this.dateRange) count++;
    if (this.durationRange) count++;
    if (this.hasTranscription !== undefined) count++;
    if (this.hasNotes !== undefined) count++;
    if (this.hasSummary !== undefined) count++;
    if (this.isMultiSession !== undefined) count++;
    if (this.isSynced !== undefined) count++;
    return count;
  }

  /**
   * Create default filter (no criteria)
   */
  static createEmpty(): SearchFilter {
    return new SearchFilter({});
  }
}
