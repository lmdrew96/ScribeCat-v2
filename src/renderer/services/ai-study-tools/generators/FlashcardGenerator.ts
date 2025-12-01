/**
 * FlashcardGenerator
 *
 * Generates interactive flashcards with Review and Learn modes
 */

import type { Session } from '../../../../domain/entities/Session.js';
import { BaseAIToolGenerator } from './BaseAIToolGenerator.js';
import { AIResponseParser } from '../utils/AIResponseParser.js';
import { escapeHtml } from '../../../utils/formatting.js';
import { getIconHTML } from '../../../utils/iconMap.js';

type StudyMode = 'review' | 'learn';

interface FlashcardSettings {
  cardCount: number;
  startWithDefinition: boolean;
  studyMode: StudyMode;
}

export class FlashcardGenerator extends BaseAIToolGenerator {
  /**
   * Generate flashcards from the session (entry point)
   */
  static async generate(
    session: Session,
    contentArea: HTMLElement,
    forceRegenerate: boolean = false,
    settings?: FlashcardSettings
  ): Promise<void> {
    // If no settings provided, show settings screen
    if (!settings) {
      this.showFlashcardSettings(session, contentArea, forceRegenerate);
      return;
    }

    // Check if we have saved results matching these settings
    if (!forceRegenerate && session.hasAIToolResult('flashcards')) {
      const savedResult = session.getAIToolResult('flashcards');
      if (savedResult && savedResult.data.length >= settings.cardCount) {
        // Use saved results if we have enough cards
        const cardsToUse = savedResult.data.slice(0, settings.cardCount);
        this.renderFlashcards(cardsToUse, contentArea, settings, session);
        return;
      }
    }

    // Show loading state
    this.showLoading(contentArea, 'Creating flashcards...');

    try {
      // Load transcription
      const transcription = await this.loadTranscription(session);
      if (!transcription) {
        this.showNoTranscriptionError(contentArea, 'flashcards');
        return;
      }

      const { text: transcriptionText, isMultiSession } = transcription;

      // Use AI to generate flashcards
      const prompt = isMultiSession
        ? `Create ${settings.cardCount} flashcards from this MULTI-SESSION study set. The transcription contains content from multiple sessions marked with headers like "━━━ SESSION 1: Title ━━━".

For each flashcard:
1. Put the term/concept on the front
2. Provide a SHORT, textbook-style definition on the back (1-2 sentences max, concise and direct)
3. Include which session the content is from (e.g., "(Session 1)" or "(Sessions 2-3)")

Format as a JSON array with objects containing "term", "definition", and "session" fields. Cover important concepts from ALL sessions.

Transcription:
${transcriptionText}`
        : `Create ${settings.cardCount} flashcards from this transcription. Each flashcard should have a term or concept on the front and a SHORT, textbook-style definition on the back (1-2 sentences max, concise and direct). Format as a JSON array with objects containing "term" and "definition" fields. Focus on the most important concepts and terminology.

Transcription:
${transcriptionText}`;

      const result = await this.callAI(prompt);

      if (result.success && result.data) {
        // result.data is a string response from AI
        let flashcards: Array<{term: string; definition: string; session?: string}> = [];

        try {
          flashcards = AIResponseParser.parseJsonArray(
            result.data,
            'Flashcards',
            (data): data is Array<{ term: string; definition: string; session?: string }> => {
              return Array.isArray(data) && data.length > 0 &&
                     typeof data[0] === 'object' && 'term' in data[0] && 'definition' in data[0];
            }
          );
        } catch (e) {
          console.error('Failed to parse flashcards:', e);
          throw new Error('Failed to parse flashcards from AI response. The AI may not have returned the expected format.');
        }

        if (flashcards.length === 0) {
          throw new Error('No flashcards generated');
        }

        // Save the results to session
        await this.saveResults(session, 'flashcards', flashcards);

        // Render flashcards with the requested count
        const cardsToUse = flashcards.slice(0, settings.cardCount);
        this.renderFlashcards(cardsToUse, contentArea, settings, session);
      } else {
        throw new Error(result.error || 'Failed to generate flashcards');
      }
    } catch (error) {
      console.error('Error generating flashcards:', error);
      this.showError(contentArea, 'flashcards', error);
    }
  }

  /**
   * Show flashcard settings selector
   */
  private static showFlashcardSettings(session: Session, contentArea: HTMLElement, forceRegenerate: boolean): void {
    contentArea.innerHTML = `
      <div class="study-flashcard-settings">
        <div class="flashcard-settings-header">
          <h4>🃏 Flashcard Settings</h4>
          <p>Customize your flashcard experience</p>
        </div>

        <div class="flashcard-setting-section">
          <label class="setting-label">Number of Cards</label>
          <div class="flashcard-count-selector">
            <button class="flashcard-count-btn" data-count="5">
              <span class="count-number">5</span>
              <span class="count-label">Cards</span>
              <span class="count-time">~5 min</span>
            </button>
            <button class="flashcard-count-btn" data-count="10">
              <span class="count-number">10</span>
              <span class="count-label">Cards</span>
              <span class="count-time">~10 min</span>
            </button>
            <button class="flashcard-count-btn" data-count="15">
              <span class="count-number">15</span>
              <span class="count-label">Cards</span>
              <span class="count-time">~15 min</span>
            </button>
            <button class="flashcard-count-btn" data-count="20">
              <span class="count-number">20</span>
              <span class="count-label">Cards</span>
              <span class="count-time">~20 min</span>
            </button>
          </div>
        </div>

        <div class="flashcard-setting-section">
          <label class="setting-label">Study Mode</label>
          <div class="flashcard-mode-selector">
            <button class="flashcard-mode-btn active" data-mode="review">
              <span class="mode-icon">🔄</span>
              <span class="mode-label">Review Mode</span>
              <span class="mode-description">Flip cards to test yourself</span>
            </button>
            <button class="flashcard-mode-btn" data-mode="learn">
              <span class="mode-icon">📚</span>
              <span class="mode-label">Learn Mode</span>
              <span class="mode-description">Track mastery with feedback</span>
            </button>
          </div>
        </div>

        <div class="flashcard-setting-section">
          <label class="setting-label">Starting Side</label>
          <div class="flashcard-side-selector">
            <button class="flashcard-side-btn active" data-start="term">
              <span class="side-label">Start with Terms</span>
            </button>
            <button class="flashcard-side-btn" data-start="definition">
              <span class="side-label">Start with Definitions</span>
            </button>
          </div>
        </div>

        <button class="flashcard-start-btn" id="start-flashcards-btn">Start Studying</button>
      </div>
    `;

    // Track selected settings
    let selectedCount = 10; // Default
    let selectedMode: StudyMode = 'review'; // Default
    let selectedStartSide: 'term' | 'definition' = 'term'; // Default

    // Count selector
    const countButtons = contentArea.querySelectorAll('.flashcard-count-btn');
    countButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        countButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedCount = parseInt((btn as HTMLElement).dataset.count || '10');
      });
    });
    // Set default active
    (countButtons[1] as HTMLElement)?.classList.add('active'); // 10 cards

    // Mode selector
    const modeButtons = contentArea.querySelectorAll('.flashcard-mode-btn');
    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedMode = (btn as HTMLElement).dataset.mode as StudyMode;
      });
    });

    // Side selector
    const sideButtons = contentArea.querySelectorAll('.flashcard-side-btn');
    sideButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        sideButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedStartSide = (btn as HTMLElement).dataset.start as 'term' | 'definition';
      });
    });

    // Start button
    const startBtn = document.getElementById('start-flashcards-btn');
    startBtn?.addEventListener('click', () => {
      const settings: FlashcardSettings = {
        cardCount: selectedCount,
        startWithDefinition: selectedStartSide === 'definition',
        studyMode: selectedMode
      };
      this.generate(session, contentArea, forceRegenerate, settings);
    });
  }

  /**
   * Render flashcards with navigation (supports both Review and Learn modes)
   */
  private static renderFlashcards(
    flashcards: Array<{term: string; definition: string; session?: string}>,
    contentArea: HTMLElement,
    settings: FlashcardSettings,
    session?: Session
  ): void {
    if (settings.studyMode === 'learn') {
      this.renderLearnMode(flashcards, contentArea, session);
    } else {
      this.renderReviewMode(flashcards, contentArea, settings, session);
    }
  }

  /**
   * Review Mode: Flip cards to test yourself
   */
  private static renderReviewMode(
    flashcards: Array<{term: string; definition: string; session?: string}>,
    contentArea: HTMLElement,
    settings: FlashcardSettings,
    session?: Session
  ): void {
    let currentIndex = 0;
    let isFlipped = settings.startWithDefinition; // Start on selected side

    const render = () => {
      const card = flashcards[currentIndex];
      const side = isFlipped ? 'definition' : 'term';
      const label = isFlipped ? 'DEFINITION' : 'TERM';
      const content = isFlipped ? card.definition : card.term;

      contentArea.innerHTML = `
        <div class="study-flashcards">
          <div class="flashcard-controls">
            <div class="flashcard-counter">
              Card ${currentIndex + 1} of ${flashcards.length}
              ${card.session ? `<span class="flashcard-session-badge">${escapeHtml(card.session)}</span>` : ''}
            </div>
            <div class="flashcard-nav">
              <button class="flashcard-nav-btn" id="prev-card-btn" ${currentIndex === 0 ? 'disabled' : ''}>${getIconHTML('arrowLeft', { size: 14 })} Previous</button>
              <button class="flashcard-nav-btn" id="next-card-btn" ${currentIndex === flashcards.length - 1 ? 'disabled' : ''}>Next ${getIconHTML('arrowRight', { size: 14 })}</button>
            </div>
          </div>

          <div class="flashcard ${isFlipped ? 'flipped' : ''}" id="flashcard">
            <div class="flashcard-side">
              <div class="flashcard-label">${label}</div>
              <div class="flashcard-content">${escapeHtml(content)}</div>
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
          isFlipped = settings.startWithDefinition; // Reset to starting side
          render();
        }
      });

      const nextBtn = document.getElementById('next-card-btn');
      nextBtn?.addEventListener('click', () => {
        if (currentIndex < flashcards.length - 1) {
          currentIndex++;
          isFlipped = settings.startWithDefinition; // Reset to starting side
          render();
        }
      });
    };

    render();
  }

  /**
   * Learn Mode: Track mastery with feedback buttons
   */
  private static renderLearnMode(
    flashcards: Array<{term: string; definition: string; session?: string}>,
    contentArea: HTMLElement,
    session?: Session
  ): void {
    let currentIndex = 0;
    let masteredConcepts: Set<number> = new Set();
    let reviewQueue: number[] = Array.from({ length: flashcards.length }, (_, i) => i);

    const render = () => {
      if (currentIndex >= reviewQueue.length) {
        // Session complete
        const masteryPercentage = Math.round((masteredConcepts.size / flashcards.length) * 100);
        contentArea.innerHTML = `
          <div class="learn-mode-complete">
            <div class="learn-complete-icon">🎉</div>
            <h4>Learning Session Complete!</h4>
            <div class="learn-stats">
              <div class="learn-stat">
                <span class="stat-number">${masteredConcepts.size}</span>
                <span class="stat-label">Mastered</span>
              </div>
              <div class="learn-stat">
                <span class="stat-number">${flashcards.length - masteredConcepts.size}</span>
                <span class="stat-label">Review</span>
              </div>
              <div class="learn-stat">
                <span class="stat-number">${masteryPercentage}%</span>
                <span class="stat-label">Progress</span>
              </div>
            </div>
            <button class="learn-restart-btn" id="restart-learn-btn">Start New Session</button>
          </div>
        `;

        const restartBtn = document.getElementById('restart-learn-btn');
        restartBtn?.addEventListener('click', () => {
          currentIndex = 0;
          masteredConcepts.clear();
          reviewQueue = Array.from({ length: flashcards.length }, (_, i) => i);
          render();
        });
        return;
      }

      const cardIndex = reviewQueue[currentIndex];
      const card = flashcards[cardIndex];

      contentArea.innerHTML = `
        <div class="learn-mode-session">
          <div class="learn-progress-bar">
            <div class="learn-progress-fill" style="width: ${(currentIndex / reviewQueue.length) * 100}%"></div>
          </div>
          <div class="learn-progress-text">
            ${currentIndex + 1} of ${reviewQueue.length} cards
            ${card.session ? `<span class="flashcard-session-badge">${escapeHtml(card.session)}</span>` : ''}
          </div>

          <div class="learn-card">
            <div class="learn-card-term">
              <div class="flashcard-label">TERM</div>
              ${escapeHtml(card.term)}
            </div>
            <div class="learn-card-divider"></div>
            <div class="learn-card-definition">
              <div class="flashcard-label">DEFINITION</div>
              ${escapeHtml(card.definition)}
            </div>
          </div>

          <div class="learn-actions">
            <button class="learn-action-btn learn-still-learning" id="still-learning-btn">
              📝 Still Learning
            </button>
            <button class="learn-action-btn learn-know-it" id="know-it-btn">
              ✅ Know It!
            </button>
          </div>

          <div class="learn-stats-mini">
            <span>Mastered: ${masteredConcepts.size}/${flashcards.length}</span>
          </div>
        </div>
      `;

      // Event listeners
      const stillLearningBtn = document.getElementById('still-learning-btn');
      stillLearningBtn?.addEventListener('click', () => {
        masteredConcepts.delete(cardIndex);
        currentIndex++;
        render();
      });

      const knowItBtn = document.getElementById('know-it-btn');
      knowItBtn?.addEventListener('click', () => {
        masteredConcepts.add(cardIndex);
        currentIndex++;
        render();
      });
    };

    render();
  }
}
