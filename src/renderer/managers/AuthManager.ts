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
    // Initialize RendererSupabaseClient to set up auth state listener
    // This ensures auth state changes are monitored and sent to main process for cloud sync
    const { RendererSupabaseClient } = await import('../services/RendererSupabaseClient.js');
    RendererSupabaseClient.getInstance(); // Initialize the singleton

    await this.checkAuthStatus();
  }

  /**
   * Check authentication status
   * Uses RendererSupabaseClient directly since auth is handled in renderer
   */
  async checkAuthStatus(): Promise<boolean> {
    try {
      // Import and use RendererSupabaseClient directly
      const { RendererSupabaseClient } = await import('../services/RendererSupabaseClient.js');
      const client = RendererSupabaseClient.getInstance();

      // Get session from Supabase client
      const { data: { session }, error } = await (client as any).client.auth.getSession();

      if (error) {
        console.error('Error checking auth status:', error);
        this.currentUser = null;
        this.notifyListeners();
        return false;
      }

      if (session && session.user) {
        // Convert Supabase user to UserProfile
        this.currentUser = {
          id: session.user.id,
          email: session.user.email!,
          fullName: session.user.user_metadata?.full_name || session.user.user_metadata?.name || undefined,
          avatarUrl: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || undefined,
          googleId: session.user.app_metadata?.provider === 'google' ? session.user.id : undefined,
          createdAt: new Date(session.user.created_at),
          updatedAt: new Date(session.user.updated_at || session.user.created_at),
          preferences: session.user.user_metadata?.preferences || {}
        };
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
   * Uses RendererSupabaseClient directly since auth is handled in renderer
   */
  async signInWithEmail(email: string, password: string): Promise<AuthResult> {
    try {
      // Import and use RendererSupabaseClient directly
      const { RendererSupabaseClient } = await import('../services/RendererSupabaseClient.js');
      const result = await RendererSupabaseClient.getInstance().signInWithEmail(email, password);

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
   * Uses RendererSupabaseClient directly since auth is handled in renderer
   */
  async signUpWithEmail(email: string, password: string, fullName?: string): Promise<AuthResult> {
    try {
      // Import and use RendererSupabaseClient directly
      const { RendererSupabaseClient } = await import('../services/RendererSupabaseClient.js');
      const result = await RendererSupabaseClient.getInstance().signUpWithEmail(email, password, fullName);

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
   * Uses RendererSupabaseClient directly since auth is handled in renderer
   * PKCE flow is handled automatically by Supabase
   */
  async signInWithGoogle(): Promise<{ success: boolean; authUrl?: string; error?: string }> {
    try {
      // Import and use RendererSupabaseClient directly
      const { RendererSupabaseClient } = await import('../services/RendererSupabaseClient.js');
      const result = await RendererSupabaseClient.getInstance().signInWithGoogle();

      return result;
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

        // Note: Main process is automatically notified via RendererSupabaseClient's
        // auth state change listener (sessionChanged IPC call)
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
   * Uses RendererSupabaseClient directly since auth is handled in renderer
   */
  async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      // Import and use RendererSupabaseClient directly
      const { RendererSupabaseClient } = await import('../services/RendererSupabaseClient.js');
      const result = await RendererSupabaseClient.getInstance().signOut();

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
