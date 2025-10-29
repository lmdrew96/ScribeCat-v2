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
  
  // Filter UI elements
  private searchInput: HTMLInputElement | null = null;
  private courseFilter: HTMLSelectElement | null = null;
  private sortSelect: HTMLSelectElement | null = null;

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
    
    return `
      <div class="session-card" data-session-id="${session.id}">
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
        // Don't trigger if clicking on buttons or title
        const target = e.target as HTMLElement;
        if (target.closest('.action-btn') || target.closest('.edit-title-btn') || target.closest('.session-title')) {
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
    this.sessionListContainer.innerHTML = '';
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
      <div class="session-detail-view">
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
        
        <!-- Audio Player -->
        <div class="audio-player-container">
          <h3>🎧 Recording</h3>
          <div class="audio-player">
            <audio id="session-audio" controls preload="metadata">
              <source src="file://${session.recordingPath}" type="audio/webm">
              Your browser does not support the audio element.
            </audio>
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
              ? `<div class="notes-text">${this.escapeHtml(session.notes)}</div>`
              : '<div class="empty-content">No notes available for this session.</div>'
            }
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
    
    this.sessionListContainer.innerHTML = detailHtml;
    
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
      this.renderSessionList();
    });
    
    // Audio player speed controls
    const audioElement = document.getElementById('session-audio') as HTMLAudioElement;
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
    if (audioElement && session.transcription?.segments) {
      audioElement.addEventListener('timeupdate', () => {
        this.updateActiveSegment(audioElement.currentTime);
      });
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
   * Update active segment based on current audio time
   */
  private updateActiveSegment(currentTime: number): void {
    const segments = document.querySelectorAll('.transcription-segment');
    let activeSegment: Element | null = null;
    let previousActiveSegment: Element | null = null;
    
    segments.forEach(segment => {
      const wasActive = segment.classList.contains('active');
      const startTime = parseFloat((segment as HTMLElement).dataset.startTime || '0');
      const endTime = parseFloat((segment as HTMLElement).dataset.endTime || '0');
      
      // Check if current time is within this segment's range
      if (currentTime >= startTime && currentTime < endTime) {
        segment.classList.add('active');
        activeSegment = segment;
      } else {
        if (wasActive) {
          previousActiveSegment = segment;
        }
        segment.classList.remove('active');
      }
    });
    
    // Only auto-scroll if the active segment changed (not on every timeupdate)
    if (activeSegment && activeSegment !== previousActiveSegment) {
      this.scrollToActiveSegment(activeSegment as HTMLElement);
    }
  }
  
  /**
   * Scroll to keep active segment visible
   */
  private scrollToActiveSegment(segment: HTMLElement): void {
    const panel = document.querySelector('.session-content-panel.active');
    if (!panel) return;
    
    const panelRect = panel.getBoundingClientRect();
    const segmentRect = segment.getBoundingClientRect();
    
    // Add buffer zone - only scroll if segment is significantly out of view
    const buffer = 100; // pixels
    const isAboveView = segmentRect.top < (panelRect.top + buffer);
    const isBelowView = segmentRect.bottom > (panelRect.bottom - buffer);
    
    if (isAboveView || isBelowView) {
      // Scroll segment into view with smooth behavior
      segment.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
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
