/**
 * GamePollingFallback
 *
 * Provides polling as a fallback for unreliable Supabase Realtime subscriptions.
 */

import { GameSession } from '../../../../domain/entities/GameSession.js';
import { GameQuestion } from '../../../../domain/entities/GameQuestion.js';
import { MultiplayerGame } from '../../../components/games/MultiplayerGame.js';

export interface GamePollingCallbacks {
  getCurrentGameSession: () => GameSession | null;
  setCurrentGameSession: (session: GameSession) => void;
  getCurrentGame: () => MultiplayerGame | null;
  onGameStarted: () => void;
  onQuestionChanged: () => void;
}

export class GamePollingFallback {
  private waitingPollInterval: number | null = null;
  private questionPollInterval: number | null = null;
  private static readonly WAITING_POLL_INTERVAL_MS = 2000;
  private static readonly QUESTION_POLL_INTERVAL_MS = 1000;

  /**
   * Start polling for game status changes while in "waiting" state
   */
  startWaitingPoll(
    gameSessionId: string,
    callbacks: GamePollingCallbacks,
    onGameStart: (gameSession: GameSession, currentQuestion: GameQuestion | null, jeopardyBoardUpdate?: any) => void
  ): void {
    if (this.waitingPollInterval !== null) return;

    console.log('[GamePollingFallback] Starting waiting poll fallback');
    this.waitingPollInterval = window.setInterval(async () => {
      try {
        const result = await window.scribeCat.games.getGameSession(gameSessionId);
        if (!result.success || !result.gameSession) return;

        const gameSession = GameSession.fromJSON(result.gameSession);
        console.log(`[GamePollingFallback] Waiting poll: status=${gameSession.status}`);

        // If game started, fetch question and update state
        if (gameSession.status === 'in_progress') {
          this.stopWaitingPoll();
          callbacks.setCurrentGameSession(gameSession);

          // Fetch the current question (Jeopardy-aware logic)
          let currentQuestion: GameQuestion | null = null;
          let jeopardyBoardUpdate: any = null;

          if (gameSession.gameType === 'jeopardy') {
            const selectedQuestionId = gameSession.selectedQuestionId;
            if (selectedQuestionId) {
              console.log('[GamePollingFallback] Waiting poll: Jeopardy game with selected question:', selectedQuestionId);
              const questionResult = await window.scribeCat.games.getGameQuestion(gameSessionId, selectedQuestionId);
              currentQuestion = questionResult.success && questionResult.question
                ? GameQuestion.fromJSON(questionResult.question)
                : null;
            } else {
              console.log('[GamePollingFallback] Waiting poll: Jeopardy game, no question selected yet - reloading board');
              // Reload board when game starts
              const boardResult = await window.scribeCat.games.jeopardy.getBoard(gameSessionId);
              if (boardResult.success && boardResult.board && boardResult.board.length > 0) {
                console.log('[GamePollingFallback] Waiting poll: Board reloaded with', boardResult.board.length, 'questions');
                jeopardyBoardUpdate = boardResult.board;
              }
            }
          } else {
            // Other games use sequential question index
            const questionResult = await window.scribeCat.games.getCurrentQuestion(gameSessionId);
            currentQuestion = questionResult.success && questionResult.question
              ? GameQuestion.fromJSON(questionResult.question)
              : null;
          }

          console.log('[GamePollingFallback] Waiting poll detected game start, fetched question:', currentQuestion?.id);

          onGameStart(gameSession, currentQuestion, jeopardyBoardUpdate);
          callbacks.onGameStarted();
        }
      } catch (error) {
        console.error('[GamePollingFallback] Waiting poll error:', error);
      }
    }, GamePollingFallback.WAITING_POLL_INTERVAL_MS);
  }

  /**
   * Stop the waiting poll
   */
  stopWaitingPoll(): void {
    if (this.waitingPollInterval !== null) {
      clearInterval(this.waitingPollInterval);
      this.waitingPollInterval = null;
      console.log('[GamePollingFallback] Stopped waiting poll');
    }
  }

  /**
   * Start polling for question index changes during active gameplay
   */
  startQuestionPoll(
    gameSessionId: string,
    callbacks: GamePollingCallbacks
  ): void {
    if (this.questionPollInterval !== null) return;

    console.log('[GamePollingFallback] Starting question poll fallback');
    this.questionPollInterval = window.setInterval(async () => {
      try {
        const currentGameSession = callbacks.getCurrentGameSession();
        const currentGame = callbacks.getCurrentGame();

        if (!currentGameSession || !currentGame) {
          this.stopQuestionPoll();
          return;
        }

        const result = await window.scribeCat.games.getGameSession(gameSessionId);
        if (!result.success || !result.gameSession) return;

        const gameSession = GameSession.fromJSON(result.gameSession);

        // Determine what changed based on game type
        const isJeopardy = gameSession.gameType === 'jeopardy';
        let questionChanged = false;

        if (isJeopardy) {
          const previousSelectedId = currentGameSession.selectedQuestionId;
          const newSelectedId = gameSession.selectedQuestionId;
          questionChanged = newSelectedId !== previousSelectedId;
          if (questionChanged) {
            console.log(`[GamePollingFallback] Question poll detected Jeopardy question change: ${previousSelectedId} -> ${newSelectedId}`);
          }
        } else {
          const previousIndex = currentGameSession.currentQuestionIndex;
          const newIndex = gameSession.currentQuestionIndex;
          questionChanged = newIndex !== previousIndex;
          if (questionChanged) {
            console.log(`[GamePollingFallback] Question poll detected index change: ${previousIndex} -> ${newIndex}`);
          }
        }

        // If question changed, fetch the new question
        if (questionChanged) {
          callbacks.setCurrentGameSession(gameSession);

          let currentQuestion: GameQuestion | null = null;
          if (isJeopardy) {
            const selectedQuestionId = gameSession.selectedQuestionId;
            if (selectedQuestionId) {
              const questionResult = await window.scribeCat.games.getGameQuestion(gameSessionId, selectedQuestionId);
              currentQuestion = questionResult.success && questionResult.question
                ? GameQuestion.fromJSON(questionResult.question)
                : null;
            }
          } else {
            const questionResult = await window.scribeCat.games.getCurrentQuestion(gameSessionId);
            currentQuestion = questionResult.success && questionResult.question
              ? GameQuestion.fromJSON(questionResult.question)
              : null;
          }

          console.log(`[GamePollingFallback] Question poll fetched question:`, currentQuestion?.id);

          currentGame.updateState({
            session: gameSession,
            currentQuestion,
            hasAnswered: false,
            gameStarted: gameSession.status === 'in_progress',
            gameEnded: gameSession.hasEnded(),
            questionStartedAt: gameSession.updatedAt.getTime(),
          });

          // Update Jeopardy-specific state
          if (isJeopardy) {
            (currentGame as any).updateState({
              selectedQuestionId: gameSession.selectedQuestionId || null,
              currentPlayerId: gameSession.currentPlayerId || null,
              round: gameSession.round || 'regular',
            });
          }

          callbacks.onQuestionChanged();
        } else if (gameSession.hasEnded() && !currentGameSession.hasEnded()) {
          // Game ended
          console.log('[GamePollingFallback] Question poll detected game end');
          callbacks.setCurrentGameSession(gameSession);
          this.stopQuestionPoll();

          currentGame.updateState({
            session: gameSession,
            gameEnded: true,
          });
        }
      } catch (error) {
        console.error('[GamePollingFallback] Question poll error:', error);
      }
    }, GamePollingFallback.QUESTION_POLL_INTERVAL_MS);
  }

  /**
   * Stop the question poll
   */
  stopQuestionPoll(): void {
    if (this.questionPollInterval !== null) {
      clearInterval(this.questionPollInterval);
      this.questionPollInterval = null;
      console.log('[GamePollingFallback] Stopped question poll');
    }
  }

  /**
   * Stop all polling
   */
  stopAll(): void {
    this.stopWaitingPoll();
    this.stopQuestionPoll();
  }
}
