/**
 * SupabaseAuthService
 *
 * Implementation of authentication using Supabase Auth.
 * Handles Google OAuth, email/password auth, and session management.
 *
 * Uses the SupabaseClient singleton with production credentials.
 */

import { Session, User } from '@supabase/supabase-js';
import { SupabaseClient } from './SupabaseClient.js';
import { ISupabaseAuthService } from '../../../domain/services/ISupabaseAuthService.js';
import {
  AuthResult,
  SignInWithEmailParams,
  SignUpWithEmailParams,
  UserProfile,
  AuthSession
} from '../../../shared/types.js';

export class SupabaseAuthService implements ISupabaseAuthService {
  private authStateListeners: Set<(session: AuthSession | null) => void> = new Set();

  constructor() {
    // Set up auth state listener using the singleton client
    const client = SupabaseClient.getInstance().getClient();
    client.auth.onAuthStateChange((event, session) => {
      const authSession = session ? this.convertToAuthSession(session) : null;
      this.notifyAuthStateListeners(authSession);
    });
  }

  /**
   * Check if client is initialized (always true with singleton)
   */
  isInitialized(): boolean {
    return true;
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(params: SignInWithEmailParams): Promise<AuthResult> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { data, error } = await client.auth.signInWithPassword({
        email: params.email,
        password: params.password
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      if (!data.session || !data.user) {
        return {
          success: false,
          error: 'No session or user returned from sign in'
        };
      }

      return {
        success: true,
        session: this.convertToAuthSession(data.session),
        user: this.convertToUserProfile(data.user)
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during sign in'
      };
    }
  }

  /**
   * Sign up with email and password
   */
  async signUpWithEmail(params: SignUpWithEmailParams): Promise<AuthResult> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { data, error } = await client.auth.signUp({
        email: params.email,
        password: params.password,
        options: {
          data: {
            full_name: params.fullName || ''
          }
        }
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      if (!data.user) {
        return {
          success: false,
          error: 'No user returned from sign up'
        };
      }

      return {
        success: true,
        user: this.convertToUserProfile(data.user),
        session: data.session ? this.convertToAuthSession(data.session) : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during sign up'
      };
    }
  }

  /**
   * Sign in with Google OAuth
   * Returns the OAuth URL to open in browser
   * @param codeChallenge PKCE code challenge generated in renderer process
   */
  async signInWithGoogle(codeChallenge: string): Promise<AuthResult> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'http://localhost:3000/auth/callback',
          skipBrowserRedirect: true,
          queryParams: {
            // Force authorization code flow instead of implicit flow
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      // Manually append PKCE parameters and force authorization code flow
      let oauthUrl = data.url;
      if (oauthUrl) {
        const url = new URL(oauthUrl);
        // Add PKCE parameters (code challenge from renderer)
        url.searchParams.set('code_challenge', codeChallenge);
        url.searchParams.set('code_challenge_method', 'S256');
        // Force authorization code flow (not implicit flow)
        url.searchParams.set('response_type', 'code');
        // Remove implicit flow response types if present
        url.searchParams.delete('response_mode');
        oauthUrl = url.toString();
      }

      // For Electron apps, we need to return the URL to open in external browser
      return {
        success: true,
        error: oauthUrl || undefined // Return the OAuth URL with PKCE challenge
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during Google sign in'
      };
    }
  }

  // NOTE: OAuth callback is now handled in renderer process using RendererSupabaseClient
  // This method has been removed - renderer exchanges code directly where localStorage works

  /**
   * Sign out the current user
   */
  async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { error } = await client.auth.signOut();

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during sign out'
      };
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<UserProfile | null> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { data: { user }, error } = await client.auth.getUser();

      if (error || !user) {
        return null;
      }

      return this.convertToUserProfile(user);
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Get current session
   */
  async getSession(): Promise<AuthSession | null> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { data: { session }, error } = await client.auth.getSession();

      if (error || !session) {
        return null;
      }

      return this.convertToAuthSession(session);
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  /**
   * Refresh the current session
   */
  async refreshSession(): Promise<AuthResult> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { data, error } = await client.auth.refreshSession();

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      if (!data.session || !data.user) {
        return {
          success: false,
          error: 'No session or user returned from refresh'
        };
      }

      return {
        success: true,
        session: this.convertToAuthSession(data.session),
        user: this.convertToUserProfile(data.user)
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error refreshing session'
      };
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return session !== null;
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { error } = await client.auth.updateUser({
        data: {
          full_name: updates.fullName,
          avatar_url: updates.avatarUrl,
          ...updates.preferences
        }
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error updating profile'
      };
    }
  }

  /**
   * Listen for auth state changes
   */
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void {
    this.authStateListeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.authStateListeners.delete(callback);
    };
  }

  /**
   * Convert Supabase Session to AuthSession
   */
  private convertToAuthSession(session: Session): AuthSession {
    return {
      user: this.convertToUserProfile(session.user),
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: new Date(session.expires_at! * 1000)
    };
  }

  /**
   * Convert Supabase User to UserProfile
   */
  private convertToUserProfile(user: User): UserProfile {
    return {
      id: user.id,
      email: user.email!,
      fullName: user.user_metadata?.full_name || user.user_metadata?.name || undefined,
      avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || undefined,
      googleId: user.app_metadata?.provider === 'google' ? user.id : undefined,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at || user.created_at),
      preferences: user.user_metadata?.preferences || {}
    };
  }

  /**
   * Notify all auth state listeners
   */
  private notifyAuthStateListeners(session: AuthSession | null): void {
    this.authStateListeners.forEach(listener => {
      try {
        listener(session);
      } catch (error) {
        console.error('Error in auth state listener:', error);
      }
    });
  }

  /**
   * Get the Supabase client (for advanced operations)
   */
  getClient() {
    return SupabaseClient.getInstance().getClient();
  }
}
