/**
 * StudyModeManager
 * 
 * Manages the Study Mode view for reviewing past recording sessions.
 * Handles session list display, filtering, and navigation.
 */

import type { Session } from '../../domain/entities/Session.js';
import { AIClient } from '../ai/AIClient.js';
import { renderMarkdown } from '../markdown-renderer.js';

export class StudyModeManager {
  private aiClient: AIClient;
  private isActive: boolean = false;
  private sessions: Session[] = [];
  private filteredSessions: Session[] = [];
  
  // UI Elements
  private studyModeView: HTMLElement;
  private recordModeView: HTMLElement;
  private studyModeBtn: HTMLButtonElement;
  private backToRecordBtn: HTMLButtonElement;
  private sessionListContainer: HTMLElement;
  private sessionDetailContainer: HTMLElement;
  
  // Filter state
  private selectedCourse: string = '';
  private searchQuery: string = '';
  private selectedTags: string[] = [];
  private sortOrder: 'newest' | 'oldest' | 'longest' | 'shortest' = 'newest';
  
  // Filter UI elements
  private searchInput: HTMLInputElement | null = null;
  private courseFilter: HTMLSelectElement | null = null;
  private sortSelect: HTMLSelectElement | null = null;
  
  // Bulk action state
  private selectedSessionIds: Set<string> = new Set();
  private bulkActionsBar: HTMLElement | null = null;
  private selectAllCheckbox: HTMLInputElement | null = null;
  private selectedCountSpan: HTMLElement | null = null;
  private bulkExportBtn: HTMLButtonElement | null = null;
  private bulkDeleteBtn: HTMLButtonElement | null = null;

  constructor() {
    // Get UI elements
    this.studyModeView = document.getElementById('study-mode-view') as HTMLElement;
    this.recordModeView = document.querySelector('.main-content') as HTMLElement;
    this.studyModeBtn = document.getElementById('study-mode-btn') as HTMLButtonElement;
    this.backToRecordBtn = document.getElementById('back-to-record-btn') as HTMLButtonElement;
    this.sessionListContainer = document.getElementById('session-list') as HTMLElement;
    this.sessionDetailContainer = document.getElementById('session-detail') as HTMLElement;
    
    // Initialize AI client
    this.aiClient = new AIClient();
    
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
    
    // Initialize filter controls
    this.initializeFilterControls();
  }
  
  /**
   * Initialize filter controls
   */
  private initializeFilterControls(): void {
    // Get filter elements
    this.searchInput = document.getElementById('study-search-input') as HTMLInputElement;
    this.courseFilter = document.getElementById('study-course-filter') as HTMLSelectElement;
    this.sortSelect = document.getElementById('study-sort-select') as HTMLSelectElement;
    
    // Get bulk action elements
    this.bulkActionsBar = document.getElementById('bulk-actions-bar') as HTMLElement;
    this.selectAllCheckbox = document.getElementById('select-all-sessions') as HTMLInputElement;
    this.selectedCountSpan = document.getElementById('selected-count') as HTMLElement;
    this.bulkExportBtn = document.getElementById('bulk-export-btn') as HTMLButtonElement;
    this.bulkDeleteBtn = document.getElementById('bulk-delete-btn') as HTMLButtonElement;
    
    // Search input
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.searchQuery = (e.target as HTMLInputElement).value;
        this.applyFilters();
        this.renderSessionList();
      });
    }
    
    // Course filter
    if (this.courseFilter) {
      this.courseFilter.addEventListener('change', (e) => {
        this.selectedCourse = (e.target as HTMLSelectElement).value;
        this.applyFilters();
        this.renderSessionList();
      });
    }
    
    // Sort select
    if (this.sortSelect) {
      this.sortSelect.addEventListener('change', (e) => {
        this.sortOrder = (e.target as HTMLSelectElement).value as any;
        this.applyFilters();
        this.renderSessionList();
      });
    }
    
    // Bulk action handlers
    if (this.selectAllCheckbox) {
      this.selectAllCheckbox.addEventListener('change', (e) => {
        this.handleSelectAll((e.target as HTMLInputElement).checked);
      });
    }
    
    if (this.bulkExportBtn) {
      this.bulkExportBtn.addEventListener('click', () => {
        this.handleBulkExport();
      });
    }
    
    if (this.bulkDeleteBtn) {
      this.bulkDeleteBtn.addEventListener('click', () => {
        this.handleBulkDelete();
      });
    }
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
    
    // Populate course filter
    this.populateCourseFilter();
    
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
    
    // Add title edit handlers
    this.attachTitleEditHandlers();
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
   * Populate course filter dropdown
   */
  private populateCourseFilter(): void {
    if (!this.courseFilter) return;
    
    // Get unique courses from sessions
    const courses = new Set<string>();
    this.sessions.forEach(session => {
      if (session.tags) {
        session.tags.forEach(tag => {
          if (tag.toLowerCase().includes('course') || tag.toLowerCase().includes('class')) {
            courses.add(tag);
          }
        });
      }
    });
    
    // Clear and populate dropdown
    this.courseFilter.innerHTML = '<option value="">All Courses</option>';
    Array.from(courses).sort().forEach(course => {
      const option = document.createElement('option');
      option.value = course;
      option.textContent = course;
      this.courseFilter!.appendChild(option);
    });
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
    
    // Check if selected
    const isSelected = this.selectedSessionIds.has(session.id);
    
    return `
      <div class="session-card ${isSelected ? 'selected' : ''}" data-session-id="${session.id}">
        <input type="checkbox" class="session-card-checkbox" data-session-id="${session.id}" ${isSelected ? 'checked' : ''}>
        <div class="session-card-header">
          <h3 class="session-title" data-session-id="${session.id}">${this.escapeHtml(session.title)}</h3>
          <button class="edit-title-btn" data-session-id="${session.id}" title="Edit title">✏️</button>
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
          <button class="action-btn delete-session-btn" data-session-id="${session.id}">
            🗑️ Delete
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Attach event handlers to session cards
   */
  private attachSessionCardHandlers(): void {
    // Checkbox handlers
    const checkboxes = document.querySelectorAll('.session-card-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        const sessionId = (checkbox as HTMLElement).dataset.sessionId;
        const isChecked = (checkbox as HTMLInputElement).checked;
        
        if (sessionId) {
          this.handleSessionSelection(sessionId, isChecked);
        }
      });
    });
    
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
    
    // Delete session buttons
    const deleteButtons = document.querySelectorAll('.delete-session-btn');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = (btn as HTMLElement).dataset.sessionId;
        if (sessionId) {
          this.deleteSession(sessionId);
        }
      });
    });
    
    // Card click (same as view button)
    const cards = document.querySelectorAll('.session-card');
    cards.forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't trigger if clicking on buttons, title, or checkbox
        const target = e.target as HTMLElement;
        if (target.closest('.action-btn') || target.closest('.edit-title-btn') || 
            target.closest('.session-title') || target.closest('.session-card-checkbox')) {
          return;
        }
        
        const sessionId = (card as HTMLElement).dataset.sessionId;
        if (sessionId) {
          this.openSessionDetail(sessionId);
        }
      });
    });
  }
  
  /**
   * Attach title edit handlers
   */
  private attachTitleEditHandlers(): void {
    // Edit buttons
    const editButtons = document.querySelectorAll('.edit-title-btn');
    editButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = (btn as HTMLElement).dataset.sessionId;
        if (sessionId) {
          this.startTitleEdit(sessionId);
        }
      });
    });
    
    // Title click to edit
    const titles = document.querySelectorAll('.session-title');
    titles.forEach(title => {
      title.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = (title as HTMLElement).dataset.sessionId;
        if (sessionId) {
          this.startTitleEdit(sessionId);
        }
      });
    });
  }
  
  /**
   * Start editing a session title
   */
  private startTitleEdit(sessionId: string): void {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const titleElement = document.querySelector(`.session-title[data-session-id="${sessionId}"]`) as HTMLElement;
    if (!titleElement) return;
    
    const currentTitle = session.title;
    
    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.className = 'title-edit-input';
    input.style.cssText = `
      width: 100%;
      padding: 4px 8px;
      font-size: 18px;
      font-weight: 600;
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
      border: 2px solid var(--accent);
      border-radius: 4px;
      outline: none;
    `;
    
    // Replace title with input
    titleElement.replaceWith(input);
    input.focus();
    input.select();
    
    // Save on blur or Enter
    const saveTitle = async () => {
      const newTitle = input.value.trim();
      
      if (newTitle && newTitle !== currentTitle) {
        try {
          // Update session title via IPC
          const result = await window.scribeCat.session.update(sessionId, { title: newTitle });
          
          if (result.success) {
            // Update local session
            session.title = newTitle;
            console.log('Title updated successfully');
          } else {
            console.error('Failed to update title:', result.error);
            alert(`Failed to update title: ${result.error}`);
          }
        } catch (error) {
          console.error('Error updating title:', error);
          alert('An error occurred while updating the title.');
        }
      }
      
      // Re-render the session list
      this.renderSessionList();
    };
    
    input.addEventListener('blur', saveTitle);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.renderSessionList();
      }
    });
  }

  /**
   * Open session detail view
   */
  private async openSessionDetail(sessionId: string): Promise<void> {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) {
      console.error('Session not found:', sessionId);
      return;
    }
    
    // Hide session list, show detail view
    this.sessionListContainer.classList.add('hidden');
    this.sessionDetailContainer.classList.remove('hidden');
    this.renderSessionDetail(session);
  }
  
  /**
   * Render session detail view
   */
  private renderSessionDetail(session: Session): void {
    const date = new Date(session.createdAt);
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
    
    const duration = this.formatDuration(session.duration);
    
    // Get course tags
    const courseTags = session.tags?.filter(tag => 
      tag.includes('course') || tag.includes('class')
    ) || [];
    const courseTagsHtml = courseTags.length > 0
      ? courseTags.map(tag => `<span class="course-badge">${this.escapeHtml(tag)}</span>`).join('')
      : '';
    
    const detailHtml = `
      <div class="session-detail-container">
        <!-- Back Button -->
        <button class="back-to-list-btn secondary-btn">
          ← Back to Sessions
        </button>
        
        <!-- Session Header -->
        <div class="session-detail-header">
          <div class="session-detail-title-row">
            <h2 class="session-detail-title" data-session-id="${session.id}">${this.escapeHtml(session.title)}</h2>
            <button class="edit-title-btn-detail" data-session-id="${session.id}" title="Edit title">✏️</button>
            ${courseTagsHtml}
          </div>
          <div class="session-detail-meta">
            <span>📅 ${formattedDate} at ${formattedTime}</span>
            <span>⏱️ ${duration}</span>
          </div>
        </div>
        
        <!-- Two Column Layout -->
        <div class="session-detail-content">
          <!-- Left Column: Recording & Transcription -->
          <div class="session-detail-left">
            <!-- Audio Player -->
            <div class="audio-player-container">
              <h3>🎧 Recording</h3>
              <div class="audio-player">
                <audio id="session-audio" preload="metadata" style="display: none;">
                  <source src="file://${session.recordingPath}" type="audio/webm">
                  Your browser does not support the audio element.
                </audio>
                
                <!-- Custom Audio Controls -->
                <div class="custom-audio-controls">
                  <!-- Play/Pause Button -->
                  <button class="audio-control-btn play-pause-btn" id="play-pause-btn" title="Play/Pause">
                    <span class="play-icon">▶</span>
                  </button>
                  
                  <!-- Time Display -->
                  <div class="audio-time-display">
                    <span id="current-time">0:00</span>
                    <span class="time-separator">/</span>
                    <span id="total-duration">0:00</span>
                  </div>
                  
                  <!-- Progress Bar -->
                  <div class="audio-progress-container" id="audio-progress-container">
                    <div class="audio-progress-bar">
                      <div class="audio-progress-buffered" id="audio-progress-buffered"></div>
                      <div class="audio-progress-played" id="audio-progress-played"></div>
                      <div class="audio-progress-handle" id="audio-progress-handle"></div>
                    </div>
                  </div>
                  
                  <!-- Volume Control -->
                  <button class="audio-control-btn volume-btn" id="volume-btn" title="Mute/Unmute">
                    <span class="volume-icon">🔊</span>
                  </button>
                </div>
                
                <div class="playback-controls">
                  <label>Playback Speed:</label>
                  <button class="speed-btn" data-speed="0.5">0.5x</button>
                  <button class="speed-btn" data-speed="0.75">0.75x</button>
                  <button class="speed-btn active" data-speed="1">1x</button>
                  <button class="speed-btn" data-speed="1.25">1.25x</button>
                  <button class="speed-btn" data-speed="1.5">1.5x</button>
                  <button class="speed-btn" data-speed="2">2x</button>
                </div>
              </div>
            </div>
            
            <!-- Content Tabs -->
            <div class="session-content-tabs">
              <button class="content-tab active" data-tab="transcription">📝 Transcription</button>
              <button class="content-tab" data-tab="notes">✍️ Notes</button>
            </div>
            
            <!-- Transcription Content -->
            <div class="session-content-panel active" data-panel="transcription">
              <div class="content-panel-inner">
                ${session.transcription 
                  ? this.renderTranscriptionSegments(session.transcription)
                  : '<div class="empty-content">No transcription available for this session.</div>'
                }
              </div>
            </div>
            
            <!-- Notes Content -->
            <div class="session-content-panel" data-panel="notes">
              <div class="content-panel-inner">
                ${session.notes 
                  ? `<div class="notes-text">${session.notes}</div>`
                  : '<div class="empty-content">No notes available for this session.</div>'
                }
              </div>
            </div>
          </div>
          
          <!-- Right Column: AI Study Tools -->
          <div class="session-detail-right">
            <div class="ai-study-tools">
              <h3 class="study-tools-title">🤖 AI Study Tools</h3>
              
              <!-- Quick Actions -->
              <div class="study-tool-section">
                <h4>Quick Actions</h4>
                <div class="study-tool-buttons">
                  <button class="study-tool-btn" id="generate-summary-btn" data-session-id="${session.id}">
                    <span class="tool-icon">📝</span>
                    <span class="tool-label">Generate Summary</span>
                  </button>
                  <button class="study-tool-btn" id="extract-concepts-btn" data-session-id="${session.id}">
                    <span class="tool-icon">💡</span>
                    <span class="tool-label">Key Concepts</span>
                  </button>
                  <button class="study-tool-btn" id="generate-flashcards-btn" data-session-id="${session.id}">
                    <span class="tool-icon">🎴</span>
                    <span class="tool-label">Create Flashcards</span>
                  </button>
                  <button class="study-tool-btn" id="generate-quiz-btn" data-session-id="${session.id}">
                    <span class="tool-icon">❓</span>
                    <span class="tool-label">Generate Quiz</span>
                  </button>
                </div>
              </div>
              
              <!-- Study Content Area -->
              <div class="study-content-area" id="study-content-area">
                <div class="study-placeholder">
                  <div class="placeholder-icon">🎓</div>
                  <p>Select a study tool above to get started</p>
                  <p class="placeholder-hint">AI-powered tools help you learn and retain information better</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="session-detail-actions">
          <button class="action-btn export-session-detail-btn" data-session-id="${session.id}">
            📤 Export Session
          </button>
          <button class="action-btn delete-session-detail-btn" data-session-id="${session.id}">
            🗑️ Delete Session
          </button>
        </div>
      </div>
    `;
    
    this.sessionDetailContainer.innerHTML = detailHtml;
    
    // Attach event handlers
    this.attachDetailViewHandlers(session);
    
    // Attach title edit handler for detail view
    const editTitleBtn = document.querySelector('.edit-title-btn-detail');
    editTitleBtn?.addEventListener('click', () => {
      this.startDetailTitleEdit(session.id);
    });
    
    // Title click to edit in detail view
    const detailTitle = document.querySelector('.session-detail-title');
    detailTitle?.addEventListener('click', () => {
      this.startDetailTitleEdit(session.id);
    });
    
    // Attach AI study tool handlers
    this.attachStudyToolHandlers(session);
  }
  
  /**
   * Attach event handlers for AI study tools
   */
  private attachStudyToolHandlers(session: Session): void {
    const studyContentArea = document.getElementById('study-content-area');
    if (!studyContentArea) return;
    
    // Generate Summary button
    const summaryBtn = document.getElementById('generate-summary-btn');
    summaryBtn?.addEventListener('click', () => {
      this.generateSummary(session, studyContentArea);
    });
    
    // Extract Key Concepts button
    const conceptsBtn = document.getElementById('extract-concepts-btn');
    conceptsBtn?.addEventListener('click', () => {
      this.extractKeyConcepts(session, studyContentArea);
    });
    
    // Generate Flashcards button
    const flashcardsBtn = document.getElementById('generate-flashcards-btn');
    flashcardsBtn?.addEventListener('click', () => {
      this.generateFlashcards(session, studyContentArea);
    });
    
    // Generate Quiz button
    const quizBtn = document.getElementById('generate-quiz-btn');
    quizBtn?.addEventListener('click', () => {
      this.generateQuiz(session, studyContentArea);
    });
  }
  
  /**
   * Generate AI summary of the session
   */
  private async generateSummary(session: Session, contentArea: HTMLElement): Promise<void> {
    // Set active state
    this.setActiveStudyTool('generate-summary-btn');
    
    // Show loading state
    contentArea.innerHTML = `
      <div class="study-loading">
        <div class="study-loading-spinner"></div>
        <div class="study-loading-text">Generating summary...</div>
      </div>
    `;
    
    try {
      // Check if transcription exists
      if (!session.transcription || !session.transcription.fullText) {
        contentArea.innerHTML = `
          <div class="study-summary">
            <div class="summary-section">
              <p style="text-align: center; color: var(--text-tertiary);">
                No transcription available for this session. Please record and transcribe a session first.
              </p>
            </div>
          </div>
        `;
        return;
      }
      
      // Generate summary using AI
      const result = await this.aiClient.generateSummary(
        session.transcription.fullText,
        session.notes || undefined
      );
      
      if (result.success && result.data) {
        // Extract summary from SummaryResult object
        let summary: string;
        if (typeof result.data === 'string') {
          summary = result.data;
        } else if (result.data && typeof result.data === 'object' && 'summary' in result.data) {
          summary = result.data.summary;
        } else {
          summary = JSON.stringify(result.data);
        }
        
        contentArea.innerHTML = `
          <div class="study-summary">
            <div class="summary-section">
              <h5>📋 Summary</h5>
              <div>${renderMarkdown(summary)}</div>
            </div>
          </div>
        `;
      } else {
        throw new Error(result.error || 'Failed to generate summary');
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      contentArea.innerHTML = `
        <div class="study-summary">
          <div class="summary-section">
            <p style="text-align: center; color: var(--record-color);">
              Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}
            </p>
            <p style="text-align: center; color: var(--text-tertiary); margin-top: 12px;">
              Make sure Claude AI is configured in Settings.
            </p>
          </div>
        </div>
      `;
    }
  }
  
  /**
   * Extract key concepts from the session
   */
  private async extractKeyConcepts(session: Session, contentArea: HTMLElement): Promise<void> {
    // Set active state
    this.setActiveStudyTool('extract-concepts-btn');
    
    // Show loading state
    contentArea.innerHTML = `
      <div class="study-loading">
        <div class="study-loading-spinner"></div>
        <div class="study-loading-text">Extracting key concepts...</div>
      </div>
    `;
    
    try {
      // Check if transcription exists
      if (!session.transcription || !session.transcription.fullText) {
        contentArea.innerHTML = `
          <div class="study-concepts">
            <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
              No transcription available for this session.
            </div>
          </div>
        `;
        return;
      }
      
      // Use AI to extract key concepts
      const prompt = `Extract the key concepts from this transcription. For each concept, provide the term and a brief definition. Format as a JSON array with objects containing "term" and "definition" fields. Limit to 5-7 most important concepts.\n\nTranscription:\n${session.transcription.fullText}`;
      
      const result = await window.scribeCat.ai.chat(prompt, [], {
        includeTranscription: false,
        includeNotes: false
      });
      
      if (result.success && result.data) {
        // result.data is a string response from AI
        let concepts: Array<{term: string; definition: string}> = [];
        
        try {
          // Handle response - may be string or object with message property
          let responseText = '';
          if (typeof result.data === 'string') {
            responseText = result.data;
          } else if (result.data && typeof result.data === 'object' && 'message' in result.data) {
            responseText = result.data.message;
          } else {
            responseText = JSON.stringify(result.data);
          }
          
          console.log('🔍 Key Concepts - Raw AI response:', responseText.substring(0, 200));
          
          // Try to find JSON in code blocks first
          let jsonText = '';
          const codeBlockMatch = responseText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
          if (codeBlockMatch) {
            jsonText = codeBlockMatch[1];
            console.log('📦 Found JSON in code block');
          } else {
            // Try to find raw JSON array
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              jsonText = jsonMatch[0];
              console.log('📄 Found raw JSON array');
            }
          }
          
          if (jsonText) {
            // Unescape the JSON string if it has escape sequences
            try {
              // Try parsing as-is first
              console.log('🔧 Attempting to parse:', jsonText.substring(0, 100));
              const parsed = JSON.parse(jsonText);
            // Validate the structure
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].term && parsed[0].definition) {
              concepts = parsed;
              } else {
                throw new Error('Invalid concept structure');
              }
            } catch (firstParseError) {
              // If first parse fails, try unescaping the string
              console.log('⚠️ First parse failed, trying to unescape...');
              const unescaped = jsonText.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
              const parsed = JSON.parse(unescaped);
              // Validate the structure
              if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].term && parsed[0].definition) {
                concepts = parsed;
              } else {
                throw new Error('Invalid concept structure');
              }
            }
          } else {
            throw new Error('No JSON array found in response');
          }
        } catch (e) {
          console.warn('Failed to parse concepts as JSON, using plain text:', e);
          // If JSON parsing fails, create a single concept from the response
          const responseText = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
          concepts = [{
            term: 'Key Concepts',
            definition: responseText
          }];
        }
        
        const conceptsHtml = concepts.map(concept => `
          <div class="concept-item">
            <div class="concept-term">${this.escapeHtml(concept.term)}</div>
            <div class="concept-definition">${renderMarkdown(concept.definition)}</div>
          </div>
        `).join('');
        
        contentArea.innerHTML = `
          <div class="study-concepts">
            ${conceptsHtml}
          </div>
        `;
      } else {
        throw new Error(result.error || 'Failed to extract concepts');
      }
    } catch (error) {
      console.error('Error extracting concepts:', error);
      contentArea.innerHTML = `
        <div class="study-concepts">
          <div style="text-align: center; padding: 20px; color: var(--record-color);">
            Failed to extract concepts: ${error instanceof Error ? error.message : 'Unknown error'}
          </div>
          <div style="text-align: center; padding: 10px; color: var(--text-tertiary);">
            Make sure Claude AI is configured in Settings.
          </div>
        </div>
      `;
    }
  }
  
  /**
   * Generate flashcards from the session
   */
  private async generateFlashcards(session: Session, contentArea: HTMLElement): Promise<void> {
    // Set active state
    this.setActiveStudyTool('generate-flashcards-btn');
    
    // Show loading state
    contentArea.innerHTML = `
      <div class="study-loading">
        <div class="study-loading-spinner"></div>
        <div class="study-loading-text">Creating flashcards...</div>
      </div>
    `;
    
    try {
      // Check if transcription exists
      if (!session.transcription || !session.transcription.fullText) {
        contentArea.innerHTML = `
          <div class="study-flashcards">
            <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
              No transcription available for this session.
            </div>
          </div>
        `;
        return;
      }
      
      // Use AI to generate flashcards
      const prompt = `Create 5-7 flashcards from this transcription. Each flashcard should have a question on the front and an answer on the back. Format as a JSON array with objects containing "question" and "answer" fields. Focus on the most important concepts and facts.\n\nTranscription:\n${session.transcription.fullText}`;
      
      const result = await window.scribeCat.ai.chat(prompt, [], {
        includeTranscription: false,
        includeNotes: false
      });
      
      if (result.success && result.data) {
        // result.data is a string response from AI
        let flashcards: Array<{question: string; answer: string}> = [];
        
        try {
          // Handle response - may be string or object with message property
          let responseText = '';
          if (typeof result.data === 'string') {
            responseText = result.data;
          } else if (result.data && typeof result.data === 'object' && 'message' in result.data) {
            responseText = result.data.message;
          } else {
            responseText = JSON.stringify(result.data);
          }
          
          console.log('🔍 Flashcards - Raw AI response:', responseText.substring(0, 200));
          
          // Try to find JSON in code blocks first
          let jsonText = '';
          const codeBlockMatch = responseText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
          if (codeBlockMatch) {
            jsonText = codeBlockMatch[1];
            console.log('📦 Found JSON in code block');
          } else {
            // Try to find raw JSON array
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              jsonText = jsonMatch[0];
              console.log('📄 Found raw JSON array');
            }
          }
          
          if (jsonText) {
            // Unescape the JSON string if it has escape sequences
            try {
              // Try parsing as-is first
              console.log('🔧 Attempting to parse:', jsonText.substring(0, 100));
              const parsed = JSON.parse(jsonText);
            // Validate the structure
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].question && parsed[0].answer) {
              flashcards = parsed;
              } else {
                throw new Error('Invalid flashcard structure');
              }
            } catch (firstParseError) {
              // If first parse fails, try unescaping the string
              console.log('⚠️ First parse failed, trying to unescape...');
              const unescaped = jsonText.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
              const parsed = JSON.parse(unescaped);
              // Validate the structure
              if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].question && parsed[0].answer) {
                flashcards = parsed;
              } else {
                throw new Error('Invalid flashcard structure');
              }
            }
          } else {
            throw new Error('No JSON array found in response');
          }
        } catch (e) {
          console.error('Failed to parse flashcards:', e);
          throw new Error('Failed to parse flashcards from AI response. The AI may not have returned the expected format.');
        }
        
        if (flashcards.length === 0) {
          throw new Error('No flashcards generated');
        }
        
        // Render flashcards with navigation
        this.renderFlashcards(flashcards, contentArea);
      } else {
        throw new Error(result.error || 'Failed to generate flashcards');
      }
    } catch (error) {
      console.error('Error generating flashcards:', error);
      contentArea.innerHTML = `
        <div class="study-flashcards">
          <div style="text-align: center; padding: 20px; color: var(--record-color);">
            Failed to generate flashcards: ${error instanceof Error ? error.message : 'Unknown error'}
          </div>
          <div style="text-align: center; padding: 10px; color: var(--text-tertiary);">
            Make sure Claude AI is configured in Settings.
          </div>
        </div>
      `;
    }
  }
  
  /**
   * Render flashcards with navigation
   */
  private renderFlashcards(flashcards: Array<{question: string; answer: string}>, contentArea: HTMLElement): void {
    let currentIndex = 0;
    let isFlipped = false;
    
    const render = () => {
      const card = flashcards[currentIndex];
      const side = isFlipped ? 'answer' : 'question';
      const label = isFlipped ? 'BACK' : 'FRONT';
      const content = isFlipped ? card.answer : card.question;
      
      contentArea.innerHTML = `
        <div class="study-flashcards">
          <div class="flashcard-controls">
            <div class="flashcard-counter">Card ${currentIndex + 1} of ${flashcards.length}</div>
            <div class="flashcard-nav">
              <button class="flashcard-nav-btn" id="prev-card-btn" ${currentIndex === 0 ? 'disabled' : ''}>← Previous</button>
              <button class="flashcard-nav-btn" id="next-card-btn" ${currentIndex === flashcards.length - 1 ? 'disabled' : ''}>Next →</button>
            </div>
          </div>
          
          <div class="flashcard ${isFlipped ? 'flipped' : ''}" id="flashcard">
            <div class="flashcard-side">
              <div class="flashcard-label">${label}</div>
              <div class="flashcard-content">${this.escapeHtml(content)}</div>
            </div>
            <div class="flashcard-hint">Click to flip</div>
          </div>
        </div>
      `;
      
      // Add event listeners
      const flashcard = document.getElementById('flashcard');
      flashcard?.addEventListener('click', () => {
        isFlipped = !isFlipped;
        render();
      });
      
      const prevBtn = document.getElementById('prev-card-btn');
      prevBtn?.addEventListener('click', () => {
        if (currentIndex > 0) {
          currentIndex--;
          isFlipped = false;
          render();
        }
      });
      
      const nextBtn = document.getElementById('next-card-btn');
      nextBtn?.addEventListener('click', () => {
        if (currentIndex < flashcards.length - 1) {
          currentIndex++;
          isFlipped = false;
          render();
        }
      });
    };
    
    render();
  }
  
  /**
   * Generate a quiz from the session
   */
  private async generateQuiz(session: Session, contentArea: HTMLElement): Promise<void> {
    // Set active state
    this.setActiveStudyTool('generate-quiz-btn');
    
    // Show loading state
    contentArea.innerHTML = `
      <div class="study-loading">
        <div class="study-loading-spinner"></div>
        <div class="study-loading-text">Generating quiz...</div>
      </div>
    `;
    
    try {
      // Check if transcription exists
      if (!session.transcription || !session.transcription.fullText) {
        contentArea.innerHTML = `
          <div class="study-quiz">
            <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
              No transcription available for this session.
            </div>
          </div>
        `;
        return;
      }
      
      // Use AI to generate quiz questions
      const prompt = `Create 5 multiple-choice quiz questions from this transcription. Each question should have 4 options (A, B, C, D) with one correct answer. Format as a JSON array with objects containing "question", "options" (array of 4 strings), and "correctAnswer" (0-3 index). Focus on testing understanding of key concepts.\n\nTranscription:\n${session.transcription.fullText}`;
      
      const result = await window.scribeCat.ai.chat(prompt, [], {
        includeTranscription: false,
        includeNotes: false
      });
      
      if (result.success && result.data) {
        // result.data is a string response from AI
        let questions: Array<{question: string; options: string[]; correctAnswer: number}> = [];
        
        try {
          // Handle response - may be string or object with message property
          let responseText = '';
          if (typeof result.data === 'string') {
            responseText = result.data;
          } else if (result.data && typeof result.data === 'object' && 'message' in result.data) {
            responseText = result.data.message;
          } else {
            responseText = JSON.stringify(result.data);
          }
          
          console.log('🔍 Quiz - Raw AI response:', responseText.substring(0, 200));
          
          // Try to find JSON in code blocks first
          let jsonText = '';
          const codeBlockMatch = responseText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
          if (codeBlockMatch) {
            jsonText = codeBlockMatch[1];
            console.log('📦 Found JSON in code block');
          } else {
            // Try to find raw JSON array
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              jsonText = jsonMatch[0];
              console.log('📄 Found raw JSON array');
            }
          }
          
          if (jsonText) {
            // Unescape the JSON string if it has escape sequences
            try {
              // Try parsing as-is first
              console.log('🔧 Attempting to parse:', jsonText.substring(0, 100));
              const parsed = JSON.parse(jsonText);
            // Validate the structure
            if (Array.isArray(parsed) && parsed.length > 0 && 
                parsed[0].question && parsed[0].options && typeof parsed[0].correctAnswer === 'number') {
              questions = parsed;
              } else {
                throw new Error('Invalid quiz question structure');
              }
            } catch (firstParseError) {
              // If first parse fails, try unescaping the string
              console.log('⚠️ First parse failed, trying to unescape...');
              const unescaped = jsonText.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
              const parsed = JSON.parse(unescaped);
              // Validate the structure
              if (Array.isArray(parsed) && parsed.length > 0 && 
                  parsed[0].question && parsed[0].options && typeof parsed[0].correctAnswer === 'number') {
                questions = parsed;
              } else {
                throw new Error('Invalid quiz question structure');
              }
            }
          } else {
            throw new Error('No JSON array found in response');
          }
        } catch (e) {
          console.error('Failed to parse quiz:', e);
          throw new Error('Failed to parse quiz from AI response. The AI may not have returned the expected format.');
        }
        
        if (questions.length === 0) {
          throw new Error('No quiz questions generated');
        }
        
        // Render quiz with interactivity
        this.renderQuiz(questions, contentArea);
      } else {
        throw new Error(result.error || 'Failed to generate quiz');
      }
    } catch (error) {
      console.error('Error generating quiz:', error);
      contentArea.innerHTML = `
        <div class="study-quiz">
          <div style="text-align: center; padding: 20px; color: var(--record-color);">
            Failed to generate quiz: ${error instanceof Error ? error.message : 'Unknown error'}
          </div>
          <div style="text-align: center; padding: 10px; color: var(--text-tertiary);">
            Make sure Claude AI is configured in Settings.
          </div>
        </div>
      `;
    }
  }
  
  /**
   * Render interactive quiz
   */
  private renderQuiz(questions: Array<{question: string; options: string[]; correctAnswer: number}>, contentArea: HTMLElement): void {
    let currentIndex = 0;
    let score = 0;
    let answered = false;
    let selectedAnswer: number | null = null;
    
    const render = () => {
      if (currentIndex >= questions.length) {
        // Quiz complete
        contentArea.innerHTML = `
          <div class="study-quiz">
            <div class="quiz-complete">
              <div class="quiz-complete-icon">🎉</div>
              <div class="quiz-complete-title">Quiz Complete!</div>
              <div class="quiz-complete-score">${score} / ${questions.length}</div>
              <p style="color: var(--text-secondary); margin: 16px 0;">
                ${score === questions.length ? 'Perfect score! Excellent work!' : 
                  score >= questions.length * 0.7 ? 'Great job! You have a good understanding.' :
                  'Keep studying! Review the material and try again.'}
              </p>
              <button class="quiz-restart-btn" id="restart-quiz-btn">Restart Quiz</button>
            </div>
          </div>
        `;
        
        const restartBtn = document.getElementById('restart-quiz-btn');
        restartBtn?.addEventListener('click', () => {
          currentIndex = 0;
          score = 0;
          answered = false;
          selectedAnswer = null;
          render();
        });
        return;
      }
      
      const question = questions[currentIndex];
      const optionLabels = ['A', 'B', 'C', 'D'];
      
      const optionsHtml = question.options.map((option, index) => {
        let className = 'quiz-option';
        if (answered) {
          if (index === question.correctAnswer) {
            className += ' correct';
          } else if (index === selectedAnswer) {
            className += ' incorrect';
          }
        } else if (index === selectedAnswer) {
          className += ' selected';
        }
        
        return `
          <div class="quiz-option" data-index="${index}">
            ${optionLabels[index]}: ${this.escapeHtml(option)}
          </div>
        `;
      }).join('');
      
      contentArea.innerHTML = `
        <div class="study-quiz">
          <div class="quiz-progress">
            <div class="quiz-question-number">Question ${currentIndex + 1} of ${questions.length}</div>
            <div class="quiz-score">Score: ${score}/${currentIndex}</div>
          </div>
          
          <div class="quiz-question">
            <div class="quiz-question-text">${this.escapeHtml(question.question)}</div>
            <div class="quiz-options" id="quiz-options">
              ${optionsHtml}
            </div>
            ${answered ? `
              <div class="quiz-feedback">
                ${selectedAnswer === question.correctAnswer ? 
                  '✅ Correct! Well done.' : 
                  `❌ Incorrect. The correct answer is ${optionLabels[question.correctAnswer]}.`}
              </div>
              <button class="quiz-next-btn" id="next-question-btn">
                ${currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
              </button>
            ` : ''}
          </div>
        </div>
      `;
      
      // Add event listeners for options
      if (!answered) {
        const options = document.querySelectorAll('.quiz-option');
        options.forEach((option, index) => {
          option.addEventListener('click', () => {
            selectedAnswer = index;
            answered = true;
            if (index === question.correctAnswer) {
              score++;
            }
            render();
          });
        });
      }
      
      // Add event listener for next button
      if (answered) {
        const nextBtn = document.getElementById('next-question-btn');
        nextBtn?.addEventListener('click', () => {
          currentIndex++;
          answered = false;
          selectedAnswer = null;
          render();
        });
      }
    };
    
    render();
  }
  
  /**
   * Set active state for study tool buttons
   */
  private setActiveStudyTool(activeButtonId: string): void {
    // Remove active class from all buttons
    const allButtons = document.querySelectorAll('.study-tool-btn');
    allButtons.forEach(btn => btn.classList.remove('active'));
    
    // Add active class to clicked button
    const activeButton = document.getElementById(activeButtonId);
    activeButton?.classList.add('active');
  }
  
  /**
   * Start editing title in detail view
   */
  private startDetailTitleEdit(sessionId: string): void {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const titleElement = document.querySelector('.session-detail-title') as HTMLElement;
    if (!titleElement) return;
    
    const currentTitle = session.title;
    
    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.className = 'title-edit-input-detail';
    input.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      font-size: 28px;
      font-weight: 600;
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
      border: 2px solid var(--accent);
      border-radius: 4px;
      outline: none;
    `;
    
    // Replace title with input
    titleElement.replaceWith(input);
    input.focus();
    input.select();
    
    // Save on blur or Enter
    const saveTitle = async () => {
      const newTitle = input.value.trim();
      
      if (newTitle && newTitle !== currentTitle) {
        try {
          // Update session title via IPC
          const result = await window.scribeCat.session.update(sessionId, { title: newTitle });
          
          if (result.success) {
            // Update local session
            session.title = newTitle;
            console.log('Title updated successfully');
          } else {
            console.error('Failed to update title:', result.error);
            alert(`Failed to update title: ${result.error}`);
          }
        } catch (error) {
          console.error('Error updating title:', error);
          alert('An error occurred while updating the title.');
        }
      }
      
      // Re-render the detail view
      this.renderSessionDetail(session);
    };
    
    input.addEventListener('blur', saveTitle);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.renderSessionDetail(session);
      }
    });
  }
  
  /**
   * Attach event handlers for detail view
   */
  private attachDetailViewHandlers(session: Session): void {
    // Back button
    const backBtn = document.querySelector('.back-to-list-btn');
    backBtn?.addEventListener('click', () => {
      // Hide detail view, show list view
      this.sessionDetailContainer.classList.add('hidden');
      this.sessionListContainer.classList.remove('hidden');
    });
    
    // Audio player setup
    const audioElement = document.getElementById('session-audio') as HTMLAudioElement;
    
    if (audioElement) {
      // Initialize custom audio controls with the session duration
      this.initializeCustomAudioControls(audioElement, session.duration);
      
      // Audio player speed controls
      const speedButtons = document.querySelectorAll('.speed-btn');
      
      speedButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const speed = parseFloat((btn as HTMLElement).dataset.speed || '1');
          if (audioElement) {
            audioElement.playbackRate = speed;
          }
          
          // Update active state
          speedButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });
      
      // Active segment highlighting - listen to audio timeupdate
      if (session.transcription?.segments) {
        audioElement.addEventListener('timeupdate', () => {
          this.updateActiveSegment(audioElement.currentTime);
        });
      }
    }
    
    // Content tabs
    const tabs = document.querySelectorAll('.content-tab');
    const panels = document.querySelectorAll('.session-content-panel');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = (tab as HTMLElement).dataset.tab;
        
        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update active panel
        panels.forEach(p => {
          const panel = p as HTMLElement;
          if (panel.dataset.panel === tabName) {
            panel.classList.add('active');
          } else {
            panel.classList.remove('active');
          }
        });
      });
    });
    
    // Export button
    const exportBtn = document.querySelector('.export-session-detail-btn');
    exportBtn?.addEventListener('click', () => {
      this.exportSession(session.id);
    });
    
    // Delete button
    const deleteBtn = document.querySelector('.delete-session-detail-btn');
    deleteBtn?.addEventListener('click', async () => {
      await this.deleteSession(session.id);
      // If delete was successful, go back to list
      if (!this.sessions.find(s => s.id === session.id)) {
        this.renderSessionList();
      }
    });
    
    // Timestamp click handlers - seek audio to segment time
    const segments = document.querySelectorAll('.transcription-segment');
    segments.forEach(segment => {
      segment.addEventListener('click', () => {
        const startTime = parseFloat((segment as HTMLElement).dataset.startTime || '0');
        if (audioElement && !isNaN(startTime)) {
          audioElement.currentTime = startTime;
          // Auto-play if not already playing
          if (audioElement.paused) {
            audioElement.play().catch(err => console.error('Playback failed:', err));
          }
        }
      });
    });
  }
  
  
  /**
   * Initialize custom audio controls
   */
  private async initializeCustomAudioControls(audioElement: HTMLAudioElement, sessionDuration: number): Promise<void> {
    const playPauseBtn = document.getElementById('play-pause-btn');
    const volumeBtn = document.getElementById('volume-btn');
    const progressContainer = document.getElementById('audio-progress-container');
    const progressPlayed = document.getElementById('audio-progress-played');
    const progressHandle = document.getElementById('audio-progress-handle');
    const progressBuffered = document.getElementById('audio-progress-buffered');
    const currentTimeDisplay = document.getElementById('current-time');
    const totalDurationDisplay = document.getElementById('total-duration');
    
    if (!playPauseBtn || !progressContainer || !progressPlayed || !progressHandle) {
      console.error('Custom audio control elements not found');
      return;
    }
    
    console.log('🎵 Initializing custom audio controls');
    console.log('Session duration:', sessionDuration);
    
    let isDragging = false;
    
    // Use session duration directly (stored when recording was created)
    const actualDuration = sessionDuration;
    
    // Set the duration display immediately
    if (totalDurationDisplay && actualDuration) {
      totalDurationDisplay.textContent = this.formatTime(actualDuration);
      console.log('✅ Set duration display:', this.formatTime(actualDuration));
    }
    
    // Play/Pause button
    playPauseBtn.addEventListener('click', () => {
      if (audioElement.paused) {
        audioElement.play().catch(err => console.error('Playback failed:', err));
      } else {
        audioElement.pause();
      }
    });
    
    // Update play/pause button icon
    audioElement.addEventListener('play', () => {
      const icon = playPauseBtn.querySelector('.play-icon');
      if (icon) icon.textContent = '⏸';
      playPauseBtn.classList.add('playing');
    });
    
    audioElement.addEventListener('pause', () => {
      const icon = playPauseBtn.querySelector('.play-icon');
      if (icon) icon.textContent = '▶';
      playPauseBtn.classList.remove('playing');
    });
    
    // Volume button
    if (volumeBtn) {
      volumeBtn.addEventListener('click', () => {
        audioElement.muted = !audioElement.muted;
        const icon = volumeBtn.querySelector('.volume-icon');
        if (icon) {
          icon.textContent = audioElement.muted ? '🔇' : '🔊';
        }
      });
    }
    
    // Update duration when metadata loads (but don't overwrite if we already have actualDuration)
    audioElement.addEventListener('loadedmetadata', () => {
      console.log('✅ Audio metadata loaded');
      console.log('Duration from audio element:', audioElement.duration);
      // Only update if we don't have actualDuration or if audio element has valid duration
      if (totalDurationDisplay && !actualDuration && audioElement.duration && isFinite(audioElement.duration)) {
        totalDurationDisplay.textContent = this.formatTime(audioElement.duration);
      }
    });
    
    // Add error handling
    audioElement.addEventListener('error', (e) => {
      console.error('❌ Audio error:', e);
      console.error('Error code:', audioElement.error?.code);
      console.error('Error message:', audioElement.error?.message);
    });
    
    audioElement.addEventListener('canplay', () => {
      console.log('✅ Audio can play');
    });
    
    // Update progress bar and time display
    audioElement.addEventListener('timeupdate', () => {
      if (!isDragging && actualDuration && isFinite(actualDuration)) {
        const progress = (audioElement.currentTime / actualDuration) * 100;
        
        if (progressPlayed) {
          progressPlayed.style.width = `${progress}%`;
        }
        if (progressHandle) {
          progressHandle.style.left = `${progress}%`;
        }
      }
      
      if (currentTimeDisplay) {
        currentTimeDisplay.textContent = this.formatTime(audioElement.currentTime);
      }
    });
    
    // Force initial update
    if (audioElement.readyState >= 1) {
      console.log('Audio already has metadata, updating duration');
      if (totalDurationDisplay && audioElement.duration) {
        totalDurationDisplay.textContent = this.formatTime(audioElement.duration);
      }
    }
    
    // Update buffered progress
    audioElement.addEventListener('progress', () => {
      if (audioElement.buffered.length > 0 && progressBuffered) {
        const bufferedEnd = audioElement.buffered.end(audioElement.buffered.length - 1);
        const bufferedProgress = (bufferedEnd / audioElement.duration) * 100;
        progressBuffered.style.width = `${bufferedProgress}%`;
      }
    });
    
    // Progress bar click to seek
    const seek = (e: MouseEvent) => {
      const rect = progressContainer.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      const seekTime = pos * actualDuration;
      
      if (!isNaN(seekTime) && isFinite(seekTime)) {
        audioElement.currentTime = seekTime;
      }
    };
    
    progressContainer.addEventListener('click', seek);
    
    // Progress bar drag to seek
    const startDrag = (e: MouseEvent) => {
      isDragging = true;
      seek(e);
    };
    
    const drag = (e: MouseEvent) => {
      if (isDragging) {
        seek(e);
      }
    };
    
    const endDrag = () => {
      isDragging = false;
    };
    
    progressContainer.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      // Only handle if audio player is visible
      if (!this.sessionDetailContainer.classList.contains('hidden')) {
        if (e.code === 'Space' && e.target === document.body) {
          e.preventDefault();
          if (audioElement.paused) {
            audioElement.play().catch(err => console.error('Playback failed:', err));
          } else {
            audioElement.pause();
          }
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          audioElement.currentTime = Math.max(0, audioElement.currentTime - 5);
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          audioElement.currentTime = Math.min(audioElement.duration, audioElement.currentTime + 5);
        }
      }
    });
  }
  
  /**
   * Format time in MM:SS format
   */
  private formatTime(seconds: number): string {
    if (isNaN(seconds) || !isFinite(seconds)) {
      return '0:00';
    }
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  /**
   * Update active segment based on current audio time
   */
  private updateActiveSegment(currentTime: number): void {
    const segments = document.querySelectorAll('.transcription-segment');
    
    segments.forEach(segment => {
      const startTime = parseFloat((segment as HTMLElement).dataset.startTime || '0');
      const endTime = parseFloat((segment as HTMLElement).dataset.endTime || '0');
      
      // Check if current time is within this segment's range
      if (currentTime >= startTime && currentTime < endTime) {
        segment.classList.add('active');
      } else {
        segment.classList.remove('active');
      }
    });
    
    // No auto-scroll - let users manually scroll while listening
  }
  

  /**
   * Render transcription segments with clickable timestamps
   */
  private renderTranscriptionSegments(transcription: any): string {
    // If no segments, fall back to full text
    if (!transcription.segments || transcription.segments.length === 0) {
      return `<div class="transcription-text">${this.escapeHtml(transcription.fullText)}</div>`;
    }
    
    // Render each segment with timestamp
    const segmentsHtml = transcription.segments.map((segment: any, index: number) => {
      const timestamp = this.formatTimestamp(segment.startTime);
      return `
        <div class="transcription-segment" data-start-time="${segment.startTime}" data-end-time="${segment.endTime}" data-segment-index="${index}">
          <span class="segment-timestamp">[${timestamp}]</span>
          <span class="segment-text">${this.escapeHtml(segment.text)}</span>
        </div>
      `;
    }).join('');
    
    return `<div class="transcription-segments">${segmentsHtml}</div>`;
  }
  
  /**
   * Format timestamp from seconds to MM:SS format
   */
  private formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
   * Delete a session with confirmation
   */
  private async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) {
      console.error('Session not found:', sessionId);
      return;
    }
    
    // Show confirmation dialog
    const confirmed = confirm(
      `Delete "${session.title}"?\n\n` +
      `This will permanently delete the recording, transcription, and notes.\n` +
      `This action cannot be undone.`
    );
    
    if (!confirmed) {
      return;
    }
    
    try {
      // Delete via IPC
      const result = await window.scribeCat.session.delete(sessionId);
      
      if (result.success) {
        console.log('Session deleted successfully');
        // Refresh the session list
        await this.loadSessions();
        this.renderSessionList();
      } else {
        console.error('Failed to delete session:', result.error);
        alert(`Failed to delete session: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('An error occurred while deleting the session.');
    }
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
   * Handle session selection
   */
  private handleSessionSelection(sessionId: string, isSelected: boolean): void {
    if (isSelected) {
      this.selectedSessionIds.add(sessionId);
    } else {
      this.selectedSessionIds.delete(sessionId);
    }
    
    this.updateBulkActionsBar();
    this.updateSessionCardSelection(sessionId, isSelected);
  }
  
  /**
   * Handle select all checkbox
   */
  private handleSelectAll(isChecked: boolean): void {
    if (isChecked) {
      // Select all filtered sessions
      this.filteredSessions.forEach(session => {
        this.selectedSessionIds.add(session.id);
      });
    } else {
      // Deselect all
      this.selectedSessionIds.clear();
    }
    
    this.updateBulkActionsBar();
    this.renderSessionList();
  }
  
  /**
   * Update bulk actions bar visibility and state
   */
  private updateBulkActionsBar(): void {
    const count = this.selectedSessionIds.size;
    
    if (!this.bulkActionsBar || !this.selectedCountSpan || 
        !this.bulkExportBtn || !this.bulkDeleteBtn || !this.selectAllCheckbox) {
      return;
    }
    
    // Show/hide bulk actions bar
    if (count > 0) {
      this.bulkActionsBar.classList.remove('hidden');
    } else {
      this.bulkActionsBar.classList.add('hidden');
    }
    
    // Update count text
    this.selectedCountSpan.textContent = `${count} selected`;
    
    // Update select all checkbox state
    const allSelected = this.filteredSessions.length > 0 && 
                       count === this.filteredSessions.length;
    this.selectAllCheckbox.checked = allSelected;
    this.selectAllCheckbox.indeterminate = count > 0 && !allSelected;
    
    // Enable/disable action buttons
    this.bulkExportBtn.disabled = count === 0;
    this.bulkDeleteBtn.disabled = count === 0;
  }
  
  /**
   * Update session card selection state
   */
  private updateSessionCardSelection(sessionId: string, isSelected: boolean): void {
    const card = document.querySelector(`.session-card[data-session-id="${sessionId}"]`);
    if (card) {
      if (isSelected) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    }
  }
  
  /**
   * Handle bulk export
   */
  private async handleBulkExport(): Promise<void> {
    const sessionIds = Array.from(this.selectedSessionIds);
    
    if (sessionIds.length === 0) {
      return;
    }
    
    const confirmed = confirm(
      `Export ${sessionIds.length} session${sessionIds.length > 1 ? 's' : ''}?\n\n` +
      `This will export all selected sessions to your chosen location.`
    );
    
    if (!confirmed) {
      return;
    }
    
    // TODO: Implement bulk export functionality
    alert(`Bulk export functionality coming soon!\n${sessionIds.length} sessions selected.`);
    
    // Clear selection after export
    this.selectedSessionIds.clear();
    this.updateBulkActionsBar();
    this.renderSessionList();
  }
  
  /**
   * Handle bulk delete
   */
  private async handleBulkDelete(): Promise<void> {
    const sessionIds = Array.from(this.selectedSessionIds);
    
    if (sessionIds.length === 0) {
      return;
    }
    
    const confirmed = confirm(
      `Delete ${sessionIds.length} session${sessionIds.length > 1 ? 's' : ''}?\n\n` +
      `This will permanently delete the recordings, transcriptions, and notes.\n` +
      `This action cannot be undone.`
    );
    
    if (!confirmed) {
      return;
    }
    
    try {
      let successCount = 0;
      let failCount = 0;
      
      // Delete each session
      for (const sessionId of sessionIds) {
        try {
          const result = await window.scribeCat.session.delete(sessionId);
          if (result.success) {
            successCount++;
          } else {
            failCount++;
            console.error(`Failed to delete session ${sessionId}:`, result.error);
          }
        } catch (error) {
          failCount++;
          console.error(`Error deleting session ${sessionId}:`, error);
        }
      }
      
      // Show result
      if (failCount === 0) {
        console.log(`Successfully deleted ${successCount} session(s)`);
      } else {
        alert(`Deleted ${successCount} session(s).\nFailed to delete ${failCount} session(s).`);
      }
      
      // Clear selection and refresh
      this.selectedSessionIds.clear();
      await this.loadSessions();
      this.updateBulkActionsBar();
      this.renderSessionList();
      
    } catch (error) {
      console.error('Error during bulk delete:', error);
      alert('An error occurred during bulk delete.');
    }
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
