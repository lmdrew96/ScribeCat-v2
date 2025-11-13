/**
 * SyncOperationQueue
 *
 * Handles failed sync operations with persistent queue and retry logic.
 * Solves the root cause of silent failures in cloud operations by:
 * - Persisting failed operations to disk for reliability
 * - Implementing exponential backoff retry strategy
 * - Providing visibility into pending operations
 * - Ensuring eventual consistency between local and cloud
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

export enum SyncOperationType {
  CLOUD_DELETE = 'cloud_delete',
  CLOUD_RESTORE = 'cloud_restore',
  TRACKER_MARK_DELETED = 'tracker_mark_deleted',
  TRACKER_REMOVE_DELETED = 'tracker_remove_deleted'
}

export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  sessionId: string;
  timestamp: number;
  retryCount: number;
  lastRetryAt?: number;
  error?: string;
}

export class SyncOperationQueue {
  private queueFilePath: string;
  private operations: Map<string, SyncOperation> = new Map();
  private isProcessing: boolean = false;
  private maxRetries: number = 5;
  private baseDelay: number = 2000; // 2 seconds

  constructor(queueFilePath?: string) {
    // Store queue in app data directory
    const userDataPath = app.getPath('userData');
    this.queueFilePath = queueFilePath || path.join(userDataPath, 'sync-operation-queue.json');
  }

  /**
   * Initialize the queue by loading persisted operations
   */
  async initialize(): Promise<void> {
    try {
      const data = await fs.readFile(this.queueFilePath, 'utf-8');
      const operations = JSON.parse(data) as SyncOperation[];

      operations.forEach(op => {
        this.operations.set(op.id, op);
      });

      console.log(`📋 Loaded ${operations.length} pending sync operations from disk`);
    } catch (error) {
      // File doesn't exist yet or is corrupted - start with empty queue
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('Failed to load sync operation queue, starting fresh:', error);
      }
      this.operations.clear();
    }
  }

  /**
   * Add a failed operation to the queue
   */
  async addOperation(
    type: SyncOperationType,
    sessionId: string,
    error?: string
  ): Promise<string> {
    const operationId = `${type}_${sessionId}_${Date.now()}`;

    const operation: SyncOperation = {
      id: operationId,
      type,
      sessionId,
      timestamp: Date.now(),
      retryCount: 0,
      error
    };

    this.operations.set(operationId, operation);
    await this.persist();

    console.log(`➕ Added sync operation to queue: ${type} for session ${sessionId}`);

    return operationId;
  }

  /**
   * Remove an operation from the queue (after successful retry)
   */
  async removeOperation(operationId: string): Promise<void> {
    if (this.operations.delete(operationId)) {
      await this.persist();
      console.log(`✅ Removed completed sync operation: ${operationId}`);
    }
  }

  /**
   * Get all pending operations
   */
  getPendingOperations(): SyncOperation[] {
    return Array.from(this.operations.values());
  }

  /**
   * Get pending operations for a specific session
   */
  getOperationsForSession(sessionId: string): SyncOperation[] {
    return Array.from(this.operations.values())
      .filter(op => op.sessionId === sessionId);
  }

  /**
   * Get count of pending operations
   */
  getPendingCount(): number {
    return this.operations.size;
  }

  /**
   * Process the queue with retry logic
   * Returns count of successfully processed operations
   */
  async processQueue(
    handlers: {
      cloudDelete?: (sessionId: string) => Promise<void>;
      cloudRestore?: (sessionId: string) => Promise<void>;
      trackerMarkDeleted?: (sessionId: string) => Promise<void>;
      trackerRemoveDeleted?: (sessionId: string) => Promise<void>;
    }
  ): Promise<{ processed: number; failed: number }> {
    if (this.isProcessing) {
      console.log('⏭️ Queue processing already in progress, skipping');
      return { processed: 0, failed: 0 };
    }

    this.isProcessing = true;
    let processed = 0;
    let failed = 0;

    try {
      const operations = Array.from(this.operations.values());

      if (operations.length === 0) {
        return { processed: 0, failed: 0 };
      }

      console.log(`🔄 Processing ${operations.length} pending sync operations...`);

      for (const operation of operations) {
        // Check if operation should be retried based on exponential backoff
        if (!this.shouldRetry(operation)) {
          continue;
        }

        // Check if max retries exceeded
        if (operation.retryCount >= this.maxRetries) {
          console.error(`❌ Max retries exceeded for operation ${operation.id}, removing from queue`);
          await this.removeOperation(operation.id);
          failed++;
          continue;
        }

        // Get the appropriate handler
        const handler = this.getHandler(operation.type, handlers);
        if (!handler) {
          console.warn(`⚠️ No handler registered for operation type: ${operation.type}`);
          continue;
        }

        // Attempt to execute the operation
        try {
          await handler(operation.sessionId);

          // Success! Remove from queue
          await this.removeOperation(operation.id);
          processed++;

          console.log(`✅ Successfully processed operation: ${operation.type} for session ${operation.sessionId}`);
        } catch (error) {
          // Failed - update retry count
          operation.retryCount++;
          operation.lastRetryAt = Date.now();
          operation.error = error instanceof Error ? error.message : 'Unknown error';

          await this.persist();
          failed++;

          console.error(
            `❌ Failed to process operation ${operation.id} (attempt ${operation.retryCount}/${this.maxRetries}):`,
            operation.error
          );
        }
      }

      if (processed > 0 || failed > 0) {
        console.log(`📊 Queue processing complete: ${processed} processed, ${failed} failed, ${this.operations.size} remaining`);
      }

      return { processed, failed };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Determine if an operation should be retried based on exponential backoff
   */
  private shouldRetry(operation: SyncOperation): boolean {
    if (operation.retryCount === 0) {
      return true; // First attempt
    }

    if (!operation.lastRetryAt) {
      return true; // No last retry timestamp
    }

    // Exponential backoff: 2s, 4s, 8s, 16s, 32s
    const delayMs = this.baseDelay * Math.pow(2, operation.retryCount - 1);
    const timeSinceLastRetry = Date.now() - operation.lastRetryAt;

    return timeSinceLastRetry >= delayMs;
  }

  /**
   * Get the appropriate handler for an operation type
   */
  private getHandler(
    type: SyncOperationType,
    handlers: {
      cloudDelete?: (sessionId: string) => Promise<void>;
      cloudRestore?: (sessionId: string) => Promise<void>;
      trackerMarkDeleted?: (sessionId: string) => Promise<void>;
      trackerRemoveDeleted?: (sessionId: string) => Promise<void>;
    }
  ): ((sessionId: string) => Promise<void>) | undefined {
    switch (type) {
      case SyncOperationType.CLOUD_DELETE:
        return handlers.cloudDelete;
      case SyncOperationType.CLOUD_RESTORE:
        return handlers.cloudRestore;
      case SyncOperationType.TRACKER_MARK_DELETED:
        return handlers.trackerMarkDeleted;
      case SyncOperationType.TRACKER_REMOVE_DELETED:
        return handlers.trackerRemoveDeleted;
      default:
        return undefined;
    }
  }

  /**
   * Persist the queue to disk
   */
  private async persist(): Promise<void> {
    try {
      const operations = Array.from(this.operations.values());
      await fs.writeFile(
        this.queueFilePath,
        JSON.stringify(operations, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to persist sync operation queue:', error);
      // Don't throw - we don't want to crash if persistence fails
      // Operations will still be processed from memory
    }
  }

  /**
   * Clear all operations (use with caution!)
   */
  async clear(): Promise<void> {
    this.operations.clear();
    await this.persist();
    console.log('🗑️ Cleared all sync operations from queue');
  }

  /**
   * Get statistics about the queue
   */
  getStats(): {
    total: number;
    byType: Record<string, number>;
    oldestOperation?: SyncOperation;
  } {
    const operations = Array.from(this.operations.values());

    const byType: Record<string, number> = {};
    let oldestOperation: SyncOperation | undefined;

    operations.forEach(op => {
      byType[op.type] = (byType[op.type] || 0) + 1;

      if (!oldestOperation || op.timestamp < oldestOperation.timestamp) {
        oldestOperation = op;
      }
    });

    return {
      total: operations.length,
      byType,
      oldestOperation
    };
  }
}
