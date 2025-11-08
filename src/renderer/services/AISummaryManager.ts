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
        let summary = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);

        // Ensure summary is no longer than 150 characters
        if (summary.length > 150) {
          summary = summary.substring(0, 147) + '...';
        }

        // Save summary to session via IPC
        await (window as any).scribeCat.session.updateSummary(sessionId, summary);
        console.log(`✅ Short summary saved for session ${sessionId}: ${summary}`);
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
1. Create a question on the front
2. Provide a clear answer on the back
3. Include which session the content is from (e.g., "(Session 1)" or "(Sessions 2-3)")

Format as a JSON array with objects containing "question", "answer", and "session" fields. Cover important concepts from ALL sessions.

Transcription:
${transcriptionText}`
        : `Create 5-7 flashcards from this transcription. Each flashcard should have a question on the front and an answer on the back. Format as a JSON array with objects containing "question" and "answer" fields. Focus on the most important concepts and facts.

Transcription:
${transcriptionText}`;

      const result = await window.scribeCat.ai.chat(prompt, [], {
        includeTranscription: false,
        includeNotes: false
      });

      if (result.success && result.data) {
        // result.data is a string response from AI
        let flashcards: Array<{question: string; answer: string; session?: string}> = [];

        try {
          flashcards = this.parseAIJsonResponse(
            result.data,
            'Flashcards',
            (data): data is Array<{ question: string; answer: string; session?: string }> => {
              return Array.isArray(data) && data.length > 0 &&
                     typeof data[0] === 'object' && 'question' in data[0] && 'answer' in data[0];
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
  private renderFlashcards(flashcards: Array<{question: string; answer: string; session?: string}>, contentArea: HTMLElement): void {
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
   * Generate a quiz from the session
   */
  async generateQuiz(session: Session, contentArea: HTMLElement): Promise<void> {
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
        ? `Create 8-10 multiple-choice quiz questions from this MULTI-SESSION study set. The transcription contains content from multiple sessions marked with headers like "━━━ SESSION 1: Title ━━━".

For each question:
1. Create a clear question that tests understanding
2. Provide 4 options (A, B, C, D) with one correct answer
3. Indicate which session the content is from (e.g., "Session 1" or "Session 2-3")

Format as a JSON array with objects containing "question", "options" (array of 4 strings), "correctAnswer" (0-3 index), and "session" (string). Cover content from ALL sessions.

Transcription:
${transcriptionText}`
        : `Create 5 multiple-choice quiz questions from this transcription. Each question should have 4 options (A, B, C, D) with one correct answer. Format as a JSON array with objects containing "question", "options" (array of 4 strings), and "correctAnswer" (0-3 index). Focus on testing understanding of key concepts.

Transcription:
${transcriptionText}`;

      const result = await window.scribeCat.ai.chat(prompt, [], {
        includeTranscription: false,
        includeNotes: false
      });

      if (result.success && result.data) {
        // result.data is a string response from AI
        let questions: Array<{question: string; options: string[]; correctAnswer: number; session?: string}> = [];

        try {
          questions = this.parseAIJsonResponse(
            result.data,
            'Quiz',
            (data): data is Array<{ question: string; options: string[]; correctAnswer: number; session?: string }> => {
              return Array.isArray(data) && data.length > 0 &&
                     typeof data[0] === 'object' && 'question' in data[0] &&
                     'options' in data[0] && 'correctAnswer' in data[0] &&
                     typeof data[0].correctAnswer === 'number';
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
  private renderQuiz(questions: Array<{question: string; options: string[]; correctAnswer: number; session?: string}>, contentArea: HTMLElement): void {
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
