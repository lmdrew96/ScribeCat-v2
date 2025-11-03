/**
 * SignUpWithEmailUseCase
 *
 * Use case for creating a new user account with email and password.
 */

import { ISupabaseAuthService } from '../../../domain/services/ISupabaseAuthService.js';
import { AuthResult, SignUpWithEmailParams } from '../../../shared/types.js';

export class SignUpWithEmailUseCase {
  constructor(private authService: ISupabaseAuthService) {}

  /**
   * Execute the sign up with email operation
   */
  async execute(params: SignUpWithEmailParams): Promise<AuthResult> {
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

    // Validate password strength
    if (params.password.length < 8) {
      return {
        success: false,
        error: 'Password must be at least 8 characters long'
      };
    }

    // Attempt sign up
    return await this.authService.signUpWithEmail(params);
  }
}
