/**
 * SharingHandlers
 *
 * IPC handlers for session sharing operations.
 * Handles sharing, permission checks, and access management.
 */

import { ipcMain } from 'electron';
import { SupabaseClient } from '../../../infrastructure/services/supabase/SupabaseClient.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('SharingHandlers');

export class SharingHandlers {
  private currentUserId: string | null = null;

  constructor() {
    this.setupHandlers();
  }

  /**
   * Set the current user ID
   */
  setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
    logger.info('Current user ID set for sharing handlers:', userId);
  }

  /**
   * Setup IPC handlers
   */
  private setupHandlers(): void {
    // Check access to a session
    ipcMain.handle('sharing:checkAccess', async (event, sessionId: string) => {
      try {
        if (!this.currentUserId) {
          return {
            success: false,
            hasAccess: false,
            permission: null,
            isShared: false,
            isOwner: false
          };
        }

        const client = SupabaseClient.getInstance().getClient();

        // Check if user is owner
        const { data: session, error: sessionError } = await client
          .from('sessions')
          .select('user_id')
          .eq('id', sessionId)
          .is('deleted_at', null)
          .single();

        if (sessionError) {
          logger.error('Error checking session ownership:', sessionError);
          return {
            success: false,
            hasAccess: false,
            permission: null,
            isShared: false,
            isOwner: false,
            error: sessionError.message
          };
        }

        const isOwner = session?.user_id === this.currentUserId;

        if (isOwner) {
          return {
            success: true,
            hasAccess: true,
            permission: 'owner',
            isShared: false,
            isOwner: true
          };
        }

        // Check if session is shared with user
        const { data: share, error: shareError } = await client
          .from('session_shares')
          .select('*')
          .eq('session_id', sessionId)
          .eq('shared_with_user_id', this.currentUserId)
          .single();

        if (shareError && shareError.code !== 'PGRST116') { // PGRST116 = not found
          logger.error('Error checking session share:', shareError);
          return {
            success: false,
            hasAccess: false,
            permission: null,
            isShared: false,
            isOwner: false,
            error: shareError.message
          };
        }

        if (share) {
          return {
            success: true,
            hasAccess: true,
            permission: share.permission_level,
            isShared: true,
            isOwner: false
          };
        }

        // User has no access
        return {
          success: true,
          hasAccess: false,
          permission: null,
          isShared: false,
          isOwner: false
        };
      } catch (error) {
        logger.error('Error in sharing:checkAccess:', error);
        return {
          success: false,
          hasAccess: false,
          permission: null,
          isShared: false,
          isOwner: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Share a session with another user
    ipcMain.handle('sharing:shareSession', async (event, params: {
      sessionId: string;
      sharedWithEmail: string;
      permissionLevel: 'viewer' | 'editor';
    }) => {
      try {
        if (!this.currentUserId) {
          return {
            success: false,
            error: 'User not authenticated'
          };
        }

        const client = SupabaseClient.getInstance().getClient();

        // Verify user owns the session
        const { data: session, error: sessionError } = await client
          .from('sessions')
          .select('user_id')
          .eq('id', params.sessionId)
          .single();

        if (sessionError || !session) {
          return {
            success: false,
            error: 'Session not found or access denied'
          };
        }

        if (session.user_id !== this.currentUserId) {
          return {
            success: false,
            error: 'Only the session owner can share'
          };
        }

        // Find user by email
        const { data: users, error: userError } = await client
          .from('user_profiles')
          .select('id')
          .eq('email', params.sharedWithEmail)
          .limit(1);

        if (userError || !users || users.length === 0) {
          return {
            success: false,
            error: 'User not found with that email'
          };
        }

        const sharedWithUserId = users[0].id;

        // Check if already shared
        const { data: existingShare, error: checkError } = await client
          .from('session_shares')
          .select('id')
          .eq('session_id', params.sessionId)
          .eq('shared_with_user_id', sharedWithUserId)
          .maybeSingle();

        if (existingShare) {
          return {
            success: false,
            error: 'Session already shared with this user'
          };
        }

        // Create share
        const { data: share, error: shareError } = await client
          .from('session_shares')
          .insert({
            session_id: params.sessionId,
            shared_by_user_id: this.currentUserId,
            shared_with_user_id: sharedWithUserId,
            permission_level: params.permissionLevel
          })
          .select()
          .single();

        if (shareError) {
          logger.error('Error creating share:', shareError);
          return {
            success: false,
            error: shareError.message
          };
        }

        return {
          success: true,
          share
        };
      } catch (error) {
        logger.error('Error in sharing:shareSession:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get all shares for a session
    ipcMain.handle('sharing:getSessionShares', async (event, sessionId: string) => {
      try {
        if (!this.currentUserId) {
          return {
            success: false,
            error: 'User not authenticated'
          };
        }

        const client = SupabaseClient.getInstance().getClient();

        // Verify user owns the session
        const { data: session, error: sessionError } = await client
          .from('sessions')
          .select('user_id')
          .eq('id', sessionId)
          .single();

        if (sessionError || !session || session.user_id !== this.currentUserId) {
          return {
            success: false,
            error: 'Session not found or access denied'
          };
        }

        // Get shares first
        const { data: shares, error: sharesError } = await client
          .from('session_shares')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false });

        if (sharesError) {
          logger.error('Error getting shares:', sharesError);
          return {
            success: false,
            error: sharesError.message
          };
        }

        // Fetch user profiles separately for each share
        const sharesWithProfiles = await Promise.all(
          (shares || []).map(async (share) => {
            const { data: profile, error: profileError } = await client
              .from('user_profiles')
              .select('email, full_name')
              .eq('id', share.shared_with_user_id)
              .single();

            return {
              ...share,
              shared_with: profileError ? null : profile
            };
          })
        );

        return {
          success: true,
          shares: sharesWithProfiles
        };
      } catch (error) {
        logger.error('Error in sharing:getSessionShares:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get sessions shared with current user
    ipcMain.handle('sharing:getSharedWithMe', async () => {
      try {
        if (!this.currentUserId) {
          return {
            success: false,
            error: 'User not authenticated'
          };
        }

        const client = SupabaseClient.getInstance().getClient();

        // Get shares for current user with full session details
        const { data: shares, error: sharesError } = await client
          .from('session_shares')
          .select(`
            *,
            sessions (
              id,
              user_id,
              title,
              notes,
              duration,
              created_at,
              updated_at,
              transcription_text,
              transcription_provider,
              transcription_language,
              transcription_confidence,
              transcription_timestamp,
              tags,
              course_id,
              course_title,
              course_number
            )
          `)
          .eq('shared_with_user_id', this.currentUserId)
          .order('created_at', { ascending: false });

        if (sharesError) {
          logger.error('Error getting shared sessions:', sharesError);
          return {
            success: false,
            error: sharesError.message
          };
        }

        // Fetch owner profiles for each share
        const sharesWithOwner = await Promise.all(
          (shares || []).map(async (share) => {
            const sessionData = share.sessions as any;
            if (!sessionData || !sessionData.user_id) {
              return share;
            }

            // Fetch owner profile
            const { data: ownerProfile, error: profileError } = await client
              .from('user_profiles')
              .select('email, full_name')
              .eq('id', sessionData.user_id)
              .single();

            // Add owner info to the share object
            return {
              ...share,
              sessions: {
                ...sessionData,
                owner_name: profileError ? null : ownerProfile?.full_name,
                owner_email: profileError ? null : ownerProfile?.email
              }
            };
          })
        );

        return {
          success: true,
          sessions: sharesWithOwner
        };
      } catch (error) {
        logger.error('Error in sharing:getSharedWithMe:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Update share permission
    ipcMain.handle('sharing:updatePermission', async (event, params: {
      shareId: string;
      permissionLevel: 'viewer' | 'editor';
    }) => {
      try {
        if (!this.currentUserId) {
          return {
            success: false,
            error: 'User not authenticated'
          };
        }

        const client = SupabaseClient.getInstance().getClient();

        logger.info('Updating permission for share:', params.shareId);

        // Get the share first
        const { data: share, error: shareError } = await client
          .from('session_shares')
          .select('id, session_id')
          .eq('id', params.shareId)
          .single();

        logger.info('Share query result:', { share, error: shareError });

        if (shareError || !share) {
          logger.error('Error fetching share:', shareError);
          return {
            success: false,
            error: `Share not found: ${shareError?.message || 'No data returned'}`
          };
        }

        // Verify user owns the session
        const { data: session, error: sessionError } = await client
          .from('sessions')
          .select('user_id')
          .eq('id', share.session_id)
          .single();

        if (sessionError || !session) {
          logger.error('Error fetching session:', sessionError);
          return {
            success: false,
            error: 'Session not found'
          };
        }

        if (session.user_id !== this.currentUserId) {
          return {
            success: false,
            error: 'Only the session owner can update permissions'
          };
        }

        // Update permission
        const { error: updateError } = await client
          .from('session_shares')
          .update({ permission_level: params.permissionLevel })
          .eq('id', params.shareId);

        if (updateError) {
          logger.error('Error updating permission:', updateError);
          return {
            success: false,
            error: updateError.message
          };
        }

        return { success: true };
      } catch (error) {
        logger.error('Error in sharing:updatePermission:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Revoke access (delete share)
    ipcMain.handle('sharing:revokeAccess', async (event, shareId: string) => {
      try {
        if (!this.currentUserId) {
          return {
            success: false,
            error: 'User not authenticated'
          };
        }

        const client = SupabaseClient.getInstance().getClient();

        // Get the share first
        const { data: share, error: shareError } = await client
          .from('session_shares')
          .select('id, session_id, shared_by_user_id, shared_with_user_id')
          .eq('id', shareId)
          .single();

        if (shareError || !share) {
          logger.error('Error fetching share:', shareError);
          return {
            success: false,
            error: 'Share not found'
          };
        }

        // Verify user is either the session owner OR the recipient
        const { data: session, error: sessionError } = await client
          .from('sessions')
          .select('user_id')
          .eq('id', share.session_id)
          .single();

        if (sessionError || !session) {
          logger.error('Error fetching session:', sessionError);
          return {
            success: false,
            error: 'Session not found'
          };
        }

        const isOwner = session.user_id === this.currentUserId;
        const isRecipient = share.shared_with_user_id === this.currentUserId;

        if (!isOwner && !isRecipient) {
          return {
            success: false,
            error: 'You do not have permission to remove this share'
          };
        }

        logger.info(`${isOwner ? 'Owner' : 'Recipient'} removing share:`, shareId);

        // Delete share
        const { error: deleteError } = await client
          .from('session_shares')
          .delete()
          .eq('id', shareId);

        if (deleteError) {
          logger.error('Error revoking access:', deleteError);
          return {
            success: false,
            error: deleteError.message
          };
        }

        return { success: true };
      } catch (error) {
        logger.error('Error in sharing:revokeAccess:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    logger.info('Sharing IPC handlers registered');
  }
}
