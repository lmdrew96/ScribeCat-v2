/**
 * AISummaryManager
 *
 * Manages AI-powered study tools for sessions.
 * Handles summary generation, key concepts extraction, flashcard creation,
 * and quiz generation with interactive rendering.
 */

import type { Session } from '../../domain/entities/Session.js';
import { renderMarkdown } from '../markdown-renderer.js';

export class AISummaryManager {
  /**
   * Generate and save a short summary (150 chars) for card display
   * This is automatically called after transcription completes
   */
  async generateAndSaveShortSummary(sessionId: string): Promise<void> {
    try {
      // Get session via IPC
      const sessionResult = await (window as any).scribeCat.session.list();
      if (!sessionResult.success || !sessionResult.sessions) {
        console.error('Failed to load sessions for short summary generation');
        return;
      }

      const sessionData = sessionResult.sessions.find((s: any) => s.id === sessionId);
      if (!sessionData) {
        console.error(`Session ${sessionId} not found`);
        return;
      }

      // Import Session class for reconstruction
      const { Session: SessionClass } = await import('../../domain/entities/Session.js');
      const session = SessionClass.fromJSON(sessionData);

      // Check if session has transcription
      if (!session.transcription || !session.transcription.fullText) {
        console.log('No transcription available for short summary generation');
        return;
      }

      // Generate a very short summary using AI (max 150 chars)
      const prompt = `Provide a 1-2 sentence summary (maximum 150 characters) of this lecture transcription. Be concise and focus on the main topic only.

Transcription:
${session.transcription.fullText}`;

      const result = await (window as any).scribeCat.ai.chat(prompt, [], {
        includeTranscription: false,
        includeNotes: false
      });

      if (result.success && result.data) {
        // Extract message from AI response
        let summary: string;
        if (typeof result.data === 'string') {
          summary = result.data;
        } else if (result.data && typeof result.data === 'object' && 'message' in result.data) {
          summary = (result.data as { message: string }).message;
        } else {
          summary = JSON.stringify(result.data);
        }

        // Ensure summary is no longer than 150 characters
        if (summary.length > 150) {
          summary = summary.substring(0, 147) + '...';
        }

        // Save summary to session via IPC
        await (window as any).scribeCat.session.updateSummary(sessionId, summary);
        console.log(`✅ Short summary saved for session ${sessionId}: ${summary}`);

        // Refresh study mode to show the new summary
        if (window.studyModeManager) {
          await window.studyModeManager.refresh();
          console.log('📚 Study mode refreshed to display new summary');
        }
      }
    } catch (error) {
      console.error('Error generating short summary:', error);
      // Don't throw - this is a background operation
    }
  }

  /**
   * Generate AI summary of the session
   */
  async generateSummary(session: Session, contentArea: HTMLElement): Promise<void> {
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
      // Check if this is a multi-session study set
      const isMultiSession = session.type === 'multi-session-study-set';
      console.log(`🎯 AISummaryManager.generateSummary - Session type: ${session.type}, isMultiSession: ${isMultiSession}, childSessionIds:`, session.childSessionIds);

      let transcriptionText: string;
      let notesText: string = session.notes || '';

      if (isMultiSession) {
        // Load child sessions dynamically
        const childSessions = await this.loadChildSessions(session);
        console.log(`📚 Loaded ${childSessions.length} child sessions for multi-session study set`);

        if (childSessions.length === 0) {
          contentArea.innerHTML = `
            <div class="study-summary">
              <div class="summary-section">
                <p style="text-align: center; color: var(--text-tertiary);">
                  No child sessions found in this study set.
                </p>
              </div>
            </div>
          `;
          return;
        }

        // Merge transcriptions from all child sessions
        transcriptionText = this.mergeTranscriptions(childSessions);
      } else {
        // Single session
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

        transcriptionText = session.transcription.fullText;
      }

      // Generate summary using AI
      let summaryResult;
      if (isMultiSession) {
        // For multi-session study sets, use chat with custom prompt
        const prompt = `You are analyzing a multi-session study set that combines content from multiple lecture/recording sessions. The transcription below contains clear session markers (e.g., "━━━ SESSION 1: Title ━━━").

Please generate a comprehensive summary that:
1. Summarizes the key points from ALL sessions
2. Tags each major point with its source session (e.g., "Session 1:", "Session 2:")
3. Shows how concepts build across sessions if applicable
4. Maintains clear separation between different sessions' content

Transcription:
${transcriptionText}

${notesText ? `Notes:\n${notesText}` : ''}

Format your response as a clear, organized summary with session attribution.`;

        summaryResult = await window.scribeCat.ai.chat(prompt, [], {
          includeTranscription: false,
          includeNotes: false
        });
      } else {
        // For single sessions, use the standard summary API
        summaryResult = await window.scribeCat.ai.generateSummary(
          transcriptionText,
          notesText || undefined
        );
      }

      const result = summaryResult;

      if (result.success && result.data) {
        // Extract summary from SummaryResult object
        let summary: string;
        if (typeof result.data === 'string') {
          summary = result.data;
        } else if (result.data && typeof result.data === 'object' && 'summary' in result.data) {
          summary = (result.data as { summary: string }).summary;
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
  async extractKeyConcepts(session: Session, contentArea: HTMLElement): Promise<void> {
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
      // Check if this is a multi-session study set
      const isMultiSession = session.type === 'multi-session-study-set';

      let transcriptionText: string;

      if (isMultiSession) {
        // Load child sessions dynamically
        const childSessions = await this.loadChildSessions(session);

        if (childSessions.length === 0) {
          contentArea.innerHTML = `
            <div class="study-concepts">
              <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                No child sessions found in this study set.
              </div>
            </div>
          `;
          return;
        }

        transcriptionText = this.mergeTranscriptions(childSessions);
      } else {
        // Single session
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

        transcriptionText = session.transcription.fullText;
      }

      // Use AI to extract key concepts
      const prompt = isMultiSession
        ? `Extract the key concepts from this MULTI-SESSION study set. The transcription contains content from multiple sessions marked with headers like "━━━ SESSION 1: Title ━━━".

For each concept, provide:
1. The term/concept name
2. A brief definition
3. Which session(s) it appears in (e.g., "Session 1" or "Sessions 1-3")

Format as a JSON array with objects containing "term", "definition", and "sessions" fields. Limit to 7-10 most important concepts across all sessions.

Transcription:
${transcriptionText}`
        : `Extract the key concepts from this transcription. For each concept, provide the term and a brief definition. Format as a JSON array with objects containing "term" and "definition" fields. Limit to 5-7 most important concepts.

Transcription:
${transcriptionText}`;

      const result = await window.scribeCat.ai.chat(prompt, [], {
        includeTranscription: false,
        includeNotes: false
      });

      if (result.success && result.data) {
        // result.data is a string response from AI
        let concepts: Array<{term: string; definition: string; sessions?: string}> = [];

        try {
          concepts = this.parseAIJsonResponse(
            result.data,
            'Key Concepts',
            (data): data is Array<{ term: string; definition: string; sessions?: string }> => {
              return Array.isArray(data) && data.length > 0 &&
                     typeof data[0] === 'object' && 'term' in data[0] && 'definition' in data[0];
            }
          );
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
            <div class="concept-term">
              ${this.escapeHtml(concept.term)}
              ${concept.sessions ? `<span class="concept-sessions"> (${this.escapeHtml(concept.sessions)})</span>` : ''}
            </div>
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
  async generateFlashcards(session: Session, contentArea: HTMLElement): Promise<void> {
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
      // Check if this is a multi-session study set
      const isMultiSession = session.type === 'multi-session-study-set';

      let transcriptionText: string;

      if (isMultiSession) {
        // Load child sessions dynamically
        const childSessions = await this.loadChildSessions(session);

        if (childSessions.length === 0) {
          contentArea.innerHTML = `
            <div class="study-flashcards">
              <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                No child sessions found for this multi-session study set.
              </div>
            </div>
          `;
          return;
        }

        // Merge transcriptions from all child sessions
        transcriptionText = this.mergeTranscriptions(childSessions);

        if (!transcriptionText || transcriptionText.trim().length === 0) {
          contentArea.innerHTML = `
            <div class="study-flashcards">
              <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                No transcription available in child sessions.
              </div>
            </div>
          `;
          return;
        }
      } else {
        // Single session - check if transcription exists
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

        transcriptionText = session.transcription.fullText;
      }

      // Use AI to generate flashcards
      const prompt = isMultiSession
        ? `Create 8-12 flashcards from this MULTI-SESSION study set. The transcription contains content from multiple sessions marked with headers like "━━━ SESSION 1: Title ━━━".

For each flashcard:
1. Put the term/concept on the front
2. Provide a SHORT, textbook-style definition on the back (1-2 sentences max, concise and direct)
3. Include which session the content is from (e.g., "(Session 1)" or "(Sessions 2-3)")

Format as a JSON array with objects containing "term", "definition", and "session" fields. Cover important concepts from ALL sessions.

Transcription:
${transcriptionText}`
        : `Create 5-7 flashcards from this transcription. Each flashcard should have a term or concept on the front and a SHORT, textbook-style definition on the back (1-2 sentences max, concise and direct). Format as a JSON array with objects containing "term" and "definition" fields. Focus on the most important concepts and terminology.

Transcription:
${transcriptionText}`;

      const result = await window.scribeCat.ai.chat(prompt, [], {
        includeTranscription: false,
        includeNotes: false
      });

      if (result.success && result.data) {
        // result.data is a string response from AI
        let flashcards: Array<{term: string; definition: string; session?: string}> = [];

        try {
          flashcards = this.parseAIJsonResponse(
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
  private renderFlashcards(flashcards: Array<{term: string; definition: string; session?: string}>, contentArea: HTMLElement): void {
    let currentIndex = 0;
    let isFlipped = false;

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
              ${card.session ? `<span class="flashcard-session-badge">${this.escapeHtml(card.session)}</span>` : ''}
            </div>
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
   * Show quiz settings selector
   */
  private showQuizSettings(session: Session, contentArea: HTMLElement): void {
    contentArea.innerHTML = `
      <div class="study-quiz-settings">
        <div class="quiz-settings-header">
          <h4>📝 Quiz Settings</h4>
          <p>Choose how many questions you'd like in your quiz</p>
        </div>

        <div class="quiz-question-count-selector">
          <button class="quiz-count-btn" data-count="5">
            <span class="count-number">5</span>
            <span class="count-label">Questions</span>
            <span class="count-time">~5 min</span>
          </button>
          <button class="quiz-count-btn" data-count="10">
            <span class="count-number">10</span>
            <span class="count-label">Questions</span>
            <span class="count-time">~10 min</span>
          </button>
          <button class="quiz-count-btn" data-count="15">
            <span class="count-number">15</span>
            <span class="count-label">Questions</span>
            <span class="count-time">~15 min</span>
          </button>
          <button class="quiz-count-btn" data-count="20">
            <span class="count-number">20</span>
            <span class="count-label">Questions</span>
            <span class="count-time">~20 min</span>
          </button>
        </div>
      </div>
    `;

    // Attach event listeners
    const countButtons = contentArea.querySelectorAll('.quiz-count-btn');
    countButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const count = parseInt((btn as HTMLElement).dataset.count || '5');
        this.generateQuiz(session, contentArea, count);
      });
    });
  }

  /**
   * Generate a quiz from the session
   */
  async generateQuiz(session: Session, contentArea: HTMLElement, questionCount?: number): Promise<void> {
    // Set active state
    this.setActiveStudyTool('generate-quiz-btn');

    // If no question count provided, show selector first
    if (!questionCount) {
      this.showQuizSettings(session, contentArea);
      return;
    }

    // Show loading state
    contentArea.innerHTML = `
      <div class="study-loading">
        <div class="study-loading-spinner"></div>
        <div class="study-loading-text">Generating ${questionCount} quiz questions...</div>
      </div>
    `;

    try {
      // Check if this is a multi-session study set
      const isMultiSession = session.type === 'multi-session-study-set';

      let transcriptionText: string;

      if (isMultiSession) {
        // Load child sessions dynamically
        const childSessions = await this.loadChildSessions(session);

        if (childSessions.length === 0) {
          contentArea.innerHTML = `
            <div class="study-quiz">
              <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                No child sessions found for this multi-session study set.
              </div>
            </div>
          `;
          return;
        }

        // Merge transcriptions from all child sessions
        transcriptionText = this.mergeTranscriptions(childSessions);

        if (!transcriptionText || transcriptionText.trim().length === 0) {
          contentArea.innerHTML = `
            <div class="study-quiz">
              <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                No transcription available in child sessions.
              </div>
            </div>
          `;
          return;
        }
      } else {
        // Single session - check if transcription exists
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

        transcriptionText = session.transcription.fullText;
      }

      // Use AI to generate quiz questions
      const prompt = isMultiSession
        ? `Create ${questionCount} multiple-choice quiz questions from this MULTI-SESSION study set. The transcription contains content from multiple sessions marked with headers like "━━━ SESSION 1: Title ━━━".

For each question:
1. Create a clear question that tests understanding
2. Provide 4 options (A, B, C, D) with one correct answer
3. Indicate which session the content is from (e.g., "Session 1" or "Session 2-3")
4. Provide a brief explanation for why the correct answer is right

Format as a JSON array with objects containing "question", "options" (array of 4 strings), "correctAnswer" (0-3 index), "explanation" (string), and "session" (string). Cover content from ALL sessions.

Transcription:
${transcriptionText}`
        : `Create ${questionCount} multiple-choice quiz questions from this transcription. Each question should have 4 options (A, B, C, D) with one correct answer. For each question, also provide a brief explanation for why the correct answer is right. Format as a JSON array with objects containing "question", "options" (array of 4 strings), "correctAnswer" (0-3 index), and "explanation" (string). Focus on testing understanding of key concepts.

Transcription:
${transcriptionText}`;

      const result = await window.scribeCat.ai.chat(prompt, [], {
        includeTranscription: false,
        includeNotes: false
      });

      if (result.success && result.data) {
        // result.data is a string response from AI
        let questions: Array<{question: string; options: string[]; correctAnswer: number; explanation: string; session?: string}> = [];

        try {
          questions = this.parseAIJsonResponse(
            result.data,
            'Quiz',
            (data): data is Array<{ question: string; options: string[]; correctAnswer: number; explanation: string; session?: string }> => {
              return Array.isArray(data) && data.length > 0 &&
                     typeof data[0] === 'object' && 'question' in data[0] &&
                     'options' in data[0] && 'correctAnswer' in data[0] &&
                     typeof data[0].correctAnswer === 'number' &&
                     'explanation' in data[0];
            }
          );
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
  private renderQuiz(questions: Array<{question: string; options: string[]; correctAnswer: number; explanation: string; session?: string}>, contentArea: HTMLElement): void {
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
            <div class="quiz-question-number">
              Question ${currentIndex + 1} of ${questions.length}
              ${question.session ? `<span class="quiz-session-badge">${this.escapeHtml(question.session)}</span>` : ''}
            </div>
            <div class="quiz-score">Score: ${score}/${currentIndex}</div>
          </div>

          <div class="quiz-question">
            <div class="quiz-question-text">${this.escapeHtml(question.question)}</div>
            <div class="quiz-options" id="quiz-options">
              ${optionsHtml}
            </div>
            ${answered ? `
              <div class="quiz-feedback">
                <div class="quiz-feedback-result">
                  ${selectedAnswer === question.correctAnswer ?
                    '✅ Correct! Well done.' :
                    `❌ Incorrect. The correct answer is ${optionLabels[question.correctAnswer]}.`}
                </div>
                <div class="quiz-feedback-explanation">
                  <strong>Explanation:</strong> ${this.escapeHtml(question.explanation)}
                </div>
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
   * Generate weak spots analysis
   */
  async generateWeakSpots(session: Session, contentArea: HTMLElement): Promise<void> {
    // Set active state
    this.setActiveStudyTool('weak-spots-btn');

    // Show loading state
    contentArea.innerHTML = `
      <div class="study-loading">
        <div class="study-loading-spinner"></div>
        <div class="study-loading-text">Analyzing weak spots...</div>
      </div>
    `;

    try {
      // Check if this is a multi-session study set
      const isMultiSession = session.type === 'multi-session-study-set';

      let transcriptionText: string;

      if (isMultiSession) {
        // Load child sessions dynamically
        const childSessions = await this.loadChildSessions(session);

        if (childSessions.length === 0) {
          contentArea.innerHTML = `
            <div class="study-weak-spots">
              <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                No child sessions found for this multi-session study set.
              </div>
            </div>
          `;
          return;
        }

        // Merge transcriptions from all child sessions
        transcriptionText = this.mergeTranscriptions(childSessions);

        if (!transcriptionText || transcriptionText.trim().length === 0) {
          contentArea.innerHTML = `
            <div class="study-weak-spots">
              <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                No transcription available in child sessions.
              </div>
            </div>
          `;
          return;
        }
      } else {
        // Single session - check if transcription exists
        if (!session.transcription || !session.transcription.fullText) {
          contentArea.innerHTML = `
            <div class="study-weak-spots">
              <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                No transcription available for this session.
              </div>
            </div>
          `;
          return;
        }

        transcriptionText = session.transcription.fullText;
      }

      // Use AI to identify weak spots
      const prompt = isMultiSession
        ? `Analyze this MULTI-SESSION study set transcription and identify 5-7 concepts that a student is MOST LIKELY TO STRUGGLE WITH. The transcription contains content from multiple sessions marked with headers.

For each weak spot, identify:
1. The concept/topic name
2. Why it's a weak spot (e.g., "explained briefly", "complex terminology", "assumed prior knowledge", "mentioned once", "high information density")
3. A brief mini-lesson or tip to help understand it better
4. Severity level: "high" (critical to understand), "medium" (important), or "low" (good to review)
5. Which session(s) it appears in

Format as a JSON array with objects containing "concept", "reason", "miniLesson", "severity", and "session" fields.

Transcription:
${transcriptionText}`
        : `Analyze this transcription and identify 5-7 concepts that a student is MOST LIKELY TO STRUGGLE WITH.

For each weak spot, identify:
1. The concept/topic name
2. Why it's a weak spot (e.g., "explained briefly", "complex terminology", "assumed prior knowledge", "mentioned once", "high information density")
3. A brief mini-lesson or tip to help understand it better
4. Severity level: "high" (critical to understand), "medium" (important), or "low" (good to review)

Format as a JSON array with objects containing "concept", "reason", "miniLesson", and "severity" fields.

Transcription:
${transcriptionText}`;

      const result = await window.scribeCat.ai.chat(prompt, [], {
        includeTranscription: false,
        includeNotes: false
      });

      if (result.success && result.data) {
        // result.data is a string response from AI
        let weakSpots: Array<{concept: string; reason: string; miniLesson: string; severity: string; session?: string}> = [];

        try {
          weakSpots = this.parseAIJsonResponse(
            result.data,
            'Weak Spots',
            (data): data is Array<{ concept: string; reason: string; miniLesson: string; severity: string; session?: string }> => {
              return Array.isArray(data) && data.length > 0 &&
                     typeof data[0] === 'object' && 'concept' in data[0] &&
                     'reason' in data[0] && 'miniLesson' in data[0] &&
                     'severity' in data[0];
            }
          );
        } catch (e) {
          console.error('Failed to parse weak spots:', e);
          throw new Error('Failed to parse weak spots from AI response. The AI may not have returned the expected format.');
        }

        if (weakSpots.length === 0) {
          throw new Error('No weak spots identified');
        }

        // Render weak spots
        this.renderWeakSpots(weakSpots, contentArea);
      } else {
        throw new Error(result.error || 'Failed to analyze weak spots');
      }
    } catch (error) {
      console.error('Error analyzing weak spots:', error);
      contentArea.innerHTML = `
        <div class="study-weak-spots">
          <div style="text-align: center; padding: 20px; color: var(--record-color);">
            Failed to analyze weak spots: ${error instanceof Error ? error.message : 'Unknown error'}
          </div>
          <div style="text-align: center; padding: 10px; color: var(--text-tertiary);">
            Make sure Claude AI is configured in Settings.
          </div>
        </div>
      `;
    }
  }

  /**
   * Render weak spots analysis
   */
  private renderWeakSpots(weakSpots: Array<{concept: string; reason: string; miniLesson: string; severity: string; session?: string}>, contentArea: HTMLElement): void {
    const severityIcons = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };

    const severityLabels = {
      high: 'Priority',
      medium: 'Review',
      low: 'Optional'
    };

    const weakSpotsHtml = weakSpots
      .sort((a, b) => {
        // Sort by severity: high > medium > low
        const severityOrder = { high: 0, medium: 1, low: 2 };
        return (severityOrder[a.severity.toLowerCase() as keyof typeof severityOrder] || 1) -
               (severityOrder[b.severity.toLowerCase() as keyof typeof severityOrder] || 1);
      })
      .map(spot => {
        const severity = spot.severity.toLowerCase();
        const icon = severityIcons[severity as keyof typeof severityIcons] || '🟡';
        const label = severityLabels[severity as keyof typeof severityLabels] || 'Review';

        return `
          <div class="weak-spot-item" data-severity="${severity}">
            <div class="weak-spot-header">
              <div class="weak-spot-title">
                <span class="weak-spot-icon">${icon}</span>
                <span class="weak-spot-concept">${this.escapeHtml(spot.concept)}</span>
                <span class="weak-spot-severity-badge">${label}</span>
              </div>
              ${spot.session ? `<span class="weak-spot-session-badge">${this.escapeHtml(spot.session)}</span>` : ''}
            </div>
            <div class="weak-spot-reason">
              <strong>Why it's tricky:</strong> ${this.escapeHtml(spot.reason)}
            </div>
            <div class="weak-spot-mini-lesson">
              <strong>💡 Quick tip:</strong> ${this.escapeHtml(spot.miniLesson)}
            </div>
          </div>
        `;
      }).join('');

    contentArea.innerHTML = `
      <div class="study-weak-spots">
        <div class="weak-spots-header">
          <h4>🎯 Potential Weak Spots</h4>
          <p>These concepts might be challenging. Focus on these for deeper understanding.</p>
        </div>
        <div class="weak-spots-list">
          ${weakSpotsHtml}
        </div>
      </div>
    `;
  }

  /**
   * Generate learn mode with spaced repetition
   */
  async generateLearnMode(session: Session, contentArea: HTMLElement): Promise<void> {
    // Set active state
    this.setActiveStudyTool('learn-mode-btn');

    // Show loading state
    contentArea.innerHTML = `
      <div class="study-loading">
        <div class="study-loading-spinner"></div>
        <div class="study-loading-text">Preparing learn mode...</div>
      </div>
    `;

    try {
      // Check if this is a multi-session study set
      const isMultiSession = session.type === 'multi-session-study-set';
      let transcriptionText: string;

      if (isMultiSession) {
        const childSessions = await this.loadChildSessions(session);
        if (childSessions.length === 0) {
          contentArea.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No child sessions found.</div>`;
          return;
        }
        transcriptionText = this.mergeTranscriptions(childSessions);
        if (!transcriptionText || transcriptionText.trim().length === 0) {
          contentArea.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No transcription available.</div>`;
          return;
        }
      } else {
        if (!session.transcription || !session.transcription.fullText) {
          contentArea.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No transcription available.</div>`;
          return;
        }
        transcriptionText = session.transcription.fullText;
      }

      // Generate concepts for learning
      const prompt = `Create 10-12 key concept pairs for spaced repetition learning from this transcription. Each pair should have a term/concept and its definition.

Format as a JSON array with objects containing "term" and "definition" fields. Focus on the most important concepts that a student needs to master.

Transcription:
${transcriptionText}`;

      const result = await window.scribeCat.ai.chat(prompt, [], {
        includeTranscription: false,
        includeNotes: false
      });

      if (result.success && result.data) {
        let concepts: Array<{term: string; definition: string}> = [];

        try {
          concepts = this.parseAIJsonResponse(
            result.data,
            'Learn Mode Concepts',
            (data): data is Array<{ term: string; definition: string }> => {
              return Array.isArray(data) && data.length > 0 &&
                     typeof data[0] === 'object' && 'term' in data[0] && 'definition' in data[0];
            }
          );
        } catch (e) {
          console.error('Failed to parse learn mode concepts:', e);
          throw new Error('Failed to parse concepts from AI response.');
        }

        if (concepts.length === 0) {
          throw new Error('No concepts generated');
        }

        // Start learn mode session
        this.startLearnModeSession(concepts, contentArea);
      } else {
        throw new Error(result.error || 'Failed to generate learn mode concepts');
      }
    } catch (error) {
      console.error('Error generating learn mode:', error);
      contentArea.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--record-color);">
          Failed to start learn mode: ${error instanceof Error ? error.message : 'Unknown error'}
        </div>
      `;
    }
  }

  /**
   * Start learn mode session
   */
  private startLearnModeSession(concepts: Array<{term: string; definition: string}>, contentArea: HTMLElement): void {
    let currentIndex = 0;
    let masteredConcepts: Set<number> = new Set();
    let reviewQueue: number[] = Array.from({ length: concepts.length }, (_, i) => i);

    const render = () => {
      if (currentIndex >= reviewQueue.length) {
        // Session complete
        const masteryPercentage = Math.round((masteredConcepts.size / concepts.length) * 100);
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
                <span class="stat-number">${concepts.length - masteredConcepts.size}</span>
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
          reviewQueue = Array.from({ length: concepts.length }, (_, i) => i);
          render();
        });
        return;
      }

      const conceptIndex = reviewQueue[currentIndex];
      const concept = concepts[conceptIndex];
      const isMastered = masteredConcepts.has(conceptIndex);

      contentArea.innerHTML = `
        <div class="learn-mode-session">
          <div class="learn-progress-bar">
            <div class="learn-progress-fill" style="width: ${(currentIndex / reviewQueue.length) * 100}%"></div>
          </div>
          <div class="learn-progress-text">${currentIndex + 1} of ${reviewQueue.length} concepts</div>

          <div class="learn-card">
            <div class="learn-card-term">${this.escapeHtml(concept.term)}</div>
            <div class="learn-card-definition">${this.escapeHtml(concept.definition)}</div>
          </div>

          <div class="learn-actions">
            <button class="learn-action-btn learn-still-learning" id="still-learning-btn">
              Still Learning
            </button>
            <button class="learn-action-btn learn-know-it" id="know-it-btn">
              Know It!
            </button>
          </div>

          <div class="learn-stats-mini">
            <span>Mastered: ${masteredConcepts.size}/${concepts.length}</span>
          </div>
        </div>
      `;

      // Event listeners
      const stillLearningBtn = document.getElementById('still-learning-btn');
      stillLearningBtn?.addEventListener('click', () => {
        masteredConcepts.delete(conceptIndex);
        currentIndex++;
        render();
      });

      const knowItBtn = document.getElementById('know-it-btn');
      knowItBtn?.addEventListener('click', () => {
        masteredConcepts.add(conceptIndex);
        currentIndex++;
        render();
      });
    };

    render();
  }

  /**
   * Generate ELI5 (Explain Like I'm 5) explanations for complex concepts
   */
  async generateELI5Explainer(session: Session, contentArea: HTMLElement): Promise<void> {
    // Set active state
    this.setActiveStudyTool('eli5-explainer-btn');

    // Show loading state
    contentArea.innerHTML = `
      <div class="study-loading">
        <div class="study-loading-spinner"></div>
        <div class="study-loading-text">Finding complex concepts to simplify...</div>
      </div>
    `;

    try {
      const isMultiSession = session.type === 'multi-session-study-set';
      let transcriptionText: string;

      if (isMultiSession) {
        const childSessions = await this.loadChildSessions(session);
        if (childSessions.length === 0 || !(transcriptionText = this.mergeTranscriptions(childSessions))) {
          contentArea.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No content available.</div>`;
          return;
        }
      } else {
        if (!session.transcription?.fullText) {
          contentArea.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No transcription available.</div>`;
          return;
        }
        transcriptionText = session.transcription.fullText;
      }

      // Use AI to identify complex concepts and create simple explanations
      const prompt = isMultiSession
        ? `Analyze this MULTI-SESSION transcription and identify 5-7 concepts that might be difficult to understand. For each concept, provide an "Explain Like I'm 5" (ELI5) version - a super simple explanation using everyday language and analogies.

For each concept:
1. The complex concept/term name
2. A simple, beginner-friendly explanation (use analogies, avoid jargon)
3. Which session it's from (if the transcription has session markers like "━━━ SESSION 1 ━━━")

Format as JSON array with "concept", "simpleExplanation", and "session" fields.

Transcription:
${transcriptionText}`
        : `Analyze this transcription and identify 5-7 concepts that might be difficult to understand. For each concept, provide an "Explain Like I'm 5" (ELI5) version - a super simple explanation using everyday language and analogies.

For each concept:
1. The complex concept/term name
2. A simple, beginner-friendly explanation (use analogies, avoid jargon)

Format as JSON array with "concept" and "simpleExplanation" fields.

Transcription:
${transcriptionText}`;

      const result = await window.scribeCat.ai.chat(prompt, [], {
        includeTranscription: false,
        includeNotes: false
      });

      if (result.success && result.data) {
        let explanations: Array<{concept: string; simpleExplanation: string; session?: string}> = [];

        try {
          explanations = this.parseAIJsonResponse(
            result.data,
            'ELI5 Explanations',
            (data): data is Array<{ concept: string; simpleExplanation: string; session?: string }> => {
              return Array.isArray(data) && data.length > 0 &&
                     typeof data[0] === 'object' && 'concept' in data[0] && 'simpleExplanation' in data[0];
            }
          );
        } catch (e) {
          console.error('Failed to parse ELI5 response:', e);
          throw new Error('Invalid response format from AI');
        }

        // Render explanations
        contentArea.innerHTML = `
          <div class="eli5-explainer">
            <div class="eli5-header">
              <h4>💡 Complex Concepts Made Simple</h4>
              <p>Here are the tricky concepts explained in simple terms</p>
            </div>
            <div class="eli5-list">
              ${explanations.map(item => `
                <div class="eli5-item">
                  <div class="eli5-concept">
                    <span class="eli5-icon">🔍</span>
                    <span class="eli5-concept-name">${this.escapeHtml(item.concept)}</span>
                    ${item.session ? `<span class="eli5-session-badge">${this.escapeHtml(item.session)}</span>` : ''}
                  </div>
                  <div class="eli5-explanation">
                    ${this.escapeHtml(item.simpleExplanation)}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } else {
        throw new Error(result.error || 'Failed to generate ELI5 explanations');
      }
    } catch (error) {
      console.error('Error generating ELI5:', error);
      contentArea.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--record-color);">
          Failed to generate explanations: ${error instanceof Error ? error.message : 'Unknown error'}
        </div>
      `;
    }
  }

  /**
   * Generate concept map
   */
  async generateConceptMap(session: Session, contentArea: HTMLElement): Promise<void> {
    // Set active state
    this.setActiveStudyTool('concept-map-btn');

    // Show loading state
    contentArea.innerHTML = `
      <div class="study-loading">
        <div class="study-loading-spinner"></div>
        <div class="study-loading-text">Generating concept map...</div>
      </div>
    `;

    try {
      const isMultiSession = session.type === 'multi-session-study-set';
      let transcriptionText: string;

      if (isMultiSession) {
        const childSessions = await this.loadChildSessions(session);
        if (childSessions.length === 0) {
          contentArea.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No child sessions found.</div>`;
          return;
        }
        transcriptionText = this.mergeTranscriptions(childSessions);
        if (!transcriptionText || !transcriptionText.trim()) {
          contentArea.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No transcription available.</div>`;
          return;
        }
      } else {
        if (!session.transcription?.fullText) {
          contentArea.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No transcription available.</div>`;
          return;
        }
        transcriptionText = session.transcription.fullText;
      }

      // Generate hierarchical concept structure
      const prompt = `Create a hierarchical concept map from this transcription. Identify:
1. Main topic (1 central concept)
2. Major subtopics (3-5 concepts)
3. Supporting concepts for each subtopic (2-3 each)

Format as a JSON object with:
- "mainTopic": string
- "subtopics": array of {"name": string, "supporting": array of strings}

Transcription:
${transcriptionText}`;

      const result = await window.scribeCat.ai.chat(prompt, [], { includeTranscription: false, includeNotes: false });

      if (result.success && result.data) {
        let conceptMap: {mainTopic: string; subtopics: Array<{name: string; supporting: string[]}>};

        try {
          conceptMap = this.parseAIJsonResponse(
            result.data,
            'Concept Map',
            (data): data is {mainTopic: string; subtopics: Array<{name: string; supporting: string[]}> } => {
              return typeof data === 'object' && data !== null && 'mainTopic' in data && 'subtopics' in data;
            }
          );
        } catch (e) {
          console.error('Failed to parse concept map:', e);
          throw new Error('Failed to parse concept map from AI response.');
        }

        // Render concept map
        this.renderConceptMap(conceptMap, contentArea);
      } else {
        throw new Error(result.error || 'Failed to generate concept map');
      }
    } catch (error) {
      console.error('Error generating concept map:', error);
      contentArea.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--record-color);">Failed to generate concept map: ${error instanceof Error ? error.message : 'Unknown error'}</div>`;
    }
  }

  /**
   * Render concept map
   */
  private renderConceptMap(conceptMap: {mainTopic: string; subtopics: Array<{name: string; supporting: string[]}>}, contentArea: HTMLElement): void {
    const subtopicsHtml = conceptMap.subtopics.map(subtopic => {
      const supportingHtml = subtopic.supporting.map(concept => `
        <div class="map-supporting-concept">${this.escapeHtml(concept)}</div>
      `).join('');

      return `
        <div class="map-subtopic-branch">
          <div class="map-subtopic">${this.escapeHtml(subtopic.name)}</div>
          <div class="map-supporting-concepts">${supportingHtml}</div>
        </div>
      `;
    }).join('');

    contentArea.innerHTML = `
      <div class="concept-map">
        <div class="map-header">
          <h4>🗺️ Concept Map</h4>
          <p>Visual representation of how concepts relate</p>
        </div>
        <div class="map-diagram">
          <div class="map-main-topic">${this.escapeHtml(conceptMap.mainTopic)}</div>
          <div class="map-subtopics">${subtopicsHtml}</div>
        </div>
      </div>
    `;
  }

  /**
   * Generate study plan
   */
  async generateStudyPlan(session: Session, contentArea: HTMLElement, daysUntilExam?: number, hoursPerDay?: number): Promise<void> {
    // Set active state
    this.setActiveStudyTool('study-plan-btn');

    // If no parameters provided, show the form
    if (daysUntilExam === undefined || hoursPerDay === undefined) {
      this.showStudyPlanForm(session, contentArea);
      return;
    }

    // Show loading state
    contentArea.innerHTML = `
      <div class="study-loading">
        <div class="study-loading-spinner"></div>
        <div class="study-loading-text">Creating your study plan...</div>
      </div>
    `;

    try {
      // Check if this is a multi-session study set
      const isMultiSession = session.type === 'multi-session-study-set';

      let transcriptionText: string;
      let sessionTitles: string[] = [];

      if (isMultiSession) {
        // Load child sessions dynamically
        const childSessions = await this.loadChildSessions(session);

        if (childSessions.length === 0) {
          contentArea.innerHTML = `
            <div class="study-plan">
              <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                No child sessions found for this multi-session study set.
              </div>
            </div>
          `;
          return;
        }

        // Merge transcriptions from all child sessions
        transcriptionText = this.mergeTranscriptions(childSessions);
        sessionTitles = childSessions.map(s => s.title);

        if (!transcriptionText || transcriptionText.trim().length === 0) {
          contentArea.innerHTML = `
            <div class="study-plan">
              <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                No transcription available in child sessions.
              </div>
            </div>
          `;
          return;
        }
      } else {
        // Single session - check if transcription exists
        if (!session.transcription || !session.transcription.fullText) {
          contentArea.innerHTML = `
            <div class="study-plan">
              <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                No transcription available for this session.
              </div>
            </div>
          `;
          return;
        }

        transcriptionText = session.transcription.fullText;
        sessionTitles = [session.title];
      }

      const totalHours = daysUntilExam * hoursPerDay;

      // Use AI to generate study plan
      const prompt = isMultiSession
        ? `Create a personalized ${daysUntilExam}-day study plan for this MULTI-SESSION study set. The student has ${hoursPerDay} hours available per day (total: ${totalHours} hours).

Sessions to cover:
${sessionTitles.map((title, i) => `${i + 1}. ${title}`).join('\n')}

For each day, create:
1. Day number (1-${daysUntilExam})
2. Focus topics for that day
3. Recommended study tools to use (e.g., "Key Concepts", "Quiz", "Weak Spots", "Flashcards")
4. Time allocation for each activity
5. Brief description of what to accomplish

Format as a JSON array with objects containing "day", "topics", "tools" (array), "activities" (array of {activity, duration}), and "goal" fields. Ensure the plan progressively builds knowledge and includes review sessions.

Transcription summary (analyze to understand content):
${transcriptionText.substring(0, 3000)}...`
        : `Create a personalized ${daysUntilExam}-day study plan for this session. The student has ${hoursPerDay} hours available per day (total: ${totalHours} hours).

Topic: ${session.title}

For each day, create:
1. Day number (1-${daysUntilExam})
2. Focus topics for that day
3. Recommended study tools to use (e.g., "Key Concepts", "Quiz", "Weak Spots", "Flashcards")
4. Time allocation for each activity
5. Brief description of what to accomplish

Format as a JSON array with objects containing "day", "topics", "tools" (array of strings), "activities" (array of {activity, duration}), and "goal" fields. Ensure the plan progressively builds knowledge and includes review sessions.

Transcription summary (analyze to understand content):
${transcriptionText.substring(0, 3000)}...`;

      const result = await window.scribeCat.ai.chat(prompt, [], {
        includeTranscription: false,
        includeNotes: false
      });

      if (result.success && result.data) {
        // result.data is a string response from AI
        let studyPlan: Array<{day: number; topics: string; tools: string[]; activities: Array<{activity: string; duration: string}>; goal: string}> = [];

        try {
          studyPlan = this.parseAIJsonResponse(
            result.data,
            'Study Plan',
            (data): data is Array<{ day: number; topics: string; tools: string[]; activities: Array<{activity: string; duration: string}>; goal: string }> => {
              return Array.isArray(data) && data.length > 0 &&
                     typeof data[0] === 'object' && 'day' in data[0] &&
                     'topics' in data[0] && 'tools' in data[0] &&
                     'activities' in data[0] && 'goal' in data[0];
            }
          );
        } catch (e) {
          console.error('Failed to parse study plan:', e);
          throw new Error('Failed to parse study plan from AI response. The AI may not have returned the expected format.');
        }

        if (studyPlan.length === 0) {
          throw new Error('No study plan generated');
        }

        // Render study plan
        this.renderStudyPlan(studyPlan, daysUntilExam, hoursPerDay, contentArea);
      } else {
        throw new Error(result.error || 'Failed to generate study plan');
      }
    } catch (error) {
      console.error('Error generating study plan:', error);
      contentArea.innerHTML = `
        <div class="study-plan">
          <div style="text-align: center; padding: 20px; color: var(--record-color);">
            Failed to generate study plan: ${error instanceof Error ? error.message : 'Unknown error'}
          </div>
          <div style="text-align: center; padding: 10px; color: var(--text-tertiary);">
            Make sure Claude AI is configured in Settings.
          </div>
        </div>
      `;
    }
  }

  /**
   * Show study plan form
   */
  private showStudyPlanForm(session: Session, contentArea: HTMLElement): void {
    contentArea.innerHTML = `
      <div class="study-plan-form">
        <div class="plan-form-header">
          <h4>📅 Create Your Study Plan</h4>
          <p>Tell us about your exam, and we'll create a personalized study schedule</p>
        </div>

        <div class="plan-form-inputs">
          <div class="plan-form-group">
            <label for="days-until-exam">Days until exam:</label>
            <select id="days-until-exam" class="plan-form-select">
              <option value="1">1 day (cram session)</option>
              <option value="2">2 days</option>
              <option value="3" selected>3 days</option>
              <option value="5">5 days</option>
              <option value="7">1 week</option>
              <option value="14">2 weeks</option>
            </select>
          </div>

          <div class="plan-form-group">
            <label for="hours-per-day">Hours available per day:</label>
            <select id="hours-per-day" class="plan-form-select">
              <option value="1">1 hour</option>
              <option value="2" selected>2 hours</option>
              <option value="3">3 hours</option>
              <option value="4">4 hours</option>
              <option value="6">6 hours</option>
              <option value="8">8 hours (full day)</option>
            </select>
          </div>
        </div>

        <button class="plan-form-submit" id="generate-plan-btn">Generate Study Plan</button>
      </div>
    `;

    // Attach event listener
    const generateBtn = document.getElementById('generate-plan-btn');
    generateBtn?.addEventListener('click', () => {
      const daysSelect = document.getElementById('days-until-exam') as HTMLSelectElement;
      const hoursSelect = document.getElementById('hours-per-day') as HTMLSelectElement;

      const days = parseInt(daysSelect.value);
      const hours = parseInt(hoursSelect.value);

      this.generateStudyPlan(session, contentArea, days, hours);
    });
  }

  /**
   * Render study plan
   */
  private renderStudyPlan(plan: Array<{day: number; topics: string; tools: string[]; activities: Array<{activity: string; duration: string}>; goal: string}>, daysUntilExam: number, hoursPerDay: number, contentArea: HTMLElement): void {
    const totalHours = daysUntilExam * hoursPerDay;

    const daysHtml = plan.map(dayPlan => {
      const activitiesHtml = dayPlan.activities.map(activity => `
        <div class="plan-activity">
          <span class="plan-activity-name">${this.escapeHtml(activity.activity)}</span>
          <span class="plan-activity-duration">${this.escapeHtml(activity.duration)}</span>
        </div>
      `).join('');

      const toolsHtml = dayPlan.tools.map(tool => `
        <span class="plan-tool-badge">${this.escapeHtml(tool)}</span>
      `).join('');

      return `
        <div class="plan-day-card">
          <div class="plan-day-header">
            <span class="plan-day-number">Day ${dayPlan.day}</span>
            <span class="plan-day-topics">${this.escapeHtml(dayPlan.topics)}</span>
          </div>
          <div class="plan-day-goal">
            <strong>Goal:</strong> ${this.escapeHtml(dayPlan.goal)}
          </div>
          <div class="plan-day-tools">
            <strong>Use these tools:</strong>
            <div class="plan-tools-list">${toolsHtml}</div>
          </div>
          <div class="plan-day-activities">
            <strong>Schedule:</strong>
            ${activitiesHtml}
          </div>
        </div>
      `;
    }).join('');

    contentArea.innerHTML = `
      <div class="study-plan">
        <div class="plan-header">
          <h4>📅 Your ${daysUntilExam}-Day Study Plan</h4>
          <p>Total study time: ${totalHours} hours (${hoursPerDay}h/day)</p>
        </div>
        <div class="plan-days-grid">
          ${daysHtml}
        </div>
        <div class="plan-footer">
          <p>💡 Tip: Check off each activity as you complete it to track your progress!</p>
        </div>
      </div>
    `;
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
   * Escape HTML to prevent XSS attacks
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Extract and parse JSON array from AI response
   * @param responseData - The raw response from AI
   * @param contextName - Name for logging purposes (e.g., 'Flashcards', 'Quiz')
   * @param validator - Function to validate the parsed array structure
   * @returns Parsed and validated JSON array
   */
  private parseAIJsonResponse<T>(
    responseData: unknown,
    contextName: string,
    validator: (data: unknown[]) => data is T[]
  ): T[] {
    // Extract response text
    let responseText: string;
    if (typeof responseData === 'string') {
      responseText = responseData;
    } else if (responseData && typeof responseData === 'object' && 'message' in responseData) {
      responseText = (responseData as { message: string }).message;
    } else {
      responseText = JSON.stringify(responseData);
    }

    console.log(`🔍 ${contextName} - Raw AI response:`, responseText.substring(0, 200));

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

    if (!jsonText) {
      throw new Error('No JSON array found in response');
    }

    // Try parsing with two strategies
    try {
      // Try parsing as-is first
      console.log('🔧 Attempting to parse:', jsonText.substring(0, 100));
      const parsed = JSON.parse(jsonText);

      // Validate the structure
      if (validator(parsed)) {
        return parsed;
      } else {
        throw new Error(`Invalid ${contextName.toLowerCase()} structure`);
      }
    } catch (firstParseError) {
      // If first parse fails, try unescaping the string
      console.log('⚠️ First parse failed, trying to unescape...');
      const unescaped = jsonText.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
      const parsed = JSON.parse(unescaped);

      // Validate the structure
      if (validator(parsed)) {
        return parsed;
      } else {
        throw new Error(`Invalid ${contextName.toLowerCase()} structure`);
      }
    }
  }

  /**
   * Load child sessions for a multi-session study set
   */
  private async loadChildSessions(multiSession: Session): Promise<Session[]> {
    const childSessionIds = multiSession.childSessionIds || [];
    console.log(`🔍 loadChildSessions - Looking for child session IDs:`, childSessionIds);

    if (childSessionIds.length === 0) {
      console.warn('⚠️ No child session IDs found in multi-session study set');
      return [];
    }

    try {
      const result = await (window as any).scribeCat.session.list();

      if (result.success && result.sessions) {
        console.log(`📋 Loaded ${result.sessions.length} total sessions from IPC`);
        const childSessionData = childSessionIds
          .map((id: string) => result.sessions.find((s: any) => s.id === id))
          .filter((s: any) => s !== null && s !== undefined);

        // Import Session class for reconstruction
        const { Session: SessionClass } = await import('../../domain/entities/Session.js');

        // Convert plain JSON objects to Session instances with methods
        const childSessions = childSessionData.map((data: any) => SessionClass.fromJSON(data));

        console.log(`✅ Found ${childSessions.length} child sessions out of ${childSessionIds.length} IDs`);
        return childSessions;
      }

      console.error('❌ IPC session.list failed or returned no sessions');
      return [];
    } catch (error) {
      console.error('Failed to load child sessions:', error);
      return [];
    }
  }

  /**
   * Merge transcriptions from child sessions dynamically
   */
  private mergeTranscriptions(childSessions: Session[]): string {
    const transcriptionParts: string[] = [];

    childSessions.forEach((session, index) => {
      // Add session header
      transcriptionParts.push(
        `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `SESSION ${index + 1}: ${session.title}\n` +
        `Date: ${new Date(session.createdAt).toLocaleDateString()}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
      );

      // Add transcription content
      if (session.transcription && session.transcription.fullText) {
        transcriptionParts.push(session.transcription.fullText);
      } else {
        transcriptionParts.push('(No transcription available for this session)');
      }
    });

    return transcriptionParts.join('\n');
  }
}
