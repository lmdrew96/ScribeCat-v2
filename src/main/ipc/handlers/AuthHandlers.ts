import type { IpcMain } from 'electron';
import { BaseHandler } from '../BaseHandler.js';
import {
  SignInWithEmailUseCase,
  SignUpWithEmailUseCase,
  SignInWithGoogleUseCase,
  SignOutUseCase,
  GetCurrentUserUseCase
} from '../../../application/use-cases/auth/index.js';
import { SetUsernameUseCase } from '../../../application/use-cases/auth/SetUsernameUseCase.js';
import { SignInWithEmailParams, SignUpWithEmailParams, SetUsernameParams } from '../../../shared/types.js';
import { SupabaseClient } from '../../../infrastructure/services/supabase/SupabaseClient.js';

/**
 * Handles authentication-related IPC channels
 *
 * Manages user sign-in, sign-up, sign-out, and session operations.
 */
export class AuthHandlers extends BaseHandler {
  constructor(
    private signInWithEmailUseCase: SignInWithEmailUseCase,
    private signUpWithEmailUseCase: SignUpWithEmailUseCase,
    private signInWithGoogleUseCase: SignInWithGoogleUseCase,
    private signOutUseCase: SignOutUseCase,
    private getCurrentUserUseCase: GetCurrentUserUseCase
  ) {
    super();
  }

  register(ipcMain: IpcMain): void {
    // Sign in with email handler
    this.handle(ipcMain, 'auth:signInWithEmail', async (event, params: SignInWithEmailParams) => {
      const result = await this.signInWithEmailUseCase.execute(params);
      return result;
    });

    // Sign up with email handler
    this.handle(ipcMain, 'auth:signUpWithEmail', async (event, params: SignUpWithEmailParams) => {
      const result = await this.signUpWithEmailUseCase.execute(params);
      return result;
    });

    // Sign in with Google - get OAuth URL
    this.handle(ipcMain, 'auth:signInWithGoogle', async (event, codeChallenge: string) => {
      const result = await this.signInWithGoogleUseCase.execute(codeChallenge);
      return result;
    });

    // NOTE: OAuth callback is now handled in renderer process where localStorage works
    // No IPC handler needed - renderer exchanges code directly using RendererSupabaseClient

    // Sign out handler
    this.handle(ipcMain, 'auth:signOut', async () => {
      const result = await this.signOutUseCase.execute();
      return result;
    });

    // Get current user handler
    this.handle(ipcMain, 'auth:getCurrentUser', async () => {
      const user = await this.getCurrentUserUseCase.execute();
      return {
        success: true,
        user
      };
    });

    // Check if authenticated handler
    this.handle(ipcMain, 'auth:isAuthenticated', async () => {
      const isAuthenticated = await this.getCurrentUserUseCase.isAuthenticated();
      return {
        success: true,
        isAuthenticated
      };
    });

    // Get access token for Realtime subscriptions
    this.handle(ipcMain, 'auth:getAccessToken', async () => {
      const accessToken = SupabaseClient.getInstance().getAccessToken();
      return {
        success: true,
        accessToken
      };
    });

    // Check username availability
    this.handle(ipcMain, 'auth:checkUsernameAvailability', async (event, username: string) => {
      try {
        const client = SupabaseClient.getInstance().getClient();
        const { data, error } = await client.rpc('is_username_available', {
          check_username: username
        });

        if (error) {
          console.error('Username availability check error:', error);
          return {
            success: true,
            available: false
          };
        }

        return {
          success: true,
          available: data === true
        };
      } catch (error) {
        console.error('Username availability check failed:', error);
        return {
          success: true,
          available: false
        };
      }
    });

    // Set username for existing users
    this.handle(ipcMain, 'auth:setUsername', async (event, username: string) => {
      const params: SetUsernameParams = { username };
      const setUsernameUseCase = new SetUsernameUseCase();
      const result = await setUsernameUseCase.execute(params);
      return result;
    });
  }
}
