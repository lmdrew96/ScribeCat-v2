/**
 * QuizGenerator
 *
 * Generates interactive quizzes with multiple choice questions
 */

import type { Session } from '../../../../domain/entities/Session.js';
import { MultiSessionHelper } from '../utils/MultiSessionHelper.js';
import { AIResponseParser } from '../utils/AIResponseParser.js';
import { HtmlHelper } from '../utils/HtmlHelper.js';

export class QuizGenerator {
  /**
   * Generate a quiz from the session
   */
  static async generate(session: Session, contentArea: HTMLElement, questionCount?: number): Promise<void> {
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
        const childSessions = await MultiSessionHelper.loadChildSessions(session);

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
        transcriptionText = MultiSessionHelper.mergeTranscriptions(childSessions);

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
          questions = AIResponseParser.parseJsonArray(
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
   * Show quiz settings selector
   */
  private static showQuizSettings(session: Session, contentArea: HTMLElement): void {
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
        this.generate(session, contentArea, count);
      });
    });
  }

  /**
   * Render interactive quiz
   */
  private static renderQuiz(questions: Array<{question: string; options: string[]; correctAnswer: number; explanation: string; session?: string}>, contentArea: HTMLElement): void {
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
            ${optionLabels[index]}: ${HtmlHelper.escapeHtml(option)}
          </div>
        `;
      }).join('');

      contentArea.innerHTML = `
        <div class="study-quiz">
          <div class="quiz-progress">
            <div class="quiz-question-number">
              Question ${currentIndex + 1} of ${questions.length}
              ${question.session ? `<span class="quiz-session-badge">${HtmlHelper.escapeHtml(question.session)}</span>` : ''}
            </div>
            <div class="quiz-score">Score: ${score}/${currentIndex}</div>
          </div>

          <div class="quiz-question">
            <div class="quiz-question-text">${HtmlHelper.escapeHtml(question.question)}</div>
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
                  <strong>Explanation:</strong> ${HtmlHelper.escapeHtml(question.explanation)}
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
}
