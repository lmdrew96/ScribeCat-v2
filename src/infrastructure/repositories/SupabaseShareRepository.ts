/**
 * SupabaseShareRepository
 *
 * Implementation of IShareRepository using Supabase database.
 * Manages session shares and invitations with RLS policies.
 */

import { Share, ShareUser, PermissionLevel } from '../../domain/entities/Share.js';
import { ShareInvitation } from '../../domain/entities/ShareInvitation.js';
import {
  IShareRepository,
  CreateShareParams,
  CreateInvitationParams
} from '../../domain/repositories/IShareRepository.js';
import { SupabaseClient } from '../services/supabase/SupabaseClient.js';
import { randomBytes } from 'crypto';

// Database row types
interface SessionShareRow {
  id: string;
  session_id: string;
  shared_by_user_id: string;
  shared_with_user_id: string;
  permission_level: PermissionLevel;
  created_at: string;
  accepted_at?: string;
}

interface ShareInvitationRow {
  id: string;
  session_id: string;
  shared_by_user_id: string;
  email: string;
  permission_level: PermissionLevel;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at?: string;
  accepted_by_user_id?: string;
}

interface UserProfileRow {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}

export class SupabaseShareRepository implements IShareRepository {
  private sharesTable = 'session_shares';
  private invitationsTable = 'share_invitations';
  private profilesTable = 'user_profiles';

  /**
   * Create a share with an existing user
   */
  async createShare(params: CreateShareParams): Promise<Share> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      // Get current user
      const { data: { user } } = await client.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Get the user being shared with
      const sharedWithUser = await this.getUserById(params.sharedWithUserId);
      if (!sharedWithUser) {
        throw new Error('User not found');
      }

      // Get current user profile
      const sharedByUser = await this.getUserById(user.id);
      if (!sharedByUser) {
        throw new Error('Current user profile not found');
      }

      // Create the share
      const { data, error } = await client
        .from(this.sharesTable)
        .insert({
          session_id: params.sessionId,
          shared_by_user_id: user.id,
          shared_with_user_id: params.sharedWithUserId,
          permission_level: params.permissionLevel
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create share: ${error.message}`);
      }

      return this.rowToShare(data as SessionShareRow, sharedByUser, sharedWithUser);
    } catch (error) {
      console.error('Error creating share:', error);
      throw error;
    }
  }

  /**
   * Create an invitation for a user who doesn't have an account yet
   */
  async createInvitation(params: CreateInvitationParams): Promise<ShareInvitation> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      // Get current user
      const { data: { user } } = await client.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Get current user profile
      const sharedByUser = await this.getUserById(user.id);
      if (!sharedByUser) {
        throw new Error('Current user profile not found');
      }

      // Generate unique token
      const token = this.generateInvitationToken();

      // Create the invitation
      const { data, error } = await client
        .from(this.invitationsTable)
        .insert({
          session_id: params.sessionId,
          shared_by_user_id: user.id,
          email: params.email.toLowerCase(),
          permission_level: params.permissionLevel,
          token
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create invitation: ${error.message}`);
      }

      return this.rowToInvitation(data as ShareInvitationRow, sharedByUser);
    } catch (error) {
      console.error('Error creating invitation:', error);
      throw error;
    }
  }

  /**
   * Get all shares for a session
   */
  async getSessionShares(sessionId: string): Promise<Share[]> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { data, error } = await client
        .from(this.sharesTable)
        .select('*')
        .eq('session_id', sessionId);

      if (error) {
        throw new Error(`Failed to fetch shares: ${error.message}`);
      }

      // Fetch user profiles for all shares
      const shares: Share[] = [];
      for (const row of (data as SessionShareRow[])) {
        const sharedByUser = await this.getUserById(row.shared_by_user_id);
        const sharedWithUser = await this.getUserById(row.shared_with_user_id);

        if (sharedByUser && sharedWithUser) {
          shares.push(this.rowToShare(row, sharedByUser, sharedWithUser));
        }
      }

      return shares;
    } catch (error) {
      console.error('Error fetching session shares:', error);
      return [];
    }
  }

  /**
   * Get all invitations for a session
   */
  async getSessionInvitations(sessionId: string): Promise<ShareInvitation[]> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { data, error } = await client
        .from(this.invitationsTable)
        .select('*')
        .eq('session_id', sessionId)
        .is('accepted_at', null); // Only pending invitations

      if (error) {
        throw new Error(`Failed to fetch invitations: ${error.message}`);
      }

      // Fetch user profiles
      const invitations: ShareInvitation[] = [];
      for (const row of (data as ShareInvitationRow[])) {
        const sharedByUser = await this.getUserById(row.shared_by_user_id);
        if (sharedByUser) {
          invitations.push(this.rowToInvitation(row, sharedByUser));
        }
      }

      return invitations;
    } catch (error) {
      console.error('Error fetching session invitations:', error);
      return [];
    }
  }

  /**
   * Get all sessions shared with the current user
   */
  async getSharedWithMe(): Promise<Array<{ sessionId: string; share: Share }>> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      // Get current user
      const { data: { user } } = await client.auth.getUser();
      if (!user) {
        return [];
      }

      const { data, error } = await client
        .from(this.sharesTable)
        .select('*')
        .eq('shared_with_user_id', user.id);

      if (error) {
        throw new Error(`Failed to fetch shared sessions: ${error.message}`);
      }

      const result: Array<{ sessionId: string; share: Share }> = [];
      for (const row of (data as SessionShareRow[])) {
        const sharedByUser = await this.getUserById(row.shared_by_user_id);
        const sharedWithUser = await this.getUserById(row.shared_with_user_id);

        if (sharedByUser && sharedWithUser) {
          result.push({
            sessionId: row.session_id,
            share: this.rowToShare(row, sharedByUser, sharedWithUser)
          });
        }
      }

      return result;
    } catch (error) {
      console.error('Error fetching shared sessions:', error);
      return [];
    }
  }

  /**
   * Get all pending invitations for the current user (by email)
   */
  async getPendingInvitations(): Promise<ShareInvitation[]> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      // Get current user
      const { data: { user } } = await client.auth.getUser();
      if (!user || !user.email) {
        return [];
      }

      const { data, error } = await client
        .from(this.invitationsTable)
        .select('*')
        .eq('email', user.email.toLowerCase())
        .is('accepted_at', null);

      if (error) {
        throw new Error(`Failed to fetch invitations: ${error.message}`);
      }

      const invitations: ShareInvitation[] = [];
      for (const row of (data as ShareInvitationRow[])) {
        const sharedByUser = await this.getUserById(row.shared_by_user_id);
        if (sharedByUser) {
          invitations.push(this.rowToInvitation(row, sharedByUser));
        }
      }

      return invitations;
    } catch (error) {
      console.error('Error fetching pending invitations:', error);
      return [];
    }
  }

  /**
   * Remove a share
   */
  async removeShare(shareId: string): Promise<void> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { error } = await client
        .from(this.sharesTable)
        .delete()
        .eq('id', shareId);

      if (error) {
        throw new Error(`Failed to remove share: ${error.message}`);
      }
    } catch (error) {
      console.error('Error removing share:', error);
      throw error;
    }
  }

  /**
   * Remove an invitation
   */
  async removeInvitation(invitationId: string): Promise<void> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { error } = await client
        .from(this.invitationsTable)
        .delete()
        .eq('id', invitationId);

      if (error) {
        throw new Error(`Failed to remove invitation: ${error.message}`);
      }
    } catch (error) {
      console.error('Error removing invitation:', error);
      throw error;
    }
  }

  /**
   * Update share permission level
   */
  async updateSharePermission(shareId: string, permissionLevel: PermissionLevel): Promise<void> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { error } = await client
        .from(this.sharesTable)
        .update({ permission_level: permissionLevel })
        .eq('id', shareId);

      if (error) {
        throw new Error(`Failed to update permission: ${error.message}`);
      }
    } catch (error) {
      console.error('Error updating share permission:', error);
      throw error;
    }
  }

  /**
   * Accept a share (mark as accepted)
   */
  async acceptShare(shareId: string): Promise<void> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { error } = await client
        .from(this.sharesTable)
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', shareId);

      if (error) {
        throw new Error(`Failed to accept share: ${error.message}`);
      }
    } catch (error) {
      console.error('Error accepting share:', error);
      throw error;
    }
  }

  /**
   * Accept an invitation (convert to share)
   */
  async acceptInvitation(token: string): Promise<Share> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      // Get current user
      const { data: { user } } = await client.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Find the invitation
      const { data: invitationData, error: invError } = await client
        .from(this.invitationsTable)
        .select('*')
        .eq('token', token)
        .single();

      if (invError || !invitationData) {
        throw new Error('Invitation not found');
      }

      const invitation = invitationData as ShareInvitationRow;

      // Check if invitation is expired
      if (new Date(invitation.expires_at) < new Date()) {
        throw new Error('Invitation has expired');
      }

      // Create a share from the invitation
      const share = await this.createShare({
        sessionId: invitation.session_id,
        sharedWithUserId: user.id,
        permissionLevel: invitation.permission_level
      });

      // Mark invitation as accepted
      await client
        .from(this.invitationsTable)
        .update({
          accepted_at: new Date().toISOString(),
          accepted_by_user_id: user.id
        })
        .eq('id', invitation.id);

      return share;
    } catch (error) {
      console.error('Error accepting invitation:', error);
      throw error;
    }
  }

  /**
   * Find a user by email
   */
  async findUserByEmail(email: string): Promise<ShareUser | null> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { data, error } = await client
        .from(this.profilesTable)
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (error || !data) {
        return null;
      }

      return this.rowToShareUser(data as UserProfileRow);
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }

  /**
   * Check if a user has permission to access a session
   */
  async hasPermission(
    sessionId: string,
    userId: string,
    requiredPermission: PermissionLevel = 'viewer'
  ): Promise<boolean> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      // Call the Supabase function we created
      const { data, error } = await client.rpc('has_session_permission', {
        session_id: sessionId,
        user_id: userId,
        required_permission: requiredPermission
      });

      if (error) {
        console.error('Error checking permission:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Helper: Get user by ID
   */
  private async getUserById(userId: string): Promise<ShareUser | null> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { data, error } = await client
        .from(this.profilesTable)
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      return this.rowToShareUser(data as UserProfileRow);
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }

  /**
   * Helper: Convert database row to Share entity
   */
  private rowToShare(
    row: SessionShareRow,
    sharedBy: ShareUser,
    sharedWith: ShareUser
  ): Share {
    return new Share(
      row.id,
      row.session_id,
      sharedBy,
      sharedWith,
      row.permission_level,
      new Date(row.created_at),
      row.accepted_at ? new Date(row.accepted_at) : undefined
    );
  }

  /**
   * Helper: Convert database row to ShareInvitation entity
   */
  private rowToInvitation(row: ShareInvitationRow, sharedBy: ShareUser): ShareInvitation {
    return new ShareInvitation(
      row.id,
      row.session_id,
      sharedBy,
      row.email,
      row.permission_level,
      row.token,
      new Date(row.created_at),
      new Date(row.expires_at),
      row.accepted_at ? new Date(row.accepted_at) : undefined,
      row.accepted_by_user_id
    );
  }

  /**
   * Helper: Convert database row to ShareUser
   */
  private rowToShareUser(row: UserProfileRow): ShareUser {
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      avatarUrl: row.avatar_url
    };
  }

  /**
   * Helper: Generate a secure invitation token
   */
  private generateInvitationToken(): string {
    return randomBytes(32).toString('hex');
  }
}
