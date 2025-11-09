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
    this.aiToolsContainer = document.querySelector('.study-tool-section');

    if (!this.studyContentArea) {
      logger.warn('Study content area not found');
      return;
    }

    // Set current session
    this.currentSession = session;

    // Create inline chat interface in place of button grid
    this.createInlineChat();

    // Analyze content and generate initial suggestions
    this.analyzeSessionContent(session);

    logger.info(`Initialized AI tools for session: ${session.id}, type: ${session.type}, isMultiSession: ${session.isMultiSessionStudySet ? session.isMultiSessionStudySet() : 'N/A'}`);
  }

  /**
   * Create inline chat interface
   */
  private createInlineChat(): void {
    if (!this.aiToolsContainer) return;

    // Generate all 9 AI tool chips
    const allTools: SuggestionAction[] = [
      'summary',
      'concept',
      'flashcards',
      'quiz',
      'weak_spots',
      'learn_mode',
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

    const chatHTML = `
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

    this.aiToolsContainer.innerHTML = chatHTML;
    this.setupChatEventListeners();
    this.setupChipEventListeners();
  }

  /**
   * Setup event listeners for inline chat
   */
  private setupChatEventListeners(): void {
    const chatInput = this.aiToolsContainer?.querySelector('.chat-input') as HTMLInputElement;
    const sendBtn = this.aiToolsContainer?.querySelector('.chat-send-btn');

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
   * Setup event listeners for suggestion chips
   */
  private setupChipEventListeners(): void {
    const chips = this.aiToolsContainer?.querySelectorAll('.suggestion-chip');
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
  private handleSendMessage(message: string): void {
    if (!message.trim() || !this.currentSession) return;

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
      'learn_mode': { icon: '📚', label: 'Learn Mode' },
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
   * Handle AI tool action from inline chat
   */
  private handleToolAction(action: SuggestionAction, session: Session): void {
    if (!this.studyContentArea) return;

    logger.info(`Executing AI tool action: ${action}`);

    // Map actions to AI tool methods
    switch (action) {
      case 'summary':
        this.generateSummary(session);
        break;
      case 'concept':
        this.extractKeyConcepts(session);
        break;
      case 'flashcards':
        this.generateFlashcards(session);
        break;
      case 'quiz':
        this.generateQuiz(session);
        break;
      case 'weak_spots':
        this.generateWeakSpots(session);
        break;
      case 'learn_mode':
        this.generateLearnMode(session);
        break;
      case 'eli5':
        this.generateELI5Explainer(session);
        break;
      case 'study_plan':
        this.generateStudyPlan(session);
        break;
      case 'concept_map':
        this.generateConceptMap(session);
        break;
      default:
        logger.warn(`Unknown action: ${action}`);
    }
  }

  /**
   * Generate summary
   */
  private generateSummary(session: Session): void {
    if (!this.studyContentArea) return;
    this.aiSummaryManager.generateSummary(session, this.studyContentArea);
    logger.info('Generating summary for session');
  }

  /**
   * Extract key concepts
   */
  private extractKeyConcepts(session: Session): void {
    if (!this.studyContentArea) return;
    this.aiSummaryManager.extractKeyConcepts(session, this.studyContentArea);
    logger.info('Extracting key concepts for session');
  }

  /**
   * Generate flashcards
   */
  private generateFlashcards(session: Session): void {
    if (!this.studyContentArea) return;
    this.aiSummaryManager.generateFlashcards(session, this.studyContentArea);
    logger.info('Generating flashcards for session');
  }

  /**
   * Generate quiz
   */
  private generateQuiz(session: Session): void {
    if (!this.studyContentArea) return;
    this.aiSummaryManager.generateQuiz(session, this.studyContentArea);
    logger.info('Generating quiz for session');
  }

  /**
   * Generate weak spots analysis
   */
  private generateWeakSpots(session: Session): void {
    if (!this.studyContentArea) return;
    this.aiSummaryManager.generateWeakSpots(session, this.studyContentArea);
    logger.info('Generating weak spots analysis for session');
  }

  /**
   * Generate learn mode
   */
  private generateLearnMode(session: Session): void {
    if (!this.studyContentArea) return;
    this.aiSummaryManager.generateLearnMode(session, this.studyContentArea);
    logger.info('Generating learn mode for session');
  }

  /**
   * Generate ELI5 explainer
   */
  private generateELI5Explainer(session: Session): void {
    if (!this.studyContentArea) return;
    this.aiSummaryManager.generateELI5Explainer(session, this.studyContentArea);
    logger.info('Generating ELI5 explainer for session');
  }

  /**
   * Generate concept map
   */
  private generateConceptMap(session: Session): void {
    if (!this.studyContentArea) return;
    this.aiSummaryManager.generateConceptMap(session, this.studyContentArea);
    logger.info('Generating concept map for session');
  }

  /**
   * Generate study plan
   */
  private generateStudyPlan(session: Session): void {
    if (!this.studyContentArea) return;
    this.aiSummaryManager.generateStudyPlan(session, this.studyContentArea);
    logger.info('Generating study plan for session');
  }
}
