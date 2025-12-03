/**
 * GameQuestionProcessor
 *
 * Handles AI question generation and post-processing for multiplayer games.
 */

import { GameSession } from '../../../../domain/entities/GameSession.js';
import { Session } from '../../../../domain/entities/Session.js';
import { QuizGenerator } from '../../../services/ai-study-tools/generators/QuizGenerator.js';

export class GameQuestionProcessor {
  /**
   * Generate questions for a game using AI (runs in background)
   */
  static async generateQuestionsAsync(gameSession: GameSession, session: Session): Promise<void> {
    const questionCount = gameSession.getTotalQuestions();

    // Generate questions using QuizGenerator
    const generatedQuestions = await QuizGenerator.generateForMultiplayer(
      session,
      questionCount,
      gameSession.gameType,
      {
        difficulty: gameSession.config.difficulty,
        categories: gameSession.config.categories,
      }
    );

    // Post-process Jeopardy questions
    let processedQuestions = generatedQuestions;
    if (gameSession.gameType === 'jeopardy') {
      processedQuestions = GameQuestionProcessor.processJeopardyQuestions(generatedQuestions);
    }

    // Create questions in database
    const questionParams = processedQuestions.map((q: any, index) => {
      // Map difficulty to allowed values (easy, medium, hard)
      let difficulty = q.difficulty || 'medium';
      if (difficulty === 'easy-medium') difficulty = 'easy';
      if (difficulty === 'medium-hard') difficulty = 'hard';

      return {
        gameSessionId: gameSession.id,
        questionIndex: index,
        questionData: {
          question: q.question,
          options: q.options,
          questionType: 'multiple_choice',
          explanation: q.explanation,
        },
        correctAnswer: q.correctAnswer,
        category: q.category,
        difficulty,
        points: q.points || gameSession.config.pointsPerQuestion || 100,
        timeLimitSeconds: gameSession.config.timePerQuestion || 30,
        // Jeopardy-specific fields
        columnPosition: q.columnPosition,
        isDailyDouble: q.isDailyDouble || false,
        isFinalJeopardy: q.isFinalJeopardy || false,
      };
    });

    const result = await window.scribeCat.games.createGameQuestions(questionParams);

    if (!result.success) {
      throw new Error(result.error || 'Failed to create game questions');
    }

    // Emit event when questions are ready
    window.dispatchEvent(
      new CustomEvent('game:questions-ready', {
        detail: { gameSessionId: gameSession.id },
      })
    );
  }

  /**
   * Process Jeopardy questions to add point values, Daily Doubles, etc.
   */
  static processJeopardyQuestions(questions: any[]): any[] {
    // Map difficulty to point values
    const difficultyToPoints: Record<string, number> = {
      'easy': 100,
      'easy-medium': 200,
      'medium': 300,
      'medium-hard': 400,
      'hard': 500,
    };

    // Assign points based on difficulty and columnPosition
    const processed = questions.map((q) => {
      // If AI provided columnPosition, use that to determine points
      let points = 100;
      if (q.columnPosition) {
        points = q.columnPosition * 100; // 1=100, 2=200, 3=300, 4=400, 5=500
      } else if (q.difficulty && difficultyToPoints[q.difficulty]) {
        points = difficultyToPoints[q.difficulty];
      }

      return {
        ...q,
        points,
        columnPosition: q.columnPosition || Math.ceil(points / 100),
        isFinalJeopardy: q.isFinalJeopardy || false,
        isDailyDouble: false, // Will be set below
      };
    });

    // Separate Final Jeopardy from regular questions
    const regularQuestions = processed.filter((q) => !q.isFinalJeopardy);
    const finalJeopardy = processed.filter((q) => q.isFinalJeopardy);

    // Select 1-2 Daily Doubles from non-first-row questions
    const eligibleForDD = regularQuestions.filter((q) => q.columnPosition > 1); // Not 100-point questions
    if (eligibleForDD.length > 0) {
      // Randomly select 1-2 Daily Doubles
      const numDailyDoubles = Math.min(2, eligibleForDD.length);
      const shuffled = [...eligibleForDD].sort(() => Math.random() - 0.5);

      for (let i = 0; i < numDailyDoubles; i++) {
        const ddQuestion = shuffled[i];
        const index = regularQuestions.indexOf(ddQuestion);
        if (index !== -1) {
          regularQuestions[index].isDailyDouble = true;
        }
      }
    }

    // Return regular questions + Final Jeopardy at the end
    return [...regularQuestions, ...finalJeopardy];
  }
}
