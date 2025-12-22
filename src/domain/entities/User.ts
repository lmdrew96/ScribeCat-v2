/**
 * User Entity
 *
 * Represents a user account in the system.
 * Pure business entity with no external dependencies.
 */

/**
 * User preference value - can be string, number, boolean, or nested object
 */
export type UserPreferenceValue = string | number | boolean | null | UserPreferenceValue[] | { [key: string]: UserPreferenceValue };

export interface UserData {
  id: string;
  email: string;
  username?: string; // Optional for existing users who haven't set it yet
  fullName?: string;
  avatarUrl?: string;
  googleId?: string;
  createdAt: Date;
  updatedAt: Date;
  preferences: Record<string, UserPreferenceValue>;
}

export class User {
  constructor(
    public readonly id: string,
    public email: string,
    public username: string | undefined,
    public fullName: string | undefined,
    public avatarUrl: string | undefined,
    public readonly googleId: string | undefined,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public preferences: Record<string, UserPreferenceValue> = {}
  ) {}

  /**
   * Update user's full name
   */
  updateFullName(fullName: string): void {
    this.fullName = fullName;
    this.updatedAt = new Date();
  }

  /**
   * Update user's avatar URL
   */
  updateAvatar(avatarUrl: string): void {
    this.avatarUrl = avatarUrl;
    this.updatedAt = new Date();
  }

  /**
   * Update user's email
   */
  updateEmail(email: string): void {
    if (!this.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }
    this.email = email;
    this.updatedAt = new Date();
  }

  /**
   * Update user's username
   */
  updateUsername(username: string): void {
    this.username = username;
    this.updatedAt = new Date();
  }

  /**
   * Set a user preference
   */
  setPreference(key: string, value: UserPreferenceValue): void {
    this.preferences[key] = value;
    this.updatedAt = new Date();
  }

  /**
   * Get a user preference
   */
  getPreference<T extends UserPreferenceValue>(key: string, defaultValue?: T): T | undefined {
    return this.preferences[key] !== undefined ? (this.preferences[key] as T) : defaultValue;
  }

  /**
   * Remove a user preference
   */
  removePreference(key: string): void {
    delete this.preferences[key];
    this.updatedAt = new Date();
  }

  /**
   * Check if user is authenticated via Google
   */
  isGoogleUser(): boolean {
    return this.googleId !== undefined;
  }

  /**
   * Get display name (returns @username, or email if no username)
   */
  getDisplayName(): string {
    if (this.username) {
      return `@${this.username}`;
    }
    // Fallback for users without username (existing users)
    return this.email.split('@')[0];
  }

  /**
   * Get full display name with optional full name
   * Returns: @username (Full Name), @username, or email-based display
   */
  getFullDisplayName(): string {
    if (this.username) {
      if (this.fullName && this.fullName.trim()) {
        return `@${this.username} (${this.fullName})`;
      }
      return `@${this.username}`;
    }
    // Fallback for users without username
    return this.fullName || this.email.split('@')[0];
  }

  /**
   * Get user initials for avatar
   */
  getInitials(): string {
    if (this.fullName) {
      const parts = this.fullName.split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return this.fullName.substring(0, 2).toUpperCase();
    }
    // Fallback to first two characters of username, or email if no username
    if (this.username) {
      return this.username.substring(0, 2).toUpperCase();
    }
    return this.email.substring(0, 2).toUpperCase();
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): UserData {
    return {
      id: this.id,
      email: this.email,
      username: this.username,
      fullName: this.fullName,
      avatarUrl: this.avatarUrl,
      googleId: this.googleId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      preferences: { ...this.preferences }
    };
  }

  /**
   * Create User from plain object
   */
  static fromJSON(data: UserData): User {
    return new User(
      data.id,
      data.email,
      data.username,
      data.fullName,
      data.avatarUrl,
      data.googleId,
      new Date(data.createdAt),
      new Date(data.updatedAt),
      data.preferences || {}
    );
  }
}
