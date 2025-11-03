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
   */
  getClient(): SupabaseJSClient {
    return this.client;
  }

  /**
   * Get current configuration
   */
  getConfig(): { url: string; anonKey: string } {
    return SUPABASE_CONFIG;
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
