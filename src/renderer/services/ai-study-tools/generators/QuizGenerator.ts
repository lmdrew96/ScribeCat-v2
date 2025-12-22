/**
 * QuizGenerator
 *
 * Generates interactive quizzes with multiple choice questions
 */

import type { Session } from '../../../../domain/entities/Session.js';
import { BaseAIToolGenerator } from './BaseAIToolGenerator.js';
import { AIResponseParser } from '../utils/AIResponseParser.js';
import { escapeHtml } from '../../../utils/formatting.js';
import { getIconHTML } from '../../../utils/iconMap.js';

export class QuizGenerator extends BaseAIToolGenerator {
  /**
   * Generate a quiz from the session
   */
  static async generate(session: Session, contentArea: HTMLElement, questionCount?: number, forceRegenerate: boolean = false): Promise<void> {
    // If no question count provided, show selector first
    if (!questionCount) {
      this.showQuizSettings(session, contentArea);
      return;
    }

    // Check if we have saved results with the same question count
    if (!forceRegenerate && session.hasAIToolResult('quiz')) {
      const savedResult = session.getAIToolResult('quiz');
      if (savedResult && savedResult.data && savedResult.data.length === questionCount) {
        this.showLoadOrRegeneratePrompt(
          session,
          contentArea,
          savedResult,
          getIconHTML('pencil', { size: 24 }),
          'Quiz Available',
          `You have a ${questionCount}-question quiz generated on {date}.`,
          () => this.renderQuiz(savedResult.data, contentArea, session),
          () => this.generate(session, contentArea, questionCount, true)
        );
        return;
      }
    }

    // Show loading state
    this.showLoading(contentArea, `Generating ${questionCount} quiz questions...`);

    try {
      // Load transcription
      const transcription = await this.loadTranscription(session);
      if (!transcription) {
        this.showNoTranscriptionError(contentArea, 'quiz');
        return;
      }

      const { text: transcriptionText, isMultiSession } = transcription;

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

      const result = await this.callAI(prompt);

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

        // Save the results to session
        await this.saveResults(session, 'quiz', questions);

        // Render quiz with interactivity
        this.renderQuiz(questions, contentArea, session);
      } else {
        throw new Error(result.error || 'Failed to generate quiz');
      }
    } catch (error) {
      console.error('Error generating quiz:', error);
      this.showError(contentArea, 'quiz', error);
    }
  }

  /**
   * Show quiz settings selector
   */
  private static showQuizSettings(session: Session, contentArea: HTMLElement): void {
    contentArea.innerHTML = `
      <div class="study-quiz-settings">
        <div class="quiz-settings-header">
          <h4>${getIconHTML('pencil', { size: 18 })} Quiz Settings</h4>
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
  private static renderQuiz(questions: Array<{question: string; options: string[]; correctAnswer: number; explanation: string; session?: string}>, contentArea: HTMLElement, session?: Session): void {
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
              <div class="quiz-complete-icon">${getIconHTML('partyPopper', { size: 48 })}</div>
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
          <div class="${className}" data-index="${index}">
            ${optionLabels[index]}: ${escapeHtml(option)}
          </div>
        `;
      }).join('');

      contentArea.innerHTML = `
        <div class="study-quiz">
          <div class="quiz-progress">
            <div class="quiz-question-number">
              Question ${currentIndex + 1} of ${questions.length}
              ${question.session ? `<span class="quiz-session-badge">${escapeHtml(question.session)}</span>` : ''}
            </div>
            <div class="quiz-score">Score: ${score}/${currentIndex}</div>
          </div>

          <div class="quiz-question">
            <div class="quiz-question-text">${escapeHtml(question.question)}</div>
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
                  <strong>Explanation:</strong> ${escapeHtml(question.explanation)}
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
        options.forEach((option) => {
          option.addEventListener('click', () => {
            const index = parseInt((option as HTMLElement).dataset.index || '0');
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
   * Generate questions for multiplayer games
   * Returns raw question data without rendering UI
   */
  static async generateForMultiplayer(
    session: Session,
    questionCount: number,
    gameType: 'quiz_battle' | 'jeopardy' | 'bingo' | 'flashcards',
    options?: {
      categories?: string[];
      difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
    }
  ): Promise<Array<{
    question: string;
    options?: string[];
    correctAnswer: string;
    explanation?: string;
    category?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
  }>> {
    // Load transcription
    const transcription = await this.loadTranscription(session);

    if (!transcription) {
      throw new Error('No transcription available for this session');
    }

    const { text: transcriptionText, isMultiSession } = transcription;

    // Build prompt based on game type
    let prompt = '';

    switch (gameType) {
      case 'quiz_battle':
        prompt = `Create ${questionCount} competitive quiz questions for a multiplayer quiz battle game.

Requirements:
- Each question should have 4 multiple-choice options
- Questions should be challenging but fair
- Mix of difficulty levels: ${options?.difficulty || 'mixed'}
${options?.categories ? `- Focus on these categories: ${options.categories.join(', ')}` : ''}

For each question, provide:
1. "question": The question text
2. "options": Array of 4 answer choices
3. "correctAnswer": The exact text of the correct answer from the options array
4. "explanation": Brief explanation of why the answer is correct
5. "difficulty": "easy", "medium", or "hard"
${options?.categories ? '6. "category": Which category this question belongs to' : ''}

Format as a JSON array. Cover key concepts from the transcription.

${isMultiSession ? 'Note: This is a multi-session transcription. Create questions from ALL sessions.\n\n' : ''}Transcription:
${transcriptionText}`;
        break;

      case 'jeopardy':
        // For Jeopardy, always use 6 categories x 5 questions + 1 Final Jeopardy
        // Standard Jeopardy board is always 6x5
        const categoryList = options?.categories || [];
        const numCategories = 6; // Always 6 categories for standard Jeopardy board
        const regularQuestions = numCategories * 5; // 5 questions per category (100-500 points)
        const totalWithFinal = regularQuestions + 1; // +1 for Final Jeopardy

        prompt = `Create ${totalWithFinal} Jeopardy-style questions for a real Jeopardy game board.

BOARD STRUCTURE:
- ${numCategories} categories
- 5 questions per category (ranging from easy to hard)
- Questions will be worth 100, 200, 300, 400, and 500 points based on difficulty
- Plus 1 Final Jeopardy question (different category)

${categoryList.length >= 6 ? `CATEGORIES TO USE: ${categoryList.slice(0, 6).join(', ')}` : categoryList.length > 0 ? `Use these categories and create additional ones to reach 6 total: ${categoryList.join(', ')}` : `Create 6 distinct, relevant categories from the transcription content.`}

JEOPARDY FORMAT:
- Questions are phrased as answers/clues (e.g., "This psychologist is known for classical conditioning")
- Response options are phrased as questions (e.g., "Who is Ivan Pavlov?")

For each of the ${regularQuestions} regular questions, provide:
1. "question": The clue in Jeopardy format
2. "options": Array of 4 question-format responses (e.g., "Who is...", "What is...")
3. "correctAnswer": The exact text of the correct response from options
4. "category": ONE of the ${numCategories} category names (MUST distribute evenly - exactly 5 questions per category)
5. "difficulty": Map to point values:
   - "easy" = 100 points (first/easiest in category)
   - "easy-medium" = 200 points
   - "medium" = 300 points
   - "medium-hard" = 400 points
   - "hard" = 500 points (most difficult in category)
6. "explanation": Brief context about the answer
7. "columnPosition": 1-5 (position in category: 1=100pts, 2=200pts, 3=300pts, 4=400pts, 5=500pts)

For the Final Jeopardy question (#${totalWithFinal}), provide:
1. "question": A challenging final clue
2. "options": Array of 4 question-format responses
3. "correctAnswer": The correct response
4. "category": A DIFFERENT category from the main board (unique Final Jeopardy category)
5. "difficulty": "hard"
6. "explanation": Context
7. "isFinalJeopardy": true
8. "columnPosition": null

IMPORTANT:
- Distribute questions EVENLY across categories (exactly 5 per category)
- Within each category, order from easiest (100pts) to hardest (500pts)
- Final Jeopardy must use a different category

Format as a JSON array with ${totalWithFinal} questions total.

${isMultiSession ? 'Note: This is a multi-session transcription. Create questions from ALL sessions.\n\n' : ''}Transcription:
${transcriptionText}`;
        break;

      case 'bingo':
        prompt = `Create ${questionCount} concept items for a study Bingo game.

Requirements:
- Each item should be a KEY CONCEPT, term, or topic from the transcription
- Items should be concise (1-5 words)
- No duplicate concepts
- Cover a variety of topics from the material

For each item, provide:
1. "question": The concept/term (e.g., "Classical Conditioning", "Mitochondria", "Supply and Demand")
2. "correctAnswer": Same as question (for consistency)
3. "explanation": Brief definition or context (shown when marked)
4. "category": Topic area this belongs to

Format as a JSON array.

${isMultiSession ? 'Note: This is a multi-session transcription. Create items from ALL sessions.\n\n' : ''}Transcription:
${transcriptionText}`;
        break;

      case 'flashcards':
        prompt = `Create ${questionCount} flashcard questions for collaborative study.

Requirements:
- Each should test understanding of a key concept
- Questions should encourage discussion
- Mix of recall and application questions
${options?.difficulty ? `- Difficulty level: ${options.difficulty}` : ''}

For each flashcard, provide:
1. "question": The front of the card (question)
2. "correctAnswer": The back of the card (answer)
3. "explanation": Additional context or why this is important
4. "difficulty": "easy", "medium", or "hard"
${options?.categories ? '5. "category": Which category this belongs to' : ''}

Format as a JSON array.

${isMultiSession ? 'Note: This is a multi-session transcription. Create flashcards from ALL sessions.\n\n' : ''}Transcription:
${transcriptionText}`;
        break;

      default:
        throw new Error(`Unknown game type: ${gameType}`);
    }

    // Jeopardy needs more tokens due to large board (26 questions with options)
    const maxTokens = gameType === 'jeopardy' ? 16000 : undefined;
    const result = await this.callAI(prompt, maxTokens);

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to generate questions');
    }

    try {
      const questions = AIResponseParser.parseJsonArray(
        result.data,
        `${gameType} questions`,
        (data): data is Array<{
          question: string;
          options?: string[];
          correctAnswer: string;
          explanation?: string;
          category?: string;
          difficulty?: 'easy' | 'medium' | 'hard';
        }> => {
          return (
            Array.isArray(data) &&
            data.length > 0 &&
            typeof data[0] === 'object' &&
            'question' in data[0] &&
            'correctAnswer' in data[0]
          );
        }
      );

      if (questions.length === 0) {
        throw new Error('No questions generated');
      }

      return questions;
    } catch (e) {
      console.error('Failed to parse questions:', e);
      throw new Error(`Failed to parse ${gameType} questions from AI response`);
    }
  }
}
