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
        detectSessionInUrl: false
        // Use default localStorage storage (works in renderer)
      }
    });

    // Listen for auth state changes and notify main process for cloud sync
    this.client.auth.onAuthStateChange((event, session) => {
      const userId = session?.user?.id || null;
      const accessToken = session?.access_token;
      const refreshToken = session?.refresh_token;

      console.log('🔐 Auth state changed in renderer:', event, userId ? `User ID: ${userId}` : 'No user');

      // Notify main process so it can update SyncManager and SupabaseClient
      if (window.scribeCat?.auth?.sessionChanged) {
        window.scribeCat.auth.sessionChanged({
          userId,
          accessToken,
          refreshToken
        })
          .then(() => {
            console.log('✅ Notified main process of auth state change');
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
          console.log('✅ Found existing session on startup, user ID:', userId);
          // Notify main process
          if (window.scribeCat?.auth?.sessionChanged) {
            window.scribeCat.auth.sessionChanged({
              userId,
              accessToken,
              refreshToken
            })
              .then(() => {
                console.log('✅ Notified main process of existing session');
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
   * Exchange OAuth authorization code for session
   * This runs in the renderer process where localStorage works properly
   */
  async exchangeCodeForSession(code: string): Promise<AuthResult> {
    try {
      // Retrieve code verifier from localStorage (stored by AuthScreen)
      const projectRef = 'djlvwxmakxaffdqbuwkv';
      const storageKey = `sb-${projectRef}-auth-token-code-verifier`;
      const codeVerifier = localStorage.getItem(storageKey);

      if (!codeVerifier) {
        return {
          success: false,
          error: 'Code verifier not found. Please try signing in again.'
        };
      }

      // Store code verifier in the format Supabase expects
      // Supabase client will automatically retrieve it during exchange
      localStorage.setItem(storageKey, codeVerifier);

      // Exchange code for session
      const { data, error } = await this.client.auth.exchangeCodeForSession(code);

      // Clean up code verifier
      localStorage.removeItem(storageKey);

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
