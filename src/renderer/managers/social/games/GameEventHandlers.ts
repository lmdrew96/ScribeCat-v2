/**
 * GameEventHandlers
 *
 * Handles all game-related window events (answer submission, game start, etc.)
 */

import { GameSession } from '../../../../domain/entities/GameSession.js';
import { GameQuestion } from '../../../../domain/entities/GameQuestion.js';
import { MultiplayerGame, GameParticipant } from '../../../components/games/MultiplayerGame.js';

export interface GameEventHandlerCallbacks {
  getCurrentGameSession: () => GameSession | null;
  setCurrentGameSession: (session: GameSession) => void;
  getCurrentGame: () => MultiplayerGame | null;
  getCurrentUserId: () => string | null;
  getParticipants: () => GameParticipant[];
  cleanup: () => Promise<void>;
  destroyLobbyChatPanel: () => void;
}

export class GameEventHandlers {
  // Bound event handlers stored as properties for proper cleanup
  private boundHandleAnswerSubmit: (event: Event) => Promise<void>;
  private boundHandleGameStart: (event: Event) => Promise<void>;
  private boundHandleGameClose: (event: Event) => Promise<void>;
  private boundHandleGameExit: (event: Event) => Promise<void>;
  private boundHandleNextQuestion: (event: Event) => Promise<void>;
  private boundHandleTimeout: (event: Event) => Promise<void>;
  private boundHandleBingo: (event: Event) => Promise<void>;
  private boundHandleQuestionsReady: (event: Event) => Promise<void>;
  private boundHandleJeopardyQuestionAnswered: (event: Event) => Promise<void>;
  private boundHandleJeopardyBoardComplete: (event: Event) => Promise<void>;

  private callbacks: GameEventHandlerCallbacks;

  constructor(callbacks: GameEventHandlerCallbacks) {
    this.callbacks = callbacks;

    // Bind handlers
    this.boundHandleAnswerSubmit = this.handleAnswerSubmit.bind(this);
    this.boundHandleGameStart = this.handleGameStart.bind(this);
    this.boundHandleGameClose = this.handleGameClose.bind(this);
    this.boundHandleGameExit = this.handleGameExit.bind(this);
    this.boundHandleNextQuestion = this.handleNextQuestion.bind(this);
    this.boundHandleTimeout = this.handleTimeout.bind(this);
    this.boundHandleBingo = this.handleBingo.bind(this);
    this.boundHandleQuestionsReady = this.handleQuestionsReady.bind(this);
    this.boundHandleJeopardyQuestionAnswered = this.handleJeopardyQuestionAnswered.bind(this);
    this.boundHandleJeopardyBoardComplete = this.handleJeopardyBoardComplete.bind(this);
  }

  /**
   * Setup all game event listeners
   */
  setupListeners(): void {
    window.addEventListener('game:answer', this.boundHandleAnswerSubmit);
    window.addEventListener('game:start', this.boundHandleGameStart);
    window.addEventListener('game:close', this.boundHandleGameClose);
    window.addEventListener('game:exit', this.boundHandleGameExit);
    window.addEventListener('game:next-question', this.boundHandleNextQuestion);
    window.addEventListener('game:timeout', this.boundHandleTimeout);
    window.addEventListener('game:bingo', this.boundHandleBingo);
    window.addEventListener('game:questions-ready', this.boundHandleQuestionsReady);
    window.addEventListener('game:jeopardy:question-answered', this.boundHandleJeopardyQuestionAnswered);
    window.addEventListener('game:jeopardy:board-complete', this.boundHandleJeopardyBoardComplete);
  }

  /**
   * Remove all game event listeners
   */
  removeListeners(): void {
    window.removeEventListener('game:answer', this.boundHandleAnswerSubmit);
    window.removeEventListener('game:start', this.boundHandleGameStart);
    window.removeEventListener('game:close', this.boundHandleGameClose);
    window.removeEventListener('game:exit', this.boundHandleGameExit);
    window.removeEventListener('game:next-question', this.boundHandleNextQuestion);
    window.removeEventListener('game:timeout', this.boundHandleTimeout);
    window.removeEventListener('game:bingo', this.boundHandleBingo);
    window.removeEventListener('game:questions-ready', this.boundHandleQuestionsReady);
    window.removeEventListener('game:jeopardy:question-answered', this.boundHandleJeopardyQuestionAnswered);
    window.removeEventListener('game:jeopardy:board-complete', this.boundHandleJeopardyBoardComplete);
  }

  /**
   * Handle answer submission
   */
  private async handleAnswerSubmit(event: Event): Promise<void> {
    const customEvent = event as CustomEvent<{ answer: string; timeTakenMs: number }>;
    const { answer, timeTakenMs } = customEvent.detail;

    const currentGameSession = this.callbacks.getCurrentGameSession();
    const currentGame = this.callbacks.getCurrentGame();
    const currentUserId = this.callbacks.getCurrentUserId();

    if (!currentGameSession) {
      console.error('[GameEventHandlers] Cannot submit answer: No active game session');
      return;
    }

    if (!currentGame) {
      console.error('[GameEventHandlers] Cannot submit answer: No current game instance');
      return;
    }

    if (!currentUserId) {
      console.error('[GameEventHandlers] CRITICAL: Cannot submit answer - currentUserId is null!');
      return;
    }

    const currentQuestion = (currentGame as any).state?.currentQuestion;
    if (!currentQuestion) {
      console.warn('[GameEventHandlers] Cannot submit answer: No current question');
      return;
    }

    console.log(`[GameEventHandlers] Submitting answer for user ${currentUserId}:`, {
      gameSessionId: currentGameSession.id,
      questionId: currentQuestion.id,
      answer,
      timeTakenMs,
    });

    try {
      const result = await window.scribeCat.games.submitAnswer({
        gameSessionId: currentGameSession.id,
        userId: currentUserId,
        questionId: currentQuestion.id,
        answer,
        timeTakenMs,
      });

      if (result.success) {
        console.log(`[GameEventHandlers] Answer submitted successfully for user ${currentUserId}`);
        currentGame.updateState({ hasAnswered: true });

        // Fetch correct answer details
        const correctAnswerResult = await window.scribeCat.games.getCorrectAnswer({
          gameSessionId: currentGameSession.id,
          questionId: currentQuestion.id,
          userId: currentUserId,
        });

        if (correctAnswerResult.success && correctAnswerResult.result) {
          window.dispatchEvent(
            new CustomEvent('game:answer-reveal', {
              detail: {
                correctAnswerIndex: correctAnswerResult.result.correctAnswerIndex,
                explanation: correctAnswerResult.result.explanation,
                wasCorrect: result.score?.isCorrect || false,
              },
            })
          );
        }
      } else {
        console.error('[GameEventHandlers] Answer submission failed:', result.error);
      }
    } catch (error) {
      console.error('[GameEventHandlers] Exception while submitting answer:', error);
    }
  }

  /**
   * Handle game start (when host clicks "Start Game" button)
   */
  private async handleGameStart(event: Event): Promise<void> {
    const currentGameSession = this.callbacks.getCurrentGameSession();

    if (!currentGameSession) {
      console.warn('[GameEventHandlers] handleGameStart: No current game session');
      return;
    }

    console.log('[GameEventHandlers] Host starting game from waiting screen');

    try {
      const result = await window.scribeCat.games.startGame(currentGameSession.id);

      if (!result.success) {
        console.error('[GameEventHandlers] Failed to start game:', result.error);
        return;
      }

      console.log('[GameEventHandlers] Game started successfully');
      this.callbacks.destroyLobbyChatPanel();

      // For Jeopardy, set the initial current player
      const participants = this.callbacks.getParticipants();
      if (currentGameSession.gameType === 'jeopardy' && participants.length > 0) {
        const hostPlayer = participants.find(p => p.isHost) || participants[0];
        console.log('[GameEventHandlers] Setting initial Jeopardy player (host):', hostPlayer.userName);

        await window.scribeCat.games.jeopardy.setCurrentPlayer({
          gameSessionId: currentGameSession.id,
          userId: hostPlayer.userId,
        });
      }
    } catch (error) {
      console.error('[GameEventHandlers] Exception in handleGameStart:', error);
    }
  }

  /**
   * Handle game close (from completion screen)
   */
  private async handleGameClose(event: Event): Promise<void> {
    const currentGameSession = this.callbacks.getCurrentGameSession();

    if (currentGameSession && !currentGameSession.hasEnded()) {
      console.log('[GameEventHandlers] Completing game before close');
      try {
        await window.scribeCat.games.completeGame(currentGameSession.id);
      } catch (error) {
        console.error('Failed to complete game:', error);
      }
    }

    await this.callbacks.cleanup();

    const closeEvent = new CustomEvent('multiplayer-game:closed');
    window.dispatchEvent(closeEvent);
  }

  /**
   * Handle game exit (mid-game exit)
   */
  private async handleGameExit(event: Event): Promise<void> {
    const currentGameSession = this.callbacks.getCurrentGameSession();

    if (currentGameSession && !currentGameSession.hasEnded()) {
      console.log('[GameEventHandlers] Cancelling game due to exit');
      try {
        await window.scribeCat.games.cancelGame(currentGameSession.id);
      } catch (error) {
        console.error('Failed to cancel game:', error);
      }
    }

    await this.callbacks.cleanup();

    const closeEvent = new CustomEvent('multiplayer-game:closed');
    window.dispatchEvent(closeEvent);
  }

  /**
   * Handle next question
   */
  private async handleNextQuestion(event: Event): Promise<void> {
    const currentGameSession = this.callbacks.getCurrentGameSession();

    console.log('[GameEventHandlers] handleNextQuestion called');

    if (!currentGameSession) {
      console.warn('[GameEventHandlers] handleNextQuestion: No current game session');
      return;
    }

    const isLast = currentGameSession.isLastQuestion();

    console.log(`[GameEventHandlers] Question ${currentGameSession.currentQuestionIndex + 1}/${currentGameSession.getTotalQuestions()}, isLastQuestion: ${isLast}`);

    try {
      if (isLast) {
        console.log('[GameEventHandlers] Last question reached - completing game');
        const result = await window.scribeCat.games.completeGame(currentGameSession.id);
        if (!result.success) {
          console.error('[GameEventHandlers] Failed to complete game:', result.error);
        }
      } else {
        console.log('[GameEventHandlers] Advancing to next question');
        const result = await window.scribeCat.games.nextQuestion(currentGameSession.id);
        if (!result.success) {
          console.error('[GameEventHandlers] Failed to advance to next question:', result.error);
        }
      }
    } catch (error) {
      console.error('[GameEventHandlers] Exception in handleNextQuestion:', error);
    }
  }

  /**
   * Handle timeout
   */
  private async handleTimeout(event: Event): Promise<void> {
    const currentGameSession = this.callbacks.getCurrentGameSession();
    const currentUserId = this.callbacks.getCurrentUserId();

    if (!currentGameSession || !currentUserId) return;

    console.log('[GameEventHandlers] Timeout - advancing to next question');
    await this.handleNextQuestion(event);
  }

  /**
   * Handle bingo
   */
  private async handleBingo(event: Event): Promise<void> {
    const currentGameSession = this.callbacks.getCurrentGameSession();
    const currentUserId = this.callbacks.getCurrentUserId();

    if (!currentGameSession || !currentUserId) return;

    const customEvent = event as CustomEvent<{ userId: string }>;
    const { userId } = customEvent.detail;

    console.log('[GameEventHandlers] BINGO achieved by user:', userId);

    try {
      const result = await window.scribeCat.games.completeGame(currentGameSession.id);
      if (!result.success) {
        console.error('[GameEventHandlers] Failed to complete game:', result.error);
      } else {
        console.log('[GameEventHandlers] Game completed due to BINGO');
      }
    } catch (error) {
      console.error('[GameEventHandlers] Exception in handleBingo:', error);
    }
  }

  /**
   * Handle questions ready
   */
  private async handleQuestionsReady(event: Event): Promise<void> {
    const currentGameSession = this.callbacks.getCurrentGameSession();
    const currentGame = this.callbacks.getCurrentGame();

    if (!currentGameSession || !currentGame) return;

    const customEvent = event as CustomEvent<{ gameSessionId: string }>;
    const { gameSessionId } = customEvent.detail;

    if (gameSessionId !== currentGameSession.id) return;

    console.log('[GameEventHandlers] Questions ready for game:', gameSessionId);

    try {
      if (currentGameSession.gameType === 'jeopardy') {
        console.log('[GameEventHandlers] Jeopardy questions ready - reloading board...');
        const boardResult = await window.scribeCat.games.jeopardy.getBoard(gameSessionId);

        if (boardResult.success && boardResult.board) {
          console.log('[GameEventHandlers] Board reloaded with', boardResult.board.length, 'questions');
          (currentGame as any).updateState({
            board: boardResult.board,
            questionsReady: true,
          });
        }
      } else {
        const questionResult = await window.scribeCat.games.getCurrentQuestion(gameSessionId);

        if (questionResult.success && questionResult.question) {
          const currentQuestion = GameQuestion.fromJSON(questionResult.question);
          currentGame.updateState({
            currentQuestion,
            questionsReady: true,
          });
          console.log('[GameEventHandlers] Questions loaded - Start button now enabled');
        }
      }
    } catch (error) {
      console.error('[GameEventHandlers] Exception in handleQuestionsReady:', error);
    }
  }

  /**
   * Handle Jeopardy question answered
   */
  private async handleJeopardyQuestionAnswered(event: Event): Promise<void> {
    const currentGameSession = this.callbacks.getCurrentGameSession();
    const currentUserId = this.callbacks.getCurrentUserId();

    if (!currentGameSession || !currentUserId) return;

    const customEvent = event as CustomEvent<{
      userId: string;
      isCorrect: boolean;
      wasFirstBuzzer: boolean;
    }>;
    const { userId, isCorrect, wasFirstBuzzer } = customEvent.detail;

    console.log('[GameEventHandlers] Jeopardy question answered:', { userId, isCorrect, wasFirstBuzzer });

    try {
      if (wasFirstBuzzer && isCorrect) {
        console.log('[GameEventHandlers] Correct answer - player selects next');
        return;
      }

      if (!isCorrect) {
        console.log('[GameEventHandlers] Wrong answer - finding lowest scoring player');

        const lowestResult = await window.scribeCat.games.jeopardy.getLowestScoringPlayer(
          currentGameSession.id
        );

        if (lowestResult.success && lowestResult.userId) {
          await window.scribeCat.games.jeopardy.setCurrentPlayer({
            gameSessionId: currentGameSession.id,
            userId: lowestResult.userId,
          });
          console.log('[GameEventHandlers] Lowest scoring player set as current');
        }
      }
    } catch (error) {
      console.error('[GameEventHandlers] Exception in handleJeopardyQuestionAnswered:', error);
    }
  }

  /**
   * Handle Jeopardy board complete
   */
  private async handleJeopardyBoardComplete(event: Event): Promise<void> {
    const currentGameSession = this.callbacks.getCurrentGameSession();

    if (!currentGameSession) return;

    console.log('[GameEventHandlers] Jeopardy board complete - checking for Final Jeopardy');

    try {
      const completeResult = await window.scribeCat.games.jeopardy.isBoardComplete(
        currentGameSession.id
      );

      if (completeResult.success && completeResult.isComplete) {
        console.log('[GameEventHandlers] Advancing to Final Jeopardy');
        await window.scribeCat.games.jeopardy.advanceToFinal(currentGameSession.id);
        console.log('[GameEventHandlers] Final Jeopardy initiated');
      }
    } catch (error) {
      console.error('[GameEventHandlers] Exception in handleJeopardyBoardComplete:', error);
    }
  }
}
