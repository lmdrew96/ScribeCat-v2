/**
 * GetCurrentUserUseCase
 *
 * Use case for retrieving the current authenticated user.
 */

import { ISupabaseAuthService } from '../../../domain/services/ISupabaseAuthService.js';
import { UserProfile } from '../../../shared/types.js';

export class GetCurrentUserUseCase {
  constructor(private authService: ISupabaseAuthService) {}

  /**
   * Execute get current user operation
   */
  async execute(): Promise<UserProfile | null> {
    return await this.authService.getCurrentUser();
  }

  /**
   * Check if user is currently authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    return await this.authService.isAuthenticated();
  }
}
