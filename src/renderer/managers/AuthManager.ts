/**
 * AuthManager
 *
 * Manages user authentication state and operations in the renderer process.
 */

interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  googleId?: string;
  createdAt: Date;
  updatedAt: Date;
  preferences?: Record<string, any>;
}

interface AuthResult {
  success: boolean;
  session?: any;
  user?: UserProfile;
  error?: string;
}

export class AuthManager {
  private currentUser: UserProfile | null = null;
  private authStateListeners: Set<(user: UserProfile | null) => void> = new Set();

  constructor() {
    // Check auth status on initialization
    this.checkAuthStatus();
  }

  /**
   * Initialize the auth manager
   */
  async initialize(): Promise<void> {
    await this.checkAuthStatus();
  }

  /**
   * Check authentication status
   */
  async checkAuthStatus(): Promise<boolean> {
    try {
      const result = await (window as any).scribeCat.auth.isAuthenticated();
      const isAuthenticated = result.isAuthenticated || false;

      if (isAuthenticated) {
        const userResult = await (window as any).scribeCat.auth.getCurrentUser();
        this.currentUser = userResult.user || null;
        this.notifyListeners();
        return true;
      } else {
        this.currentUser = null;
        this.notifyListeners();
        return false;
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      this.currentUser = null;
      this.notifyListeners();
      return false;
    }
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email: string, password: string): Promise<AuthResult> {
    try {
      const result = await (window as any).scribeCat.auth.signInWithEmail({ email, password });

      if (result.success && result.user) {
        this.currentUser = result.user;
        this.notifyListeners();
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Sign up with email and password
   */
  async signUpWithEmail(email: string, password: string, fullName?: string): Promise<AuthResult> {
    try {
      const result = await (window as any).scribeCat.auth.signUpWithEmail({
        email,
        password,
        fullName
      });

      if (result.success && result.user) {
        this.currentUser = result.user;
        this.notifyListeners();
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Sign in with Google OAuth
   */
  async signInWithGoogle(codeChallenge: string): Promise<{ success: boolean; authUrl?: string; error?: string }> {
    try {
      const result = await (window as any).scribeCat.auth.signInWithGoogle(codeChallenge);

      if (result.success && result.error) {
        // The OAuth URL is returned in the error field (a bit confusing but that's how it works)
        const authUrl = result.error;
        return {
          success: true,
          authUrl
        };
      }

      return {
        success: false,
        error: result.error || 'Failed to get OAuth URL'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle OAuth callback - exchanges code for session in renderer process
   * This is the correct architecture: OAuth exchange happens where localStorage exists
   */
  async handleOAuthCallback(code: string): Promise<AuthResult> {
    try {
      // Import the renderer client dynamically to avoid circular dependencies
      const { RendererSupabaseClient } = await import('../services/RendererSupabaseClient.js');

      // Exchange code for session directly in renderer (where localStorage works)
      const result = await RendererSupabaseClient.getInstance().exchangeCodeForSession(code);

      if (result.success && result.user) {
        this.currentUser = result.user;
        this.notifyListeners();

        // Notify main process about successful auth (optional - for app-wide state)
        await (window as any).scribeCat.auth.getCurrentUser();
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during OAuth exchange'
      };
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await (window as any).scribeCat.auth.signOut();

      if (result.success) {
        this.currentUser = null;
        this.notifyListeners();
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  /**
   * Get user display name
   */
  getUserDisplayName(): string {
    if (!this.currentUser) return 'Guest';
    return this.currentUser.fullName || this.currentUser.email.split('@')[0];
  }

  /**
   * Get user initials for avatar
   */
  getUserInitials(): string {
    if (!this.currentUser) return '?';

    if (this.currentUser.fullName) {
      const parts = this.currentUser.fullName.split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return this.currentUser.fullName.substring(0, 2).toUpperCase();
    }

    return this.currentUser.email.substring(0, 2).toUpperCase();
  }

  /**
   * Listen for auth state changes
   */
  onAuthStateChange(listener: (user: UserProfile | null) => void): () => void {
    this.authStateListeners.add(listener);

    // Immediately call with current state
    listener(this.currentUser);

    // Return unsubscribe function
    return () => {
      this.authStateListeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of auth state change
   */
  private notifyListeners(): void {
    this.authStateListeners.forEach(listener => {
      try {
        listener(this.currentUser);
      } catch (error) {
        console.error('Error in auth state listener:', error);
      }
    });
  }
}
