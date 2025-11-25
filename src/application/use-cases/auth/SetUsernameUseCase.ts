/**
 * SetUsernameUseCase
 *
 * Use case for setting a username for an existing user account.
 */

import { SupabaseClient } from '../../../infrastructure/services/supabase/SupabaseClient.js';
import { SetUsernameParams, USERNAME_REGEX } from '../../../shared/types.js';

export class SetUsernameUseCase {
  /**
   * Execute the set username operation
   */
  async execute(params: SetUsernameParams): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate input
      if (!params.username || !params.username.trim()) {
        return {
          success: false,
          error: 'Username is required'
        };
      }

      const username = params.username.trim();

      // Validate format
      if (!USERNAME_REGEX.test(username)) {
        return {
          success: false,
          error: 'Username must be 3-20 characters, start with alphanumeric, and contain only letters, numbers, underscores, or hyphens'
        };
      }

      // Check if username is available
      const client = SupabaseClient.getInstance().getClient();

      const { data: isAvailable, error: availabilityError } = await client.rpc('is_username_available', {
        check_username: username
      });

      if (availabilityError) {
        console.error('Error checking username availability:', availabilityError);
        return {
          success: false,
          error: 'Failed to verify username availability'
        };
      }

      if (!isAvailable) {
        return {
          success: false,
          error: 'Username is already taken or reserved'
        };
      }

      // Get current user
      const { data: { user }, error: userError } = await client.auth.getUser();

      if (userError || !user) {
        console.error('Error getting current user:', userError);
        return {
          success: false,
          error: 'Not authenticated'
        };
      }

      // Update user metadata with username
      const { error: updateError } = await client.auth.updateUser({
        data: {
          username: username
        }
      });

      if (updateError) {
        console.error('Error updating user:', updateError);
        return {
          success: false,
          error: `Failed to set username: ${updateError.message}`
        };
      }

      // Update user_profiles table directly (in case trigger doesn't fire immediately)
      const { error: profileError } = await client
        .from('user_profiles')
        .update({ username: username })
        .eq('id', user.id);

      if (profileError) {
        console.error('Error updating user profile:', profileError);
        // Don't fail completely if profile update fails - metadata is source of truth
        console.warn('Username set in metadata but profile update failed');
      }

      return {
        success: true
      };
    } catch (error) {
      console.error('Exception in SetUsernameUseCase:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}
