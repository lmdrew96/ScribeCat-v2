/**
 * StudyModeManager
 * 
 * Manages the Study Mode view for reviewing past recording sessions.
 * Handles session list display, filtering, and navigation.
 */

import type { Session } from '../../domain/entities/Session.js';

export class StudyModeManager {
  private isActive: boolean = false;
  private sessions: Session[] = [];
  private filteredSessions: Session[] = [];
  
  // UI Elements
  private studyModeView: HTMLElement;
  private recordModeView: HTMLElement;
  private studyModeBtn: HTMLButtonElement;
  private backToRecordBtn: HTMLButtonElement;
  private sessionListContainer: HTMLElement;
  
  // Filter state
  private selectedCourse: string = '';
  private searchQuery: string = '';
  private selectedTags: string[] = [];
  private sortOrder: 'newest' | 'oldest' | 'longest' | 'shortest' = 'newest';

  constructor() {
    // Get UI elements
    this.studyModeView = document.getElementById('study-mode-view') as HTMLElement;
    this.recordModeView = document.querySelector('.main-content') as HTMLElement;
    this.studyModeBtn = document.getElementById('study-mode-btn') as HTMLButtonElement;
    this.backToRecordBtn = document.getElementById('back-to-record-btn') as HTMLButtonElement;
    this.sessionListContainer = document.getElementById('session-list') as HTMLElement;
    
    this.initializeEventListeners();
  }

  /**
   * Initialize the study mode manager
   */
  async initialize(): Promise<void> {
    try {
      await this.loadSessions();
      console.log('StudyModeManager initialized');
    } catch (error) {
      console.error('Failed to initialize StudyModeManager:', error);
    }
  }

  /**
   * Initialize event listeners
   */
  private initializeEventListeners(): void {
    // Toggle to study mode
    this.studyModeBtn.addEventListener('click', () => this.show());
    
    // Back to record mode
    this.backToRecordBtn.addEventListener('click', () => this.hide());
  }

  /**
   * Load all sessions from storage
   */
  private async loadSessions(): Promise<void> {
    try {
      const result = await window.scribeCat.session.list();
      
      if (result.success) {
        // Handle both 'data' and 'sessions' response formats
        const sessionsData = result.data || result.sessions || [];
        this.sessions = sessionsData;
        this.applyFilters();
        console.log(`Loaded ${this.sessions.length} sessions`);
      } else {
        console.error('Failed to load sessions:', result.error);
        this.sessions = [];
        this.filteredSessions = [];
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
      this.sessions = [];
      this.filteredSessions = [];
    }
  }

  /**
   * Show study mode view
   */
  public async show(): Promise<void> {
    // Reload sessions to get latest data
    await this.loadSessions();
    
    // Hide record mode, show study mode
    this.recordModeView.classList.add('hidden');
    this.studyModeView.classList.remove('hidden');
    
    // Update button state
    this.studyModeBtn.classList.add('active');
    
    // Render session list
    this.renderSessionList();
    
    this.isActive = true;
    console.log('Study mode activated');
  }

  /**
   * Hide study mode view
   */
  public hide(): void {
    // Show record mode, hide study mode
    this.studyModeView.classList.add('hidden');
    this.recordModeView.classList.remove('hidden');
    
    // Update button state
    this.studyModeBtn.classList.remove('active');
    
    this.isActive = false;
    console.log('Study mode deactivated');
  }

  /**
   * Apply filters to session list
   */
  private applyFilters(): void {
    this.filteredSessions = this.sessions.filter(session => {
      // Course filter
      if (this.selectedCourse && session.tags) {
        const hasCourse = session.tags.some(tag => 
          tag.toLowerCase().includes(this.selectedCourse.toLowerCase())
        );
        if (!hasCourse) return false;
      }
      
      // Search filter (searches title and transcription)
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        const matchesTitle = session.title.toLowerCase().includes(query);
        const matchesTranscription = session.transcription?.fullText.toLowerCase().includes(query);
        if (!matchesTitle && !matchesTranscription) return false;
      }
      
      // Tag filter
      if (this.selectedTags.length > 0 && session.tags) {
        const hasTag = this.selectedTags.some(tag => 
          session.tags.includes(tag)
        );
        if (!hasTag) return false;
      }
      
      return true;
    });
    
    // Apply sorting
    this.sortSessions();
  }

  /**
   * Sort filtered sessions
   */
  private sortSessions(): void {
    this.filteredSessions.sort((a, b) => {
      switch (this.sortOrder) {
        case 'newest':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'oldest':
          return a.createdAt.getTime() - b.createdAt.getTime();
        case 'longest':
          return b.duration - a.duration;
        case 'shortest':
          return a.duration - b.duration;
        default:
          return 0;
      }
    });
  }

  /**
   * Render the session list
   */
  private renderSessionList(): void {
    if (this.filteredSessions.length === 0) {
      this.renderEmptyState();
      return;
    }
    
    const sessionCards = this.filteredSessions.map(session => 
      this.createSessionCard(session)
    ).join('');
    
    this.sessionListContainer.innerHTML = sessionCards;
    
    // Add click handlers to session cards
    this.attachSessionCardHandlers();
  }

  /**
   * Render empty state
   */
  private renderEmptyState(): void {
    const hasFilters = this.selectedCourse || this.searchQuery || this.selectedTags.length > 0;
    
    if (hasFilters) {
      this.sessionListContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3>No sessions found</h3>
          <p>Try adjusting your filters or search query</p>
        </div>
      `;
    } else {
      this.sessionListContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📚</div>
          <h3>No recording sessions yet</h3>
          <p>Start recording to create your first session!</p>
          <button id="start-recording-prompt" class="primary-btn">Start Recording</button>
        </div>
      `;
      
      // Add handler for start recording button
      const startBtn = document.getElementById('start-recording-prompt');
      startBtn?.addEventListener('click', () => this.hide());
    }
  }

  /**
   * Create HTML for a session card
   */
  private createSessionCard(session: Session): string {
    const date = new Date(session.createdAt);
    const formattedDate = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const formattedTime = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
    
    const duration = this.formatDuration(session.duration);
    
    // Get transcription preview
    const transcriptionPreview = session.transcription 
      ? session.transcription.fullText.substring(0, 150) + '...'
      : 'No transcription available';
    
    // Get course tag if exists
    const courseTags = session.tags?.filter(tag => 
      tag.includes('course') || tag.includes('class')
    ) || [];
    const courseTag = courseTags.length > 0 
      ? `<span class="course-badge">${courseTags[0]}</span>`
      : '';
    
    // Status indicators
    const hasTranscription = session.transcription ? '✓ Transcribed' : '';
    const hasNotes = session.notes ? '✓ Notes' : '';
    const indicators = [hasTranscription, hasNotes].filter(Boolean).join(' • ');
    
    return `
      <div class="session-card" data-session-id="${session.id}">
        <div class="session-card-header">
          <h3 class="session-title">${this.escapeHtml(session.title)}</h3>
          ${courseTag}
        </div>
        
        <div class="session-meta">
          <span class="session-date">📅 ${formattedDate} at ${formattedTime}</span>
          <span class="session-duration">⏱️ ${duration}</span>
        </div>
        
        <div class="session-preview">
          ${this.escapeHtml(transcriptionPreview)}
        </div>
        
        ${indicators ? `<div class="session-indicators">${indicators}</div>` : ''}
        
        <div class="session-actions">
          <button class="action-btn view-session-btn" data-session-id="${session.id}">
            View Session
          </button>
          <button class="action-btn export-session-btn" data-session-id="${session.id}">
            Export
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Attach event handlers to session cards
   */
  private attachSessionCardHandlers(): void {
    // View session buttons
    const viewButtons = document.querySelectorAll('.view-session-btn');
    viewButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = (btn as HTMLElement).dataset.sessionId;
        if (sessionId) {
          this.openSessionDetail(sessionId);
        }
      });
    });
    
    // Export session buttons
    const exportButtons = document.querySelectorAll('.export-session-btn');
    exportButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = (btn as HTMLElement).dataset.sessionId;
        if (sessionId) {
          this.exportSession(sessionId);
        }
      });
    });
    
    // Card click (same as view button)
    const cards = document.querySelectorAll('.session-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const sessionId = (card as HTMLElement).dataset.sessionId;
        if (sessionId) {
          this.openSessionDetail(sessionId);
        }
      });
    });
  }

  /**
   * Open session detail view
   */
  private openSessionDetail(sessionId: string): void {
    console.log('Opening session detail:', sessionId);
    // TODO: Implement session detail view in Phase 2
    alert(`Session detail view coming soon!\nSession ID: ${sessionId}`);
  }

  /**
   * Export a session
   */
  private async exportSession(sessionId: string): Promise<void> {
    console.log('Exporting session:', sessionId);
    // TODO: Integrate with ExportManager
    alert(`Export functionality coming soon!\nSession ID: ${sessionId}`);
  }

  /**
   * Format duration in MM:SS format
   */
  private formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Check if study mode is active
   */
  public isStudyModeActive(): boolean {
    return this.isActive;
  }

  /**
   * Refresh session list
   */
  public async refresh(): Promise<void> {
    await this.loadSessions();
    if (this.isActive) {
      this.renderSessionList();
    }
  }
}
