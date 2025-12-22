/**
 * ServiceBootstrapper
 *
 * Centralized initialization of all application services, repositories, and use cases
 * Separates initialization into early (before app ready) and regular (after app ready) phases
 *
 * Responsibilities:
 * - Initialize AI services (Claude)
 * - Initialize Drive services (Google Drive)
 * - Initialize Supabase services (client, storage, repositories)
 * - Initialize export services
 * - Initialize use cases
 * - Initialize sync and recording managers
 */

import { config } from '../config.js';
import { DirectoryManager } from '../infrastructure/setup/DirectoryManager.js';
import { FileSessionRepository } from '../infrastructure/repositories/FileSessionRepository.js';
import { FileAudioRepository } from '../infrastructure/repositories/FileAudioRepository.js';
import { ListSessionsUseCase } from '../application/use-cases/ListSessionsUseCase.js';
import { DeleteSessionUseCase } from '../application/use-cases/DeleteSessionUseCase.js';
import { ExportSessionUseCase } from '../application/use-cases/ExportSessionUseCase.js';
import { UpdateSessionUseCase } from '../application/use-cases/UpdateSessionUseCase.js';
import { RestoreSessionUseCase } from '../application/use-cases/RestoreSessionUseCase.js';
import { PermanentlyDeleteSessionUseCase } from '../application/use-cases/PermanentlyDeleteSessionUseCase.js';
import { GetDeletedSessionsUseCase } from '../application/use-cases/GetDeletedSessionsUseCase.js';
import { CreateMultiSessionStudySetUseCase } from '../application/use-cases/CreateMultiSessionStudySetUseCase.js';
import { TextExportService } from '../infrastructure/services/export/TextExportService.js';
import { DocxExportService } from '../infrastructure/services/export/DocxExportService.js';
import { PdfExportService } from '../infrastructure/services/export/PdfExportService.js';
import { HtmlExportService } from '../infrastructure/services/export/HtmlExportService.js';
import { ClaudeAIService } from '../infrastructure/services/ai/ClaudeAIService.js';
import { GoogleDriveService } from '../infrastructure/services/drive/GoogleDriveService.js';
import { SupabaseStorageService } from '../infrastructure/services/supabase/SupabaseStorageService.js';
import { SupabaseSessionRepository } from '../infrastructure/repositories/SupabaseSessionRepository.js';
import { SupabaseShareRepository } from '../infrastructure/repositories/SupabaseShareRepository.js';
import { SupabaseClient } from '../infrastructure/services/supabase/SupabaseClient.js';
import { SyncManager } from '../infrastructure/services/sync/SyncManager.js';
import { SyncOperationQueue } from '../infrastructure/services/sync/SyncOperationQueue.js';
import { DeletedSessionsTracker } from '../infrastructure/services/DeletedSessionsTracker.js';
import {
  ShareSessionUseCase,
  RemoveShareUseCase,
  UpdateSharePermissionUseCase,
  GetSessionSharesUseCase,
  GetSharedSessionsUseCase,
  AcceptShareInvitationUseCase
} from '../application/use-cases/sharing/index.js';
import {
  SignInWithEmailUseCase,
  SignUpWithEmailUseCase,
  SignInWithGoogleUseCase,
  SignOutUseCase,
  GetCurrentUserUseCase
} from '../application/use-cases/auth/index.js';
import { RecordingManager } from './recording-manager.js';
import type { GoogleDriveConfig } from '../shared/types.js';
import Store from 'electron-store';

interface StoreSchema {
  'google-drive-credentials'?: string;
}

export interface Services {
  // Early services (initialized before app ready)
  aiService: ClaudeAIService | null;
  googleDriveService: GoogleDriveService | null;
  supabaseClient: SupabaseClient | null;
  supabaseStorageService: SupabaseStorageService | null;
  supabaseSessionRepository: SupabaseSessionRepository | null;
  supabaseShareRepository: SupabaseShareRepository | null;

  // Regular services (initialized after app ready)
  directoryManager: DirectoryManager;
  sessionRepository: FileSessionRepository;
  audioRepository: FileAudioRepository;
  exportServices: Map<string, any>;
  deletedSessionsTracker: DeletedSessionsTracker;
  syncOperationQueue: SyncOperationQueue;

  // Use cases
  listSessionsUseCase: ListSessionsUseCase;
  deleteSessionUseCase: DeleteSessionUseCase;
  exportSessionUseCase: ExportSessionUseCase;
  updateSessionUseCase: UpdateSessionUseCase;
  restoreSessionUseCase: RestoreSessionUseCase;
  permanentlyDeleteSessionUseCase: PermanentlyDeleteSessionUseCase;
  getDeletedSessionsUseCase: GetDeletedSessionsUseCase;
  createMultiSessionStudySetUseCase: CreateMultiSessionStudySetUseCase;

  // Sharing use cases
  shareSessionUseCase: ShareSessionUseCase;
  removeShareUseCase: RemoveShareUseCase;
  updateSharePermissionUseCase: UpdateSharePermissionUseCase;
  getSessionSharesUseCase: GetSessionSharesUseCase;
  getSharedSessionsUseCase: GetSharedSessionsUseCase;
  acceptShareInvitationUseCase: AcceptShareInvitationUseCase;

  // Auth use cases
  signInWithEmailUseCase: SignInWithEmailUseCase;
  signUpWithEmailUseCase: SignUpWithEmailUseCase;
  signInWithGoogleUseCase: SignInWithGoogleUseCase;
  signOutUseCase: SignOutUseCase;
  getCurrentUserUseCase: GetCurrentUserUseCase;

  // Managers
  syncManager: SyncManager | null;
  recordingManager: RecordingManager;
}

export class ServiceBootstrapper {
  private store: Store<StoreSchema>;
  private services: Partial<Services> = {};

  constructor(store: Store<StoreSchema>) {
    this.store = store;
  }

  /**
   * Initialize early services (before app is ready)
   * These services don't require Electron app to be ready
   */
  initializeEarlyServices(): void {
    this.initializeClaudeAI();
    this.initializeGoogleDrive();
    this.initializeSupabase();
  }

  /**
   * Initialize regular services (after app is ready)
   * These services require Electron app to be ready
   */
  async initializeServices(): Promise<Services> {
    // Initialize repositories
    this.services.directoryManager = new DirectoryManager();
    this.services.sessionRepository = new FileSessionRepository();
    this.services.audioRepository = new FileAudioRepository();

    // Initialize export services
    this.services.exportServices = new Map();
    this.services.exportServices.set('txt', new TextExportService());
    this.services.exportServices.set('docx', new DocxExportService());
    this.services.exportServices.set('pdf', new PdfExportService());
    this.services.exportServices.set('html', new HtmlExportService());

    // Initialize DeletedSessionsTracker
    this.services.deletedSessionsTracker = new DeletedSessionsTracker();
    await this.services.deletedSessionsTracker.initialize();

    // Initialize SyncOperationQueue
    this.services.syncOperationQueue = new SyncOperationQueue();
    await this.services.syncOperationQueue.initialize();

    // Initialize use cases
    this.initializeUseCases();
    this.initializeSharingUseCases();
    this.initializeAuthUseCases();

    // Initialize sync manager
    this.initializeSyncManager();

    // Initialize recording manager
    this.initializeRecordingManager();

    // Initialize directory structure
    await this.initializeDirectories();

    return this.services as Services;
  }

  /**
   * Get initialized services
   */
  getServices(): Services {
    return this.services as Services;
  }

  /**
   * Initialize Claude AI service with default API key from config
   */
  private initializeClaudeAI(): void {
    try {
      const apiKey = config.claude.apiKey;

      if (!apiKey) {
        console.warn('⚠️ Claude API key not configured in environment. AI features will be unavailable.');
        this.services.aiService = null;
        return;
      }

      this.services.aiService = new ClaudeAIService({ apiKey });
      console.log('✅ Claude AI service initialized with default API key');
    } catch (error) {
      console.error('❌ Failed to initialize Claude AI service:', error);
      this.services.aiService = null;
    }
  }

  /** Typed interface for electron-store methods */
  private getStoreValue(key: string): unknown {
    return (this.store as { get(key: string): unknown }).get(key);
  }

  /**
   * Initialize Google Drive service with stored credentials
   */
  private initializeGoogleDrive(): void {
    try {
      // Load stored credentials if they exist
      const storedCreds = this.getStoreValue('google-drive-credentials') as string | undefined;
      const driveConfig: GoogleDriveConfig = storedCreds ? JSON.parse(storedCreds) : {};

      // Initialize service (it will work with or without stored credentials)
      this.services.googleDriveService = new GoogleDriveService(driveConfig);

      console.log('Google Drive service initialized');
    } catch (error) {
      console.error('Failed to initialize Google Drive service:', error);
      // Initialize with empty config as fallback
      this.services.googleDriveService = new GoogleDriveService();
    }
  }

  /**
   * Initialize Supabase services with production configuration
   */
  private initializeSupabase(): void {
    try {
      // NOTE: SupabaseAuthService is NOT initialized in main process
      // Auth happens in renderer process where localStorage exists
      // Renderer will send auth state updates via IPC

      // Initialize Supabase client (session will be set from renderer)
      this.services.supabaseClient = SupabaseClient.getInstance();

      // Initialize storage service for cloud uploads
      this.services.supabaseStorageService = new SupabaseStorageService();

      // Initialize session repository for cloud session storage
      this.services.supabaseSessionRepository = new SupabaseSessionRepository();

      // Initialize share repository for session sharing
      this.services.supabaseShareRepository = new SupabaseShareRepository();

      console.log('Supabase cloud services initialized (auth handled in renderer)');
    } catch (error) {
      console.error('Failed to initialize Supabase services:', error);
      throw error; // Re-throw since this is critical for the app
    }
  }

  /**
   * Initialize all use cases
   */
  private initializeUseCases(): void {
    const sessionRepo = this.services.sessionRepository!;
    const audioRepo = this.services.audioRepository!;
    const supabaseSessionRepo = this.services.supabaseSessionRepository || undefined;
    const deletedTracker = this.services.deletedSessionsTracker!;
    const syncQueue = this.services.syncOperationQueue!;
    const exportServices = this.services.exportServices!;

    this.services.listSessionsUseCase = new ListSessionsUseCase(sessionRepo);

    this.services.deleteSessionUseCase = new DeleteSessionUseCase(
      sessionRepo,
      audioRepo,
      supabaseSessionRepo,
      deletedTracker,
      syncQueue
    );

    this.services.exportSessionUseCase = new ExportSessionUseCase(
      sessionRepo,
      exportServices
    );

    this.services.updateSessionUseCase = new UpdateSessionUseCase(
      sessionRepo,
      supabaseSessionRepo
    );

    this.services.restoreSessionUseCase = new RestoreSessionUseCase(
      sessionRepo,
      supabaseSessionRepo,
      deletedTracker,
      syncQueue
    );

    this.services.permanentlyDeleteSessionUseCase = new PermanentlyDeleteSessionUseCase(
      sessionRepo,
      audioRepo,
      supabaseSessionRepo
    );

    this.services.getDeletedSessionsUseCase = new GetDeletedSessionsUseCase(
      sessionRepo,
      supabaseSessionRepo
    );

    this.services.createMultiSessionStudySetUseCase = new CreateMultiSessionStudySetUseCase(
      sessionRepo
    );
  }

  /**
   * Initialize sharing use cases
   */
  private initializeSharingUseCases(): void {
    if (!this.services.supabaseShareRepository) {
      return;
    }

    const shareRepo = this.services.supabaseShareRepository;

    this.services.shareSessionUseCase = new ShareSessionUseCase(shareRepo);
    this.services.removeShareUseCase = new RemoveShareUseCase(shareRepo);
    this.services.updateSharePermissionUseCase = new UpdateSharePermissionUseCase(shareRepo);
    this.services.getSessionSharesUseCase = new GetSessionSharesUseCase(shareRepo);
    this.services.getSharedSessionsUseCase = new GetSharedSessionsUseCase(shareRepo);
    this.services.acceptShareInvitationUseCase = new AcceptShareInvitationUseCase(shareRepo);

    console.log('Sharing use cases initialized');
  }

  /**
   * Initialize auth use cases
   */
  private initializeAuthUseCases(): void {
    // Auth use cases always available (they handle authentication)
    this.services.signInWithEmailUseCase = new SignInWithEmailUseCase();
    this.services.signUpWithEmailUseCase = new SignUpWithEmailUseCase();
    this.services.signInWithGoogleUseCase = new SignInWithGoogleUseCase();
    this.services.signOutUseCase = new SignOutUseCase();
    this.services.getCurrentUserUseCase = new GetCurrentUserUseCase();

    console.log('Auth use cases initialized');
  }

  /**
   * Initialize SyncManager for cloud sync
   */
  private initializeSyncManager(): void {
    if (!this.services.supabaseStorageService || !this.services.supabaseSessionRepository) {
      return;
    }

    this.services.syncManager = new SyncManager(
      this.services.sessionRepository!,
      this.services.supabaseSessionRepository,
      this.services.supabaseStorageService,
      null, // no user ID yet - set when renderer sends auth state
      this.services.deletedSessionsTracker!,
      this.services.syncOperationQueue!
    );

    console.log('SyncManager initialized with sync operation queue (waiting for user auth from renderer)');
  }

  /**
   * Initialize recording manager with auto-sync callback
   */
  private initializeRecordingManager(): void {
    const sessionRepo = this.services.sessionRepository!;
    const supabaseSessionRepo = this.services.supabaseSessionRepository || undefined;
    const syncManager = this.services.syncManager;

    this.services.recordingManager = new RecordingManager(
      async (sessionId: string) => {
        // Auto-sync after recording completes (if user is authenticated)
        if (syncManager) {
          const session = await sessionRepo.findById(sessionId);
          if (session) {
            console.log(`Auto-syncing session ${sessionId} after recording...`);
            const result = await syncManager.uploadSession(session);
            if (result.success) {
              console.log(`✓ Session ${sessionId} auto-synced successfully`);
            } else {
              console.warn(`✗ Auto-sync failed: ${result.error}`);
            }
          }
        }
      },
      supabaseSessionRepo
    );
  }

  /**
   * Initialize directory structure
   */
  private async initializeDirectories(): Promise<void> {
    try {
      await this.services.directoryManager!.initialize();
      console.log('Directory structure initialized');
    } catch (error) {
      console.error('Failed to initialize directories:', error);
    }
  }
}
