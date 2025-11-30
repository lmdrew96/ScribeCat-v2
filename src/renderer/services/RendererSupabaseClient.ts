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
  async signUpWithEmail(email: string, password: string, username: string, fullName?: string): Promise<AuthResult> {
    try {
      const { data, error } = await this.client.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
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
   * Update user profile (full name)
   * This runs in the renderer process where the auth session is properly maintained
   */
  async updateProfile(fullName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.client.auth.updateUser({
        data: {
          full_name: fullName
        }
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      // Auth state change listener will automatically notify main process with updated user
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error updating profile'
      };
    }
  }

  /**
   * Set username for existing user
   * This runs in the renderer process where the auth session is properly maintained
   */
  async setUsername(username: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate username format
      const usernameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,19}$/;
      if (!usernameRegex.test(username)) {
        return {
          success: false,
          error: 'Invalid username format'
        };
      }

      // Check if username is available
      const { data: isAvailable, error: availabilityError } = await this.client.rpc('is_username_available', {
        check_username: username
      });

      if (availabilityError) {
        return {
          success: false,
          error: 'Failed to check username availability'
        };
      }

      if (!isAvailable) {
        return {
          success: false,
          error: 'Username is already taken or reserved'
        };
      }

      // Get current user
      const { data: { user }, error: userError } = await this.client.auth.getUser();

      if (userError || !user) {
        return {
          success: false,
          error: 'Not authenticated'
        };
      }

      // Update user metadata with username
      const { error: updateError } = await this.client.auth.updateUser({
        data: {
          username: username
        }
      });

      if (updateError) {
        return {
          success: false,
          error: updateError.message
        };
      }

      // Update user_profiles table directly (in case trigger doesn't fire immediately)
      const { error: profileError } = await this.client
        .from('user_profiles')
        .update({ username: username })
        .eq('id', user.id);

      if (profileError) {
        console.error('Error updating user profile:', profileError);
        // Don't fail completely if profile update fails - metadata is source of truth
        console.warn('Username set in metadata but profile update failed');
      }

      // Auth state change listener will automatically notify main process with updated user
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error setting username'
      };
    }
  }

  /**
   * Send password reset email
   * This runs in the renderer process where auth context exists
   */
  async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.client.auth.resetPasswordForEmail(email, {
        redirectTo: 'http://localhost:3000/auth/reset-password'
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
        error: error instanceof Error ? error.message : 'Unknown error sending password reset email'
      };
    }
  }

  /**
   * Delete user account
   * Note: Supabase doesn't allow client-side account deletion via the API for security reasons.
   * This method signs the user out and returns a message to contact support.
   */
  async deleteAccount(): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      // Sign out the user
      const { error } = await this.client.auth.signOut();

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        message: 'Account deletion initiated. Your account has been signed out. Please contact support to complete account deletion.'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during account deletion'
      };
    }
  }

  /**
   * Upload avatar image to Supabase Storage
   * @param blob - Compressed image blob
   * @param mimeType - MIME type of the image (e.g., 'image/jpeg')
   */
  async uploadAvatar(blob: Blob, mimeType: string = 'image/jpeg'): Promise<{ success: boolean; avatarUrl?: string; error?: string }> {
    try {
      // Get current user
      const { data: { user }, error: userError } = await this.client.auth.getUser();

      if (userError || !user) {
        return {
          success: false,
          error: 'Not authenticated'
        };
      }

      // Determine file extension from MIME type
      const extMap: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif'
      };
      const extension = extMap[mimeType] || 'jpg';
      const storagePath = `${user.id}/avatar.${extension}`;

      // Upload to storage bucket
      const { error: uploadError } = await this.client.storage
        .from('avatars')
        .upload(storagePath, blob, {
          contentType: mimeType,
          upsert: true,
          cacheControl: '3600'
        });

      if (uploadError) {
        console.error('Avatar upload error:', uploadError);
        return {
          success: false,
          error: uploadError.message
        };
      }

      // Get public URL
      const { data: urlData } = this.client.storage
        .from('avatars')
        .getPublicUrl(storagePath);

      // Add cache-busting timestamp to prevent stale avatars
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update user metadata with new avatar URL
      const { error: updateError } = await this.client.auth.updateUser({
        data: {
          avatar_url: avatarUrl
        }
      });

      if (updateError) {
        console.error('Error updating user metadata with avatar:', updateError);
        return {
          success: false,
          error: updateError.message
        };
      }

      return {
        success: true,
        avatarUrl
      };
    } catch (error) {
      console.error('Avatar upload exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error uploading avatar'
      };
    }
  }

  /**
   * Remove avatar image from Supabase Storage and clear user metadata
   */
  async removeAvatar(): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current user
      const { data: { user }, error: userError } = await this.client.auth.getUser();

      if (userError || !user) {
        return {
          success: false,
          error: 'Not authenticated'
        };
      }

      // List and delete all files in user's avatar folder
      const { data: files, error: listError } = await this.client.storage
        .from('avatars')
        .list(user.id);

      if (listError) {
        console.error('Error listing avatar files:', listError);
        // Continue anyway - might not have uploaded an avatar yet
      }

      if (files && files.length > 0) {
        const filePaths = files.map(f => `${user.id}/${f.name}`);
        const { error: deleteError } = await this.client.storage
          .from('avatars')
          .remove(filePaths);

        if (deleteError) {
          console.error('Error deleting avatar files:', deleteError);
          // Continue anyway - clear metadata regardless
        }
      }

      // Clear avatar URL from user metadata
      const { error: updateError } = await this.client.auth.updateUser({
        data: {
          avatar_url: null
        }
      });

      if (updateError) {
        return {
          success: false,
          error: updateError.message
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error removing avatar'
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
      username: user.user_metadata?.username || undefined,
      fullName: user.user_metadata?.full_name || user.user_metadata?.name || undefined,
      avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || undefined,
      googleId: user.app_metadata?.provider === 'google' ? user.id : undefined,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at || user.created_at),
      preferences: user.user_metadata?.preferences || {}
    };
  }
}
