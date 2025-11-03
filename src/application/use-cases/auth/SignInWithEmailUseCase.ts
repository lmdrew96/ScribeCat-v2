/**
 * SignInWithEmailUseCase
 *
 * Use case for signing in a user with email and password.
 */

import { ISupabaseAuthService } from '../../../domain/services/ISupabaseAuthService.js';
import { AuthResult, SignInWithEmailParams } from '../../../shared/types.js';

export class SignInWithEmailUseCase {
  constructor(private authService: ISupabaseAuthService) {}

  /**
   * Execute the sign in with email operation
   */
  async execute(params: SignInWithEmailParams): Promise<AuthResult> {
    // Validate input
    if (!params.email || !params.password) {
      return {
        success: false,
        error: 'Email and password are required'
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(params.email)) {
      return {
        success: false,
        error: 'Invalid email format'
      };
    }

    // Attempt sign in
    return await this.authService.signInWithEmail(params);
  }
}
