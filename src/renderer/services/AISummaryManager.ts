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
      const result = await window.scribeCat.ai.generateSummary(
        session.transcription.fullText,
        session.notes || undefined
      );

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
          concepts = this.parseAIJsonResponse(
            result.data,
            'Key Concepts',
            (data): data is Array<{ term: string; definition: string }> => {
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
          flashcards = this.parseAIJsonResponse(
            result.data,
            'Flashcards',
            (data): data is Array<{ question: string; answer: string }> => {
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
          questions = this.parseAIJsonResponse(
            result.data,
            'Quiz',
            (data): data is Array<{ question: string; options: string[]; correctAnswer: number }> => {
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
}
