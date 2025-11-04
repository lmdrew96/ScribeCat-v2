/**
 * SupabaseClient
 *
 * Central Supabase client manager for the application.
 * Provides access to Supabase services and manages initialization.
 *
 * Uses bundled production credentials - all users share the same backend
 * with data isolation provided by Row Level Security (RLS) policies.
 */

import { createClient, SupabaseClient as SupabaseJSClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../../../config/supabase.config.js';

export class SupabaseClient {
  private static instance: SupabaseClient | null = null;
  private client: SupabaseJSClient;
  private accessToken: string | null = null;

  private constructor() {
    // Initialize Supabase client immediately with production config
    this.client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storage: {
          // Custom storage adapter for Electron
          // Note: Supabase will use localStorage by default in renderer process
          // For main process, we'd need a custom adapter
          getItem: (key: string) => {
            if (typeof window !== 'undefined' && window.localStorage) {
              return window.localStorage.getItem(key);
            }
            return null;
          },
          setItem: (key: string, value: string) => {
            if (typeof window !== 'undefined' && window.localStorage) {
              window.localStorage.setItem(key, value);
            }
          },
          removeItem: (key: string) => {
            if (typeof window !== 'undefined' && window.localStorage) {
              window.localStorage.removeItem(key);
            }
          }
        }
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'X-Client-Info': 'scribecat-electron'
        }
      }
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SupabaseClient {
    if (!SupabaseClient.instance) {
      SupabaseClient.instance = new SupabaseClient();
    }
    return SupabaseClient.instance;
  }

  /**
   * Check if client is initialized (always true in production mode)
   */
  isInitialized(): boolean {
    return true;
  }

  /**
   * Get the Supabase client instance
   * If an access token is set, returns a client configured with that token
   */
  getClient(): SupabaseJSClient {
    // If we have an access token, create a client with it in the headers
    if (this.accessToken) {
      return createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
        global: {
          headers: {
            'X-Client-Info': 'scribecat-electron',
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      });
    }
    return this.client;
  }

  /**
   * Get current configuration
   */
  getConfig(): { url: string; anonKey: string } {
    return SUPABASE_CONFIG;
  }

  /**
   * Set user session for authenticated requests
   * This allows the main process to make authenticated requests to Supabase
   * Stores the access token to be used with subsequent requests
   */
  async setSession(accessToken: string, refreshToken: string): Promise<void> {
    this.accessToken = accessToken;
    console.log('✅ SupabaseClient: Access token stored for authenticated requests');
    await this.client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
  }

  /**
   * Clear the current session
   */
  async clearSession(): Promise<void> {
    this.accessToken = null;
    console.log('✅ SupabaseClient: Access token cleared');
    await this.client.auth.signOut();
  }

  /**
   * Test connection to Supabase
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      // Try to query the user_profiles table (or any simple query)
      const { error } = await this.client.from('user_profiles').select('count').limit(1);

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
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
