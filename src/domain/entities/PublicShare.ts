/**
 * PublicShare Entity
 *
 * Represents a public sharing link for a session.
 * Allows anyone with the link to view the session (read-only).
 */

/**
 * Database row format for PublicShare
 */
export interface PublicShareDatabaseRow {
  id: string;
  session_id: string;
  created_by_user_id: string;
  token: string;
  password_hash: string | null;
  expires_at: string | null;
  view_count: number;
  max_views: number | null;
  created_at: string;
  last_accessed_at: string | null;
}

/**
 * Database output format for PublicShare
 */
export interface PublicShareDatabaseFormat {
  id: string;
  session_id: string;
  created_by_user_id: string;
  token: string;
  password_hash: string | null;
  expires_at?: string;
  view_count: number;
  max_views: number | null;
  created_at: string;
  last_accessed_at?: string;
}

export class PublicShare {
  constructor(
    public readonly id: string,
    public readonly sessionId: string,
    public readonly createdByUserId: string,
    public readonly token: string,
    public readonly passwordHash: string | null,
    public readonly expiresAt: Date | null,
    public readonly viewCount: number,
    public readonly maxViews: number | null,
    public readonly createdAt: Date,
    public readonly lastAccessedAt: Date | null
  ) {}

  /**
   * Check if the share is expired
   */
  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  /**
   * Check if the share has reached max views
   */
  hasReachedMaxViews(): boolean {
    if (this.maxViews === null) return false;
    return this.viewCount >= this.maxViews;
  }

  /**
   * Check if the share is accessible
   */
  isAccessible(): boolean {
    return !this.isExpired() && !this.hasReachedMaxViews();
  }

  /**
   * Check if the share is password protected
   */
  isPasswordProtected(): boolean {
    return this.passwordHash !== null;
  }

  /**
   * Get the public URL for this share
   */
  getPublicUrl(baseUrl: string = 'https://scribecat.app'): string {
    return `${baseUrl}/share/${this.token}`;
  }

  /**
   * Get share status description
   */
  getStatusDescription(): string {
    if (this.isExpired()) {
      return 'Expired';
    }
    if (this.hasReachedMaxViews()) {
      return 'Max views reached';
    }
    if (this.expiresAt) {
      const daysUntilExpiry = Math.ceil(
        (this.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return `Expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`;
    }
    return 'Active';
  }

  /**
   * Create from database row
   */
  static fromDatabase(row: PublicShareDatabaseRow): PublicShare {
    return new PublicShare(
      row.id,
      row.session_id,
      row.created_by_user_id,
      row.token,
      row.password_hash,
      row.expires_at ? new Date(row.expires_at) : null,
      row.view_count || 0,
      row.max_views,
      new Date(row.created_at),
      row.last_accessed_at ? new Date(row.last_accessed_at) : null
    );
  }

  /**
   * Convert to database format
   */
  toDatabase(): PublicShareDatabaseFormat {
    return {
      id: this.id,
      session_id: this.sessionId,
      created_by_user_id: this.createdByUserId,
      token: this.token,
      password_hash: this.passwordHash,
      expires_at: this.expiresAt?.toISOString(),
      view_count: this.viewCount,
      max_views: this.maxViews,
      created_at: this.createdAt.toISOString(),
      last_accessed_at: this.lastAccessedAt?.toISOString()
    };
  }
}

/**
 * Options for creating a public share
 */
export interface PublicShareOptions {
  password?: string; // Plain text password (will be hashed)
  expiresInDays?: number; // Number of days until expiration
  maxViews?: number; // Maximum number of views
}
