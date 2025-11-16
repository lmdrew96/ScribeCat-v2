/**
 * StudyModeAIToolsManager
 *
 * Handles AI study tools with inline chat interface.
 */

import type { Session } from '../../../domain/entities/Session.js';
import { AISummaryManager } from '../../services/AISummaryManager.js';
import { SmartSuggestionEngine, type SuggestionAction } from '../../ai/SmartSuggestionEngine.js';
import { ContentAnalyzer } from '../../ai/ContentAnalyzer.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('StudyModeAIToolsManager');

export class StudyModeAIToolsManager {
  private aiSummaryManager: AISummaryManager;
  private studyContentArea: HTMLElement | null = null;
  private aiToolsContainer: HTMLElement | null = null;
  private suggestionEngine: SmartSuggestionEngine;
  private contentAnalyzer: ContentAnalyzer;
  private currentSession: Session | null = null;

  constructor(aiSummaryManager: AISummaryManager) {
    this.aiSummaryManager = aiSummaryManager;

    // Initialize AI components
    this.contentAnalyzer = new ContentAnalyzer();
    this.suggestionEngine = new SmartSuggestionEngine(this.contentAnalyzer);
  }

  /**
   * Initialize AI tools for a session
   */
  initialize(session: Session): void {
    this.studyContentArea = document.getElementById('study-content-area');
    // Target the right column version specifically (not the tab version)
    this.aiToolsContainer = document.querySelector('.session-detail-right .study-tool-section');

    if (!this.studyContentArea) {
      logger.warn('Study content area not found');
      return;
    }

    if (!this.aiToolsContainer) {
      logger.warn('AI tools container not found in right column');
      return;
    }

    // Set current session
    this.currentSession = session;

    // Create inline chat interface in place of button grid
    this.createInlineChat();

    // Also create chat interface in tab version for small window mode
    const aiToolsTabContainer = document.querySelector('.study-tool-section-tab');
    if (aiToolsTabContainer) {
      const chatsHTML = this.generateChatHTML();
      aiToolsTabContainer.innerHTML = chatsHTML;

      // Setup event listeners for tab version
      this.setupChatEventListenersForContainer(aiToolsTabContainer);
      this.setupChipEventListenersForContainer(aiToolsTabContainer);

      // Note: Content is now rendered directly to the active content area
      // instead of being mirrored, so event listeners work correctly
    }

    // Analyze content and generate initial suggestions
    this.analyzeSessionContent(session);

    logger.info(`Initialized AI tools for session: ${session.id}, type: ${session.type}, isMultiSession: ${session.isMultiSessionStudySet ? session.isMultiSessionStudySet() : 'N/A'}`);
  }

  /**
   * Generate chat HTML
   */
  private generateChatHTML(): string {
    // Generate all 8 AI tool chips (learn mode merged into flashcards)
    const allTools: SuggestionAction[] = [
      'summary',
      'concept',
      'flashcards',
      'quiz',
      'weak_spots',
      'eli5',
      'study_plan',
      'concept_map'
    ];

    const chipsHTML = allTools.map(action => {
      const { icon, label } = this.getActionMetadata(action);
      return `
        <button class="suggestion-chip" data-action="${action}">
          <span class="chip-icon">${icon}</span>
          <span class="chip-label">${label}</span>
        </button>
      `;
    }).join('');

    return `
      <div class="inline-ai-chat">
        <div class="chat-suggestions">
          ${chipsHTML}
        </div>
        <div class="chat-input-container">
          <input
            type="text"
            class="chat-input"
            placeholder="Ask AI anything... (e.g., 'create flashcards', 'quiz me', 'summarize')"
            autocomplete="off"
          />
          <button class="chat-send-btn" title="Send message">
            <span>→</span>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Create inline chat interface
   */
  private createInlineChat(): void {
    if (!this.aiToolsContainer) return;

    const chatHTML = this.generateChatHTML();
    this.aiToolsContainer.innerHTML = chatHTML;
    this.setupChatEventListenersForContainer(this.aiToolsContainer);
    this.setupChipEventListenersForContainer(this.aiToolsContainer);
  }

  /**
   * Setup event listeners for inline chat in a specific container
   */
  private setupChatEventListenersForContainer(container: HTMLElement | Element): void {
    const chatInput = container?.querySelector('.chat-input') as HTMLInputElement;
    const sendBtn = container?.querySelector('.chat-send-btn');

    if (!chatInput || !sendBtn) return;

    // Send message on button click
    sendBtn.addEventListener('click', () => {
      this.handleSendMessage(chatInput.value);
      chatInput.value = '';
    });

    // Send message on Enter key
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage(chatInput.value);
        chatInput.value = '';
      }
    });
  }

  /**
   * Setup event listeners for suggestion chips in a specific container
   */
  private setupChipEventListenersForContainer(container: HTMLElement | Element): void {
    const chips = container?.querySelectorAll('.suggestion-chip');
    if (!chips) return;

    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const action = chip.getAttribute('data-action') as SuggestionAction;
        if (this.currentSession) {
          this.handleToolAction(action, this.currentSession);
        }
      });
    });
  }

  /**
   * Handle sending a message
   */
  private async handleSendMessage(message: string): Promise<void> {
    if (!message.trim() || !this.currentSession) return;

    // Track chat message
    try {
      await (window as any).electronAPI.incrementAIChatMessages(this.currentSession.id, 1);
    } catch (error) {
      logger.error('Failed to track chat message:', error);
    }

    // Parse command
    const suggestion = this.suggestionEngine.parseNaturalLanguageCommand(message);

    if (suggestion) {
      // Execute the action
      this.handleToolAction(suggestion.action, this.currentSession);
    } else {
      // Show error in study content area
      if (this.studyContentArea) {
        this.studyContentArea.innerHTML = `
          <div class="ai-response-error">
            <p>I'm not sure what you mean. Try commands like:</p>
            <ul>
              <li>"create flashcards"</li>
              <li>"quiz me"</li>
              <li>"summarize this"</li>
              <li>"explain the key concepts"</li>
            </ul>
          </div>
        `;
      }
    }
  }

  /**
   * Analyze session content and update suggestion engine
   */
  private analyzeSessionContent(session: Session): void {
    // Update content analyzer with session data
    const transcription = session.transcription || '';
    const notes = session.notes || '';

    this.contentAnalyzer.updateContent(transcription, notes);
  }

  /**
   * Get metadata for an action
   */
  private getActionMetadata(action: SuggestionAction): { icon: string; label: string } {
    const metadata: Record<SuggestionAction, { icon: string; label: string }> = {
      'summary': { icon: '📄', label: 'Summary' },
      'concept': { icon: '💡', label: 'Key Concepts' },
      'flashcards': { icon: '🃏', label: 'Flashcards' },
      'quiz': { icon: '📝', label: 'Quiz' },
      'weak_spots': { icon: '🎯', label: 'Weak Spots' },
      'eli5': { icon: '🤔', label: 'ELI5' },
      'study_plan': { icon: '📅', label: 'Study Plan' },
      'concept_map': { icon: '🗺️', label: 'Concept Map' },
      'bookmark': { icon: '🔖', label: 'Bookmark' },
      'highlight': { icon: '⭐', label: 'Highlight' },
      'note_prompt': { icon: '📝', label: 'Note' }
    };
    return metadata[action] || { icon: '🤖', label: 'AI Tool' };
  }

  /**
   * Get the currently active/visible content area
   */
  private getActiveContentArea(): HTMLElement | null {
    // Check if we're in small window mode (AI tools tab is visible)
    const aiToolsTab = document.querySelector('.content-tab.ai-tools-tab') as HTMLElement;
    const isSmallWindow = aiToolsTab && window.getComputedStyle(aiToolsTab).display !== 'none';

    if (isSmallWindow) {
      // Check if AI tools panel is active in tab view
      const aiToolsPanel = document.querySelector('.session-content-panel.ai-tools-panel');
      if (aiToolsPanel && aiToolsPanel.classList.contains('active')) {
        // Return tab version of content area
        const tabContentArea = document.getElementById('study-content-area-tab');
        if (tabContentArea) {
          return tabContentArea;
        }
      }
    }

    // Default to main content area
    return this.studyContentArea;
  }

  /**
   * Handle AI tool action from inline chat
   */
  private async handleToolAction(action: SuggestionAction, session: Session): Promise<void> {
    const activeContentArea = this.getActiveContentArea();
    if (!activeContentArea) return;

    logger.info(`Executing AI tool action: ${action}`);

    // Track AI tool usage
    try {
      await (window as any).electronAPI.incrementAIToolUsage(session.id);
    } catch (error) {
      logger.error('Failed to track AI tool usage:', error);
    }

    // Map actions to AI tool methods
    switch (action) {
      case 'summary':
        this.generateSummary(session, activeContentArea);
        break;
      case 'concept':
        this.extractKeyConcepts(session, activeContentArea);
        break;
      case 'flashcards':
        this.generateFlashcards(session, activeContentArea);
        break;
      case 'quiz':
        this.generateQuiz(session, activeContentArea);
        break;
      case 'weak_spots':
        this.generateWeakSpots(session, activeContentArea);
        break;
      case 'eli5':
        this.generateELI5Explainer(session, activeContentArea);
        break;
      case 'study_plan':
        this.generateStudyPlan(session, activeContentArea);
        break;
      case 'concept_map':
        this.generateConceptMap(session, activeContentArea);
        break;
      default:
        logger.warn(`Unknown action: ${action}`);
    }
  }

  /**
   * Generate summary
   */
  private generateSummary(session: Session, contentArea: HTMLElement): void {
    this.aiSummaryManager.generateSummary(session, contentArea);
    logger.info('Generating summary for session');
  }

  /**
   * Extract key concepts
   */
  private extractKeyConcepts(session: Session, contentArea: HTMLElement): void {
    this.aiSummaryManager.extractKeyConcepts(session, contentArea);
    logger.info('Extracting key concepts for session');
  }

  /**
   * Generate flashcards
   */
  private generateFlashcards(session: Session, contentArea: HTMLElement): void {
    this.aiSummaryManager.generateFlashcards(session, contentArea);
    logger.info('Generating flashcards for session');
  }

  /**
   * Generate quiz
   */
  private generateQuiz(session: Session, contentArea: HTMLElement): void {
    this.aiSummaryManager.generateQuiz(session, contentArea);
    logger.info('Generating quiz for session');
  }

  /**
   * Generate weak spots analysis
   */
  private generateWeakSpots(session: Session, contentArea: HTMLElement): void {
    this.aiSummaryManager.generateWeakSpots(session, contentArea);
    logger.info('Generating weak spots analysis for session');
  }

  /**
   * Generate ELI5 explainer
   */
  private generateELI5Explainer(session: Session, contentArea: HTMLElement): void {
    this.aiSummaryManager.generateELI5Explainer(session, contentArea);
    logger.info('Generating ELI5 explainer for session');
  }

  /**
   * Generate concept map
   */
  private generateConceptMap(session: Session, contentArea: HTMLElement): void {
    this.aiSummaryManager.generateConceptMap(session, contentArea);
    logger.info('Generating concept map for session');
  }

  /**
   * Generate study plan
   */
  private generateStudyPlan(session: Session, contentArea: HTMLElement): void {
    this.aiSummaryManager.generateStudyPlan(session, contentArea);
    logger.info('Generating study plan for session');
  }
}
