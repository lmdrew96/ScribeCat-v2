/**
 * GameRealtimeSubscriptions
 *
 * Manages Supabase Realtime subscriptions for game updates.
 * Uses direct renderer subscriptions (WebSockets don't work in main process).
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { GameSession } from '../../../../domain/entities/GameSession.js';
import { GameQuestion } from '../../../../domain/entities/GameQuestion.js';
import { MultiplayerGame } from '../../../components/games/MultiplayerGame.js';
import { RendererSupabaseClient } from '../../../services/RendererSupabaseClient.js';

export interface GameSubscriptionCallbacks {
  getCurrentGameSession: () => GameSession | null;
  setCurrentGameSession: (session: GameSession) => void;
  getCurrentGame: () => MultiplayerGame | null;
  onSessionUpdate: (gameSession: GameSession, payload: any) => void;
  onScoreReceived: (scoreData: any) => void;
}

export class GameRealtimeSubscriptions {
  private gameSessionChannel: RealtimeChannel | null = null;
  private gameQuestionsChannel: RealtimeChannel | null = null;
  private gameScoresChannel: RealtimeChannel | null = null;

  /**
   * Subscribe to real-time game updates
   */
  subscribeToGameUpdates(
    gameSessionId: string,
    callbacks: GameSubscriptionCallbacks
  ): void {
    console.log('📡 GameRealtimeSubscriptions: Setting up direct Supabase subscriptions in renderer');

    const rendererClient = RendererSupabaseClient.getInstance();
    const client = rendererClient.getClient();

    if (!client) {
      console.error('❌ GameRealtimeSubscriptions: No Supabase client available in renderer');
      return;
    }

    // Cleanup existing subscriptions
    this.cleanupChannels();

    // 1. Subscribe to game session updates
    this.subscribeToGameSession(client, gameSessionId, callbacks);

    // 2. Subscribe to new questions
    this.subscribeToQuestions(client, gameSessionId, callbacks);

    // 3. Subscribe to new scores
    this.subscribeToScores(client, gameSessionId, callbacks);

    console.log('📡 GameRealtimeSubscriptions: All game subscriptions set up (direct renderer)');
  }

  private subscribeToGameSession(
    client: any,
    gameSessionId: string,
    callbacks: GameSubscriptionCallbacks
  ): void {
    const sessionChannelName = `game-session:${gameSessionId}`;
    this.gameSessionChannel = client
      .channel(sessionChannelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_sessions',
          filter: `id=eq.${gameSessionId}`,
        },
        async (payload: any) => {
          console.log('🔥 GameRealtimeSubscriptions: Game session update received:', payload);

          const gameSession = GameSession.fromDatabase(payload.new as any);
          const previousSession = callbacks.getCurrentGameSession();
          const previousIndex = previousSession?.currentQuestionIndex;
          const previousStatus = previousSession?.status;
          const currentGame = callbacks.getCurrentGame();
          const currentQuestion = currentGame ? (currentGame as any).state?.currentQuestion : null;

          console.log(`[GameRealtimeSubscriptions] Session update: ${previousStatus} -> ${gameSession.status}, index: ${previousIndex} -> ${gameSession.currentQuestionIndex}, hasQuestion: ${!!currentQuestion}`);

          callbacks.setCurrentGameSession(gameSession);

          // Check if we need to fetch a question
          const isJeopardy = gameSession.gameType === 'jeopardy';
          const selectedQuestionId = gameSession.selectedQuestionId;
          const previousSelectedId = (currentGame as any)?.state?.selectedQuestionId;

          const questionIndexChanged = previousIndex !== undefined && previousIndex !== gameSession.currentQuestionIndex;
          const selectedQuestionChanged = isJeopardy && selectedQuestionId !== previousSelectedId;
          const gameJustStarted = previousStatus === 'waiting' && gameSession.status === 'in_progress';
          const missingQuestion = gameSession.status === 'in_progress' && !currentQuestion;
          const needsQuestionFetch = questionIndexChanged || selectedQuestionChanged || gameJustStarted || missingQuestion;

          if (needsQuestionFetch) {
            console.log(`[GameRealtimeSubscriptions] Fetching question - indexChanged: ${questionIndexChanged}, selectedChanged: ${selectedQuestionChanged}, gameJustStarted: ${gameJustStarted}, missingQuestion: ${missingQuestion}`);

            // Small delay to ensure the database write has fully propagated
            await new Promise(resolve => setTimeout(resolve, 150));

            let fetchedQuestion: GameQuestion | null = null;

            if (isJeopardy && selectedQuestionId) {
              const questionResult = await window.scribeCat.games.getGameQuestion(gameSessionId, selectedQuestionId);
              if (questionResult.success && questionResult.question) {
                fetchedQuestion = GameQuestion.fromJSON(questionResult.question);
                console.log(`[GameRealtimeSubscriptions] Fetched Jeopardy question ${selectedQuestionId}:`, fetchedQuestion.id);
              }
            } else if (isJeopardy && !selectedQuestionId) {
              console.log(`[GameRealtimeSubscriptions] Jeopardy game - no question selected, showing board`);
              fetchedQuestion = null;
            } else {
              const questionResult = await window.scribeCat.games.getCurrentQuestion(gameSessionId);
              fetchedQuestion = questionResult.success && questionResult.question
                ? GameQuestion.fromJSON(questionResult.question)
                : null;
              console.log(`[GameRealtimeSubscriptions] Fetched question for index ${gameSession.currentQuestionIndex}:`, fetchedQuestion?.id);
            }

            if (currentGame) {
              const questionStartedAt = gameSession.questionStartedAt?.getTime();

              const stateUpdate: any = {
                session: gameSession,
                currentQuestion: fetchedQuestion,
                hasAnswered: false,
                gameStarted: gameSession.status === 'in_progress',
                gameEnded: gameSession.hasEnded(),
                questionStartedAt,
              };

              if (isJeopardy) {
                stateUpdate.selectedQuestionId = gameSession.selectedQuestionId || null;
                stateUpdate.currentPlayerId = gameSession.currentPlayerId || null;
                stateUpdate.round = gameSession.round || 'regular';
              }

              currentGame.updateState(stateUpdate);
            }
          } else if (currentGame) {
            currentGame.updateState({
              session: gameSession,
              gameStarted: gameSession.status === 'in_progress',
              gameEnded: gameSession.hasEnded(),
            });

            if (isJeopardy) {
              (currentGame as any).updateState({
                currentPlayerId: (payload.new as any).current_player_id || null,
                round: (payload.new as any).round || 'regular',
              });
            }
          }

          callbacks.onSessionUpdate(gameSession, payload);
        }
      );

    this.gameSessionChannel.subscribe((status: string, err: any) => {
      console.log(`📡 GameRealtimeSubscriptions: Game session subscription status: ${status}`);
      if (err) {
        console.error('❌ GameRealtimeSubscriptions: Game session subscription error:', err);
      }
      if (status === 'SUBSCRIBED') {
        console.log('✅ GameRealtimeSubscriptions: Game session subscribed in RENDERER process');
      }
    });
  }

  private subscribeToQuestions(
    client: any,
    gameSessionId: string,
    callbacks: GameSubscriptionCallbacks
  ): void {
    const questionsChannelName = `game-questions:${gameSessionId}`;
    this.gameQuestionsChannel = client
      .channel(questionsChannelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_questions',
          filter: `game_session_id=eq.${gameSessionId}`,
        },
        (payload: any) => {
          console.log('🔥 GameRealtimeSubscriptions: New game question received:', payload);

          const question = GameQuestion.fromDatabase(payload.new as any);
          const currentGameSession = callbacks.getCurrentGameSession();
          const currentGame = callbacks.getCurrentGame();

          if (currentGame && currentGameSession) {
            if (question.questionIndex === currentGameSession.currentQuestionIndex) {
              currentGame.updateState({
                currentQuestion: question,
                hasAnswered: false,
              });
            }
          }
        }
      );

    this.gameQuestionsChannel.subscribe((status: string, err: any) => {
      console.log(`📡 GameRealtimeSubscriptions: Game questions subscription status: ${status}`);
      if (err) {
        console.error('❌ GameRealtimeSubscriptions: Game questions subscription error:', err);
      }
      if (status === 'SUBSCRIBED') {
        console.log('✅ GameRealtimeSubscriptions: Game questions subscribed in RENDERER process');
      }
    });
  }

  private subscribeToScores(
    client: any,
    gameSessionId: string,
    callbacks: GameSubscriptionCallbacks
  ): void {
    const scoresChannelName = `game-scores:${gameSessionId}`;
    this.gameScoresChannel = client
      .channel(scoresChannelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'player_scores',
          filter: `game_session_id=eq.${gameSessionId}`,
        },
        async (payload: any) => {
          console.log('🔥 GameRealtimeSubscriptions: New player score received:', payload);

          // Reload leaderboard
          await this.refreshLeaderboard(gameSessionId, callbacks.getCurrentGame());

          // Notify about score received
          const scoreData = payload.new as any;
          if (scoreData) {
            callbacks.onScoreReceived(scoreData);
          }
        }
      );

    this.gameScoresChannel.subscribe((status: string, err: any) => {
      console.log(`📡 GameRealtimeSubscriptions: Game scores subscription status: ${status}`);
      if (err) {
        console.error('❌ GameRealtimeSubscriptions: Game scores subscription error:', err);
      }
      if (status === 'SUBSCRIBED') {
        console.log('✅ GameRealtimeSubscriptions: Game scores subscribed in RENDERER process');
      }
    });
  }

  /**
   * Refresh leaderboard
   */
  async refreshLeaderboard(gameSessionId: string, currentGame: MultiplayerGame | null): Promise<void> {
    const result = await window.scribeCat.games.getGameLeaderboard(gameSessionId);

    if (result.success && currentGame) {
      currentGame.updateState({
        leaderboard: result.leaderboard || [],
      });
    }
  }

  /**
   * Cleanup game realtime channels
   */
  cleanupChannels(): void {
    const rendererClient = RendererSupabaseClient.getInstance();
    const client = rendererClient.getClient();

    if (this.gameSessionChannel) {
      console.log('🔒 GameRealtimeSubscriptions: Cleaning up game session channel');
      this.gameSessionChannel.unsubscribe();
      if (client) client.removeChannel(this.gameSessionChannel);
      this.gameSessionChannel = null;
    }

    if (this.gameQuestionsChannel) {
      console.log('🔒 GameRealtimeSubscriptions: Cleaning up game questions channel');
      this.gameQuestionsChannel.unsubscribe();
      if (client) client.removeChannel(this.gameQuestionsChannel);
      this.gameQuestionsChannel = null;
    }

    if (this.gameScoresChannel) {
      console.log('🔒 GameRealtimeSubscriptions: Cleaning up game scores channel');
      this.gameScoresChannel.unsubscribe();
      if (client) client.removeChannel(this.gameScoresChannel);
      this.gameScoresChannel = null;
    }
  }
}
