/**
 * SignInWithGoogleUseCase
 *
 * Use case for signing in a user with Google OAuth.
 */

import { ISupabaseAuthService } from '../../../domain/services/ISupabaseAuthService.js';
import { AuthResult } from '../../../shared/types.js';

export class SignInWithGoogleUseCase {
  constructor(private authService: ISupabaseAuthService) {}

  /**
   * Execute the Google sign in operation
   * @param codeChallenge PKCE code challenge generated in renderer
   * @returns AuthResult with OAuth URL in the error field if successful
   */
  async execute(codeChallenge: string): Promise<AuthResult> {
    return await this.authService.signInWithGoogle(codeChallenge);
  }

  // NOTE: OAuth callback is now handled in renderer process
  // No handleCallback method needed - renderer uses RendererSupabaseClient directly
}
