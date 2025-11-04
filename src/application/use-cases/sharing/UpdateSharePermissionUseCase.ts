/**
 * UpdateSharePermissionUseCase
 *
 * Use case for updating the permission level of a share.
 */

import { IShareRepository } from '../../../domain/repositories/IShareRepository.js';
import { PermissionLevel } from '../../../domain/entities/Share.js';

export interface UpdateSharePermissionParams {
  shareId: string;
  permissionLevel: PermissionLevel;
}

export interface UpdateSharePermissionResult {
  success: boolean;
  error?: string;
}

export class UpdateSharePermissionUseCase {
  constructor(private shareRepository: IShareRepository) {}

  async execute(params: UpdateSharePermissionParams): Promise<UpdateSharePermissionResult> {
    try {
      await this.shareRepository.updateSharePermission(params.shareId, params.permissionLevel);
      return { success: true };
    } catch (error) {
      console.error('Error updating share permission:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update permission'
      };
    }
  }
}
