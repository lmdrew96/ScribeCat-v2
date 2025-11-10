/**
 * ShareHandlers
 *
 * IPC handlers for session sharing operations.
 */

import type { IpcMain } from 'electron';
import { BaseHandler } from '../BaseHandler.js';
import {
  ShareSessionUseCase,
  RemoveShareUseCase,
  UpdateSharePermissionUseCase,
  GetSessionSharesUseCase,
  GetSharedSessionsUseCase,
  AcceptShareInvitationUseCase
} from '../../../application/use-cases/sharing/index.js';
import { PermissionLevel } from '../../../domain/entities/Share.js';
import { SupabaseClient } from '../../../infrastructure/services/supabase/SupabaseClient.js';

export class ShareHandlers extends BaseHandler {
  private currentUserId: string | null = null;

  constructor(
    private shareSessionUseCase: ShareSessionUseCase,
    private removeShareUseCase: RemoveShareUseCase,
    private updateSharePermissionUseCase: UpdateSharePermissionUseCase,
    private getSessionSharesUseCase: GetSessionSharesUseCase,
    private getSharedSessionsUseCase: GetSharedSessionsUseCase,
    private acceptShareInvitationUseCase: AcceptShareInvitationUseCase
  ) {
    super();
  }

  /** Set the current user ID for access checks */
  setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
  }

  register(ipcMain: IpcMain): void {
    /**
     * Check if current user has access to a session
     */
    this.handle(ipcMain, 'share:checkAccess', async (_event, sessionId: string) => {
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

        const { data: session, error: sessionError } = await client
          .from('sessions')
          .select('user_id')
          .eq('id', sessionId)
          .is('deleted_at', null)
          .single();

        if (sessionError) {
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

        const { data: share, error: shareError } = await client
          .from('session_shares')
          .select('*')
          .eq('session_id', sessionId)
          .eq('shared_with_user_id', this.currentUserId)
          .single();

        if (shareError && shareError.code !== 'PGRST116') {
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

        return {
          success: true,
          hasAccess: false,
          permission: null,
          isShared: false,
          isOwner: false
        };
      } catch (error) {
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

    /**
     * Share a session with another user by email
     */
    this.handle(ipcMain, 'share:create', async (_event, params: { sessionId: string; email: string; permissionLevel: PermissionLevel }) => {
      const result = await this.shareSessionUseCase.execute(params);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        type: result.type,
        shareId: result.shareId,
        invitationId: result.invitationId
      };
    });

    /**
     * Remove a share or invitation
     */
    this.handle(ipcMain, 'share:remove', async (_event, params: { shareId?: string; invitationId?: string }) => {
      const result = await this.removeShareUseCase.execute(params);
      return result;
    });

    /**
     * Update share permission level
     */
    this.handle(ipcMain, 'share:updatePermission', async (_event, params: { shareId: string; permissionLevel: PermissionLevel }) => {
      const result = await this.updateSharePermissionUseCase.execute(params);
      return result;
    });

    /**
     * Get all shares and invitations for a session
     */
    this.handle(ipcMain, 'share:getSessionShares', async (_event, sessionId: string) => {
      const result = await this.getSessionSharesUseCase.execute({ sessionId });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Convert entities to plain objects for IPC
      return {
        success: true,
        shares: result.shares?.map(share => ({
          id: share.id,
          sessionId: share.sessionId,
          sharedBy: share.sharedBy,
          sharedWith: share.sharedWith,
          permissionLevel: share.permissionLevel,
          createdAt: share.createdAt.toISOString(),
          acceptedAt: share.acceptedAt?.toISOString()
        })),
        invitations: result.invitations?.map(inv => ({
          id: inv.id,
          sessionId: inv.sessionId,
          sharedBy: inv.sharedBy,
          email: inv.email,
          permissionLevel: inv.permissionLevel,
          token: inv.token,
          createdAt: inv.createdAt.toISOString(),
          expiresAt: inv.expiresAt.toISOString(),
          acceptedAt: inv.acceptedAt?.toISOString()
        }))
      };
    });

    /**
     * Get all sessions shared with the current user
     */
    this.handle(ipcMain, 'share:getSharedWithMe', async (_event) => {
      const result = await this.getSharedSessionsUseCase.execute();

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Convert entities to plain objects for IPC
      return {
        success: true,
        sharedSessions: result.sharedSessions?.map(item => ({
          sessionId: item.sessionId,
          share: {
            id: item.share.id,
            sessionId: item.share.sessionId,
            sharedBy: item.share.sharedBy,
            sharedWith: item.share.sharedWith,
            permissionLevel: item.share.permissionLevel,
            createdAt: item.share.createdAt.toISOString(),
            acceptedAt: item.share.acceptedAt?.toISOString()
          }
        }))
      };
    });

    /**
     * Accept a share invitation
     */
    this.handle(ipcMain, 'share:acceptInvitation', async (_event, token: string) => {
      const result = await this.acceptShareInvitationUseCase.execute({ token });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        share: result.share ? {
          id: result.share.id,
          sessionId: result.share.sessionId,
          sharedBy: result.share.sharedBy,
          sharedWith: result.share.sharedWith,
          permissionLevel: result.share.permissionLevel,
          createdAt: result.share.createdAt.toISOString(),
          acceptedAt: result.share.acceptedAt?.toISOString()
        } : undefined
      };
    });
  }
}
