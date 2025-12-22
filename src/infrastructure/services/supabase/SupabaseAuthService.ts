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
    const client = SupabaseClient.getInstance().getClient();
    client.auth.onAuthStateChange((event, session) => {
      const authSession = session ? this.convertToAuthSession(session) : null;
      this.notifyAuthStateListeners(authSession);
    });

    console.log('🔍 Checking for existing Supabase session...');
    client.auth.getSession()
      .then(({ data, error }) => {
        console.log('🔍 getSession() result:', {
          hasData: !!data,
          hasSession: !!data?.session,
          hasError: !!error,
          errorMessage: error?.message
        });

        if (error) {
          console.error('❌ Error getting session:', error);
          return;
        }

        const { session } = data;
        if (session) {
          console.log('✅ Found existing session, user ID:', session.user?.id);
          const authSession = this.convertToAuthSession(session);
          this.notifyAuthStateListeners(authSession);
          console.log('✅ Restored existing Supabase session on startup');
        } else {
          console.log('ℹ️  No existing session found in localStorage');
        }
      })
      .catch(error => {
        console.error('❌ Exception checking for existing session:', error);
      });
  }
  /** Check if client is initialized (always true with singleton) */
  isInitialized(): boolean {
    return true;
  }
  /** Sign in with email and password */
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
  /** Sign up with email and password */
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

      let oauthUrl = data.url;
      if (oauthUrl) {
        const url = new URL(oauthUrl);
        url.searchParams.set('code_challenge', codeChallenge);
        url.searchParams.set('code_challenge_method', 'S256');
        url.searchParams.set('response_type', 'code');
        url.searchParams.delete('response_mode');
        oauthUrl = url.toString();
      }

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
  /** Sign out the current user */
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
  /** Get current user */
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
  /** Get current session */
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
  /** Refresh the current session */
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
  /** Check if user is authenticated */
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return session !== null;
  }
  /** Update user profile */
  async updateProfile(updates: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { error } = await client.auth.updateUser({
        data: {
          full_name: updates.fullName,
          avatar_url: updates.avatarUrl,
          preferences: updates.preferences
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
   * Get user preferences from user_profiles table
   * This fetches preferences stored in the database (not just auth metadata)
   */
  async getUserPreferences(userId: string): Promise<{ success: boolean; data?: Record<string, any>; error?: string }> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { data, error } = await client
        .from('user_profiles')
        .select('preferences')
        .eq('id', userId)
        .single();

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data: data?.preferences || {}
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting preferences'
      };
    }
  }
  /**
   * Update user preferences in user_profiles table
   * This updates preferences stored in the database (not just auth metadata)
   */
  async updateUserPreferences(userId: string, preferences: Record<string, any>): Promise<{ success: boolean; error?: string }> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { error } = await client
        .from('user_profiles')
        .update({ preferences })
        .eq('id', userId);

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
        error: error instanceof Error ? error.message : 'Unknown error updating preferences'
      };
    }
  }
  /** Set a specific preference key in user_profiles table */
  async setUserPreference(userId: string, key: string, value: unknown): Promise<{ success: boolean; error?: string }> {
    try {
      const prefsResult = await this.getUserPreferences(userId);
      if (!prefsResult.success) {
        return prefsResult;
      }

      const preferences = prefsResult.data || {};
      preferences[key] = value;

      return await this.updateUserPreferences(userId, preferences);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error setting preference'
      };
    }
  }
  /** Get a specific preference key from user_profiles table */
  async getUserPreference(userId: string, key: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const prefsResult = await this.getUserPreferences(userId);
      if (!prefsResult.success) {
        return prefsResult;
      }

      const preferences = prefsResult.data || {};
      return {
        success: true,
        data: preferences[key]
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting preference'
      };
    }
  }
  /** Listen for auth state changes */
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void {
    this.authStateListeners.add(callback);

    return () => {
      this.authStateListeners.delete(callback);
    };
  }
  /** Convert Supabase Session to AuthSession */
  private convertToAuthSession(session: Session): AuthSession {
    return {
      user: this.convertToUserProfile(session.user),
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: new Date(session.expires_at! * 1000)
    };
  }
  /** Convert Supabase User to UserProfile */
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
  /** Notify all auth state listeners */
  private notifyAuthStateListeners(session: AuthSession | null): void {
    this.authStateListeners.forEach(listener => {
      try {
        listener(session);
      } catch (error) {
        console.error('Error in auth state listener:', error);
      }
    });
  }
  /** Get the Supabase client (for advanced operations) */
  getClient() {
    return SupabaseClient.getInstance().getClient();
  }
}
