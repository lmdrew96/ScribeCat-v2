/**
 * SignOutUseCase
 *
 * Use case for signing out the current user.
 */

import { ISupabaseAuthService } from '../../../domain/services/ISupabaseAuthService.js';

export class SignOutUseCase {
  constructor(private authService: ISupabaseAuthService) {}

  /**
   * Execute the sign out operation
   */
  async execute(): Promise<{ success: boolean; error?: string }> {
    return await this.authService.signOut();
  }
}
