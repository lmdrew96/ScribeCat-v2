/**
 * RendererSupabaseClient
 *
 * Renderer-side Supabase client wrapper for OAuth operations.
 * Runs in the renderer process where localStorage and crypto APIs are available.
 *
 * This is the CORRECT architecture for Electron + Supabase:
 * - Renderer process: Handles all Supabase auth operations (has browser APIs)
 * - Main process: Just stores the resulting session for app-wide state
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../../config/supabase.config.js';
import type { AuthResult, UserProfile, AuthSession } from '../../shared/types.js';
import type { Session, User } from '@supabase/supabase-js';

export class RendererSupabaseClient {
  private static instance: RendererSupabaseClient | null = null;
  private client;

  private constructor() {
    // Create Supabase client in renderer where localStorage exists
    this.client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce' // Use PKCE flow - Supabase handles code verifier/challenge automatically
        // Use default localStorage storage (works in renderer)
      }
    });

    // Listen for auth state changes and notify main process for cloud sync
    this.client.auth.onAuthStateChange((event, session) => {
      const userId = session?.user?.id || null;
      const accessToken = session?.access_token;
      const refreshToken = session?.refresh_token;

      // Notify main process so it can update SyncManager and SupabaseClient
      if (window.scribeCat?.auth?.sessionChanged) {
        window.scribeCat.auth.sessionChanged({
          userId,
          accessToken,
          refreshToken
        })
          .catch((error: Error) => {
            console.error('❌ Failed to notify main process:', error);
          });
      }
    });

    // Check for existing session on startup
    this.client.auth.getSession()
      .then(({ data, error }) => {
        if (error) {
          console.error('❌ Error getting session on startup:', error);
          return;
        }

        const userId = data.session?.user?.id || null;
        const accessToken = data.session?.access_token;
        const refreshToken = data.session?.refresh_token;

        if (userId) {
          // Notify main process
          if (window.scribeCat?.auth?.sessionChanged) {
            window.scribeCat.auth.sessionChanged({
              userId,
              accessToken,
              refreshToken
            })
              .catch((error: Error) => {
                console.error('❌ Failed to notify main process:', error);
              });
          }
        } else {
          console.log('ℹ️  No existing session found on startup');
        }
      })
      .catch((error: Error) => {
        console.error('❌ Exception checking for existing session:', error);
      });
  }

  static getInstance(): RendererSupabaseClient {
    if (!RendererSupabaseClient.instance) {
      RendererSupabaseClient.instance = new RendererSupabaseClient();
    }
    return RendererSupabaseClient.instance;
  }

  /**
   * Get the Supabase client for Realtime subscriptions in renderer
   * This client has proper auth context from localStorage
   */
  getClient() {
    return this.client;
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email: string, password: string): Promise<AuthResult> {
    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password
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
  async signUpWithEmail(email: string, password: string, fullName?: string): Promise<AuthResult> {
    try {
      const { data, error } = await this.client.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
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

      // Note: For email sign up, session might be null if email confirmation is required
      return {
        success: true,
        session: data.session ? this.convertToAuthSession(data.session) : undefined,
        user: this.convertToUserProfile(data.user)
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
   * Returns the OAuth URL to open in a browser
   * Note: PKCE code verifier/challenge is handled automatically by Supabase when flowType is 'pkce'
   */
  async signInWithGoogle(): Promise<{ success: boolean; authUrl?: string; error?: string }> {
    try {
      const { data, error } = await this.client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'http://localhost:3000/auth/callback',
          skipBrowserRedirect: true,
          queryParams: {
            // Show account picker - allows user to select account and use passkeys
            prompt: 'select_account'
          }
        }
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      if (!data.url) {
        return {
          success: false,
          error: 'No OAuth URL returned'
        };
      }

      // With flowType: 'pkce', Supabase automatically:
      // 1. Generates code verifier and stores in localStorage
      // 2. Generates code challenge from verifier
      // 3. Adds code_challenge and code_challenge_method to the OAuth URL

      // Debug: Log the OAuth URL and its parameters
      console.log('🔍 OAuth URL generated:', data.url);
      const url = new URL(data.url);
      console.log('🔍 OAuth URL parameters:', Object.fromEntries(url.searchParams));
      console.log('🔍 Check localStorage for PKCE verifier...');

      return {
        success: true,
        authUrl: data.url
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during Google sign in'
      };
    }
  }

  /**
   * Exchange OAuth authorization code for session
   * This runs in the renderer process where localStorage works properly
   * The code verifier is automatically retrieved from localStorage by Supabase
   */
  async exchangeCodeForSession(code: string): Promise<AuthResult> {
    try {
      // Exchange code for session
      // Supabase automatically retrieves the code verifier from localStorage
      // (it was stored when signInWithGoogle was called with flowType: 'pkce')
      const { data, error } = await this.client.auth.exchangeCodeForSession(code);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      if (!data.session || !data.user) {
        return {
          success: false,
          error: 'No session or user returned from OAuth exchange'
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
        error: error instanceof Error ? error.message : 'Unknown error during OAuth exchange'
      };
    }
  }

  /**
   * Sign out the current user
   * This runs in the renderer process where auth state is managed
   */
  async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.client.auth.signOut();

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      // Auth state change listener will automatically notify main process
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during sign out'
      };
    }
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
}
