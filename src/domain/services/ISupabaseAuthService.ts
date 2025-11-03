/**
 * ISupabaseAuthService Interface
 *
 * Contract for Supabase authentication service.
 * Handles user sign-in, sign-up, session management, and OAuth.
 */

import {
  AuthResult,
  SignInWithEmailParams,
  SignUpWithEmailParams,
  UserProfile,
  AuthSession
} from '../../shared/types.js';

export interface ISupabaseAuthService {
  /**
   * Check if Supabase is configured and initialized (always true in production)
   */
  isInitialized(): boolean;

  /**
   * Sign in with email and password
   */
  signInWithEmail(params: SignInWithEmailParams): Promise<AuthResult>;

  /**
   * Sign up with email and password
   */
  signUpWithEmail(params: SignUpWithEmailParams): Promise<AuthResult>;

  /**
   * Sign in with Google OAuth
   * @param codeChallenge PKCE code challenge
   * @returns OAuth URL to open in browser
   */
  signInWithGoogle(codeChallenge: string): Promise<AuthResult>;

  // NOTE: OAuth callback is now handled in renderer process using RendererSupabaseClient
  // No handleOAuthCallback method in this interface - renderer handles it directly

  /**
   * Sign out the current user
   */
  signOut(): Promise<{ success: boolean; error?: string }>;

  /**
   * Get the current authenticated user
   */
  getCurrentUser(): Promise<UserProfile | null>;

  /**
   * Get the current session
   */
  getSession(): Promise<AuthSession | null>;

  /**
   * Refresh the current session
   */
  refreshSession(): Promise<AuthResult>;

  /**
   * Check if user is currently authenticated
   */
  isAuthenticated(): Promise<boolean>;

  /**
   * Update user profile
   */
  updateProfile(updates: Partial<UserProfile>): Promise<{ success: boolean; error?: string }>;

  /**
   * Listen for auth state changes
   * @param callback Function to call when auth state changes
   * @returns Unsubscribe function
   */
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void;
}
