/**
 * ServiceBootstrapper
 *
 * Handles initialization and wiring of core application services,
 * repositories, and use cases.
 */

import Store from 'electron-store';
import { FileSessionRepository } from '../../infrastructure/repositories/FileSessionRepository.js';
import { FileAudioRepository } from '../../infrastructure/repositories/FileAudioRepository.js';
import { SupabaseSessionRepository } from '../../infrastructure/repositories/SupabaseSessionRepository.js';
import { SupabaseShareRepository } from '../../infrastructure/repositories/SupabaseShareRepository.js';
import { SupabaseStorageService } from '../../infrastructure/services/supabase/SupabaseStorageService.js';
import { SupabaseClient } from '../../infrastructure/services/supabase/SupabaseClient.js';
import { ListSessionsUseCase } from '../../application/use-cases/ListSessionsUseCase.js';
import { DeleteSessionUseCase } from '../../application/use-cases/DeleteSessionUseCase.js';
import { ExportSessionUseCase } from '../../application/use-cases/ExportSessionUseCase.js';
import { UpdateSessionUseCase } from '../../application/use-cases/UpdateSessionUseCase.js';
import { TextExportService } from '../../infrastructure/services/export/TextExportService.js';
import { DocxExportService } from '../../infrastructure/services/export/DocxExportService.js';
import { PdfExportService } from '../../infrastructure/services/export/PdfExportService.js';
import { HtmlExportService } from '../../infrastructure/services/export/HtmlExportService.js';
import { ClaudeAIService } from '../../infrastructure/services/ai/ClaudeAIService.js';
import { GoogleDriveService } from '../../infrastructure/services/drive/GoogleDriveService.js';
import { SyncManager } from '../../infrastructure/services/sync/SyncManager.js';
import { DeletedSessionsTracker } from '../../infrastructure/services/DeletedSessionsTracker.js';
import {
  ShareSessionUseCase,
  RemoveShareUseCase,
  UpdateSharePermissionUseCase,
  GetSessionSharesUseCase,
  GetSharedSessionsUseCase,
  AcceptShareInvitationUseCase
} from '../../application/use-cases/sharing/index.js';
import { config } from '../../config.js';
import type { GoogleDriveConfig } from '../../shared/types.js';

export interface BootstrapResult {
  // Repositories
  sessionRepository: FileSessionRepository;
  audioRepository: FileAudioRepository;
  supabaseSessionRepository: SupabaseSessionRepository | null;
  supabaseShareRepository: SupabaseShareRepository | null;

  // Services
  supabaseClient: SupabaseClient | null;
  supabaseStorageService: SupabaseStorageService | null;
  aiService: ClaudeAIService | null;
  googleDriveService: GoogleDriveService | null;
  syncManager: SyncManager | null;
  deletedSessionsTracker: DeletedSessionsTracker;

  // Use Cases
  listSessionsUseCase: ListSessionsUseCase;
  deleteSessionUseCase: DeleteSessionUseCase;
  exportSessionUseCase: ExportSessionUseCase;
  updateSessionUseCase: UpdateSessionUseCase;
  shareSessionUseCase: ShareSessionUseCase | null;
  removeShareUseCase: RemoveShareUseCase | null;
  updateSharePermissionUseCase: UpdateSharePermissionUseCase | null;
  getSessionSharesUseCase: GetSessionSharesUseCase | null;
  getSharedSessionsUseCase: GetSharedSessionsUseCase | null;
  acceptShareInvitationUseCase: AcceptShareInvitationUseCase | null;

  // Export services
  exportServices: Map<string, any>;
}

export class ServiceBootstrapper {
  private store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  /**
   * Bootstrap all application services and return initialized instances
   */
  public async bootstrap(): Promise<BootstrapResult> {
    // Initialize repositories
    const sessionRepository = new FileSessionRepository();
    const audioRepository = new FileAudioRepository();

    // Initialize Supabase services
    const supabaseClient = SupabaseClient.getInstance();
    const supabaseStorageService = new SupabaseStorageService();
    const supabaseSessionRepository = new SupabaseSessionRepository();
    const supabaseShareRepository = new SupabaseShareRepository();

    // Initialize export services
    const exportServices = new Map();
    exportServices.set('txt', new TextExportService());
    exportServices.set('docx', new DocxExportService());
    exportServices.set('pdf', new PdfExportService());
    exportServices.set('html', new HtmlExportService());

    // Initialize deleted sessions tracker
    const deletedSessionsTracker = new DeletedSessionsTracker();
    await deletedSessionsTracker.initialize();

    // Initialize core use cases
    const listSessionsUseCase = new ListSessionsUseCase(sessionRepository);
    const deleteSessionUseCase = new DeleteSessionUseCase(
      sessionRepository,
      audioRepository,
      supabaseSessionRepository,
      deletedSessionsTracker
    );
    const exportSessionUseCase = new ExportSessionUseCase(
      sessionRepository,
      exportServices
    );
    const updateSessionUseCase = new UpdateSessionUseCase(
      sessionRepository,
      supabaseSessionRepository
    );

    // Initialize sync manager
    const syncManager = new SyncManager(
      sessionRepository,
      supabaseSessionRepository,
      supabaseStorageService,
      null, // User ID will be set later from renderer
      deletedSessionsTracker
    );

    // Initialize sharing use cases
    const shareSessionUseCase = new ShareSessionUseCase(supabaseShareRepository);
    const removeShareUseCase = new RemoveShareUseCase(supabaseShareRepository);
    const updateSharePermissionUseCase = new UpdateSharePermissionUseCase(supabaseShareRepository);
    const getSessionSharesUseCase = new GetSessionSharesUseCase(supabaseShareRepository);
    const getSharedSessionsUseCase = new GetSharedSessionsUseCase(supabaseShareRepository);
    const acceptShareInvitationUseCase = new AcceptShareInvitationUseCase(supabaseShareRepository);

    // Initialize AI service
    const aiService = this.initializeClaudeAI();

    // Initialize Google Drive service
    const googleDriveService = this.initializeGoogleDrive();

    console.log('✓ All services bootstrapped successfully');

    return {
      sessionRepository,
      audioRepository,
      supabaseSessionRepository,
      supabaseShareRepository,
      supabaseClient,
      supabaseStorageService,
      aiService,
      googleDriveService,
      syncManager,
      deletedSessionsTracker,
      listSessionsUseCase,
      deleteSessionUseCase,
      exportSessionUseCase,
      updateSessionUseCase,
      shareSessionUseCase,
      removeShareUseCase,
      updateSharePermissionUseCase,
      getSessionSharesUseCase,
      getSharedSessionsUseCase,
      acceptShareInvitationUseCase,
      exportServices
    };
  }

  /**
   * Initialize Claude AI service
   */
  private initializeClaudeAI(): ClaudeAIService | null {
    try {
      const apiKey = config.claude.apiKey;

      if (!apiKey) {
        console.warn('⚠️ Claude API key not configured. AI features unavailable.');
        return null;
      }

      const service = new ClaudeAIService({ apiKey });
      console.log('✓ Claude AI service initialized');
      return service;
    } catch (error) {
      console.error('✗ Failed to initialize Claude AI service:', error);
      return null;
    }
  }

  /**
   * Initialize Google Drive service
   */
  private initializeGoogleDrive(): GoogleDriveService {
    try {
      const storedCreds = (this.store as any).get('google-drive-credentials');
      const driveConfig: GoogleDriveConfig = storedCreds ? JSON.parse(storedCreds) : {};
      const service = new GoogleDriveService(driveConfig);
      console.log('✓ Google Drive service initialized');
      return service;
    } catch (error) {
      console.error('✗ Failed to initialize Google Drive service:', error);
      return new GoogleDriveService();
    }
  }
}
