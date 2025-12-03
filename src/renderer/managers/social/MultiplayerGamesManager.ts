/**
 * Multiplayer Games Manager
 *
 * Orchestrates multiplayer game sessions, delegating to focused sub-modules:
 * - GameQuestionProcessor: AI question generation and processing
 * - GameReconnectionHandler: Reconnection logic with exponential backoff
 * - GamePollingFallback: Polling fallback for unreliable realtime
 * - GameRealtimeSubscriptions: Supabase realtime subscriptions
 * - GameEventHandlers: Window event handling
 */

import { GameSession, GameType } from '../../../domain/entities/GameSession.js';
import { GameQuestion } from '../../../domain/entities/GameQuestion.js';
import { Session } from '../../../domain/entities/Session.js';
import { MultiplayerGame, GameState, GameParticipant } from '../../components/games/MultiplayerGame.js';
import { QuizBattleGame } from '../../components/games/QuizBattleGame.js';
import { JeopardyGame } from '../../components/games/JeopardyGame.js';
import { HotSeatChallengeGame } from '../../components/games/HotSeatChallengeGame.js';
import { LightningChainGame } from '../../components/games/LightningChainGame.js';
import { TimeSync } from '../../services/TimeSync.js';
import { ChatPanel } from '../../components/ChatPanel.js';
import { ChatManager } from './ChatManager.js';
import {
  GameQuestionProcessor,
  GameReconnectionHandler,
  GamePollingFallback,
  GameRealtimeSubscriptions,
  GameEventHandlers,
} from './games/index.js';

export class MultiplayerGamesManager {
  private currentGame: MultiplayerGame | null = null;
  private currentGameSession: GameSession | null = null;
  private currentUserId: string | null = null;
  private currentContainer: HTMLElement | null = null;
  private currentParticipants: GameParticipant[] = [];

  // Sub-modules
  private reconnectionHandler: GameReconnectionHandler;
  private pollingFallback: GamePollingFallback;
  private realtimeSubscriptions: GameRealtimeSubscriptions;
  private eventHandlers: GameEventHandlers | null = null;

  // Lobby chat
  private chatManager: ChatManager | null = null;
  private lobbyChatPanel: ChatPanel | null = null;

  constructor() {
    this.reconnectionHandler = new GameReconnectionHandler();
    this.pollingFallback = new GamePollingFallback();
    this.realtimeSubscriptions = new GameRealtimeSubscriptions();
  }

  /**
   * Initialize manager with current user
   */
  public initialize(userId: string): void {
    this.currentUserId = userId;

    // Check for active games on initialization (reconnection scenario)
    this.reconnectionHandler.checkAndReconnectActiveGame(userId, this.currentGame).catch(err => {
      console.error('Failed to reconnect to active game:', err);
    });
  }

  /**
   * Set chat manager for lobby chat functionality
   */
  public setChatManager(chatManager: ChatManager): void {
    this.chatManager = chatManager;
  }

  /**
   * Create a new game session
   */
  public async createGame(
    roomId: string,
    gameType: GameType,
    session: Session,
    config?: {
      questionCount?: number;
      difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
      categories?: string[];
    }
  ): Promise<GameSession> {
    if (!this.currentUserId) {
      throw new Error('Games manager not initialized');
    }

    const result = await window.scribeCat.games.createGameSession({
      roomId,
      gameType,
      config: {
        questionCount: config?.questionCount || 10,
        difficulty: config?.difficulty || 'mixed',
        categories: config?.categories,
      },
    });

    if (!result.success || !result.gameSession) {
      throw new Error(result.error || 'Failed to create game session');
    }

    const gameSession = GameSession.fromJSON(result.gameSession);

    // Generate questions using AI in background (non-blocking)
    GameQuestionProcessor.generateQuestionsAsync(gameSession, session);

    return gameSession;
  }

  /**
   * Start a game (for host - updates game status to in_progress)
   */
  public async startGame(
    gameSessionId: string,
    container: HTMLElement,
    participants: GameParticipant[]
  ): Promise<void> {
    if (!this.currentUserId) {
      throw new Error('Games manager not initialized');
    }

    this.currentContainer = container;
    this.currentParticipants = participants;

    const result = await window.scribeCat.games.startGame(gameSessionId);

    if (!result.success || !result.gameSession) {
      throw new Error(result.error || 'Failed to start game');
    }

    this.currentGameSession = GameSession.fromJSON(result.gameSession);
    await this.initializeGameUI(gameSessionId, container, participants);
  }

  /**
   * Join an existing game (for non-host participants)
   */
  public async joinGame(
    gameSessionId: string,
    container: HTMLElement,
    participants: GameParticipant[]
  ): Promise<void> {
    if (!this.currentUserId) {
      throw new Error('Games manager not initialized');
    }

    this.currentContainer = container;
    this.currentParticipants = participants;

    const result = await window.scribeCat.games.getGameSession(gameSessionId);

    if (!result.success || !result.gameSession) {
      throw new Error(result.error || 'Failed to get game session');
    }

    this.currentGameSession = GameSession.fromJSON(result.gameSession);
    await this.initializeGameUI(gameSessionId, container, participants);
  }

  /**
   * Initialize game UI (shared between startGame and joinGame)
   */
  private async initializeGameUI(
    gameSessionId: string,
    container: HTMLElement,
    participants: GameParticipant[]
  ): Promise<void> {
    console.log('Game session status:', this.currentGameSession!.status);

    let currentQuestion: GameQuestion | null = null;
    let jeopardyBoard: any[] | null = null;
    let jeopardyQuestionsReady = false;

    // Load initial question based on game type
    if (this.currentGameSession!.gameType === 'jeopardy') {
      const selectedQuestionId = this.currentGameSession!.selectedQuestionId;

      if (selectedQuestionId) {
        const questionResult = await window.scribeCat.games.getGameQuestion(gameSessionId, selectedQuestionId);
        currentQuestion = questionResult.success && questionResult.question
          ? GameQuestion.fromJSON(questionResult.question)
          : null;
        jeopardyQuestionsReady = true;
      } else {
        const boardResult = await window.scribeCat.games.jeopardy.getBoard(gameSessionId);
        if (boardResult.success && boardResult.board && boardResult.board.length > 0) {
          jeopardyBoard = boardResult.board;
          jeopardyQuestionsReady = true;
        }
      }
    } else {
      const questionResult = await window.scribeCat.games.getCurrentQuestion(gameSessionId);
      currentQuestion = questionResult.success && questionResult.question
        ? GameQuestion.fromJSON(questionResult.question)
        : null;
    }

    // Load initial leaderboard
    const leaderboardResult = await window.scribeCat.games.getGameLeaderboard(gameSessionId);
    const leaderboard = leaderboardResult.success ? leaderboardResult.leaderboard || [] : [];

    // Create initial game state
    const gameState: GameState = {
      session: this.currentGameSession!,
      currentQuestion,
      participants,
      scores: [],
      leaderboard,
      currentUserId: this.currentUserId!,
      hasAnswered: false,
      gameStarted: this.currentGameSession!.status === 'in_progress',
      gameEnded: this.currentGameSession!.status === 'completed',
      questionsReady: this.currentGameSession!.gameType === 'jeopardy'
        ? jeopardyQuestionsReady
        : currentQuestion !== null,
    };

    if (this.currentGameSession!.gameType === 'jeopardy' && jeopardyBoard) {
      (gameState as any).board = jeopardyBoard;
    }

    // Create game component
    this.currentGame = this.createGameComponent(
      this.currentGameSession!.gameType,
      container,
      gameState
    );

    // Setup event handlers
    this.eventHandlers = new GameEventHandlers({
      getCurrentGameSession: () => this.currentGameSession,
      setCurrentGameSession: (session) => { this.currentGameSession = session; },
      getCurrentGame: () => this.currentGame,
      getCurrentUserId: () => this.currentUserId,
      getParticipants: () => this.currentParticipants,
      cleanup: () => this.cleanup(),
      destroyLobbyChatPanel: () => this.destroyLobbyChatPanel(),
    });
    this.eventHandlers.setupListeners();

    // Subscribe to realtime updates
    this.realtimeSubscriptions.subscribeToGameUpdates(gameSessionId, {
      getCurrentGameSession: () => this.currentGameSession,
      setCurrentGameSession: (session) => { this.currentGameSession = session; },
      getCurrentGame: () => this.currentGame,
      onSessionUpdate: (gameSession, payload) => {
        // Handle Jeopardy score events
        if (gameSession.gameType === 'jeopardy') {
          // Score handling is done in onScoreReceived
        }
      },
      onScoreReceived: (scoreData) => {
        // Emit Jeopardy answer result event
        if (this.currentGameSession?.gameType === 'jeopardy' && scoreData) {
          const isCorrect = scoreData.is_correct === true;
          window.dispatchEvent(
            new CustomEvent('game:jeopardy:answer-result', {
              detail: {
                userId: scoreData.user_id,
                questionId: scoreData.question_id,
                isCorrect,
                pointsEarned: scoreData.points_earned,
              },
            })
          );
        }
      },
    });

    // Initialize game UI
    await this.currentGame.initialize();

    // Setup polling as fallback
    if (this.currentGameSession!.status === 'waiting') {
      this.pollingFallback.startWaitingPoll(
        gameSessionId,
        {
          getCurrentGameSession: () => this.currentGameSession,
          setCurrentGameSession: (session) => { this.currentGameSession = session; },
          getCurrentGame: () => this.currentGame,
          onGameStarted: () => {
            this.destroyLobbyChatPanel();
            this.pollingFallback.startQuestionPoll(gameSessionId, {
              getCurrentGameSession: () => this.currentGameSession,
              setCurrentGameSession: (session) => { this.currentGameSession = session; },
              getCurrentGame: () => this.currentGame,
              onGameStarted: () => {},
              onQuestionChanged: () => {},
            });
          },
          onQuestionChanged: () => {},
        },
        (gameSession, currentQuestion, jeopardyBoardUpdate) => {
          if (this.currentGame) {
            const questionStartedAt = gameSession.startedAt?.getTime();
            this.currentGame.updateState({
              session: gameSession,
              currentQuestion,
              hasAnswered: false,
              gameStarted: true,
              gameEnded: false,
              questionStartedAt,
            });

            if (gameSession.gameType === 'jeopardy') {
              const jeopardyUpdates: any = {
                selectedQuestionId: gameSession.selectedQuestionId || null,
                currentPlayerId: gameSession.currentPlayerId || null,
                round: gameSession.round || 'regular',
              };
              if (jeopardyBoardUpdate) {
                jeopardyUpdates.board = jeopardyBoardUpdate;
                jeopardyUpdates.questionsReady = true;
              }
              (this.currentGame as any).updateState(jeopardyUpdates);
            }
          }
        }
      );
      await this.initializeLobbyChatPanel();
    }

    if (this.currentGameSession!.status === 'in_progress') {
      this.pollingFallback.startQuestionPoll(gameSessionId, {
        getCurrentGameSession: () => this.currentGameSession,
        setCurrentGameSession: (session) => { this.currentGameSession = session; },
        getCurrentGame: () => this.currentGame,
        onGameStarted: () => {},
        onQuestionChanged: () => {},
      });
    }
  }

  /**
   * Create game component based on type
   */
  private createGameComponent(
    gameType: GameType,
    container: HTMLElement,
    state: GameState
  ): MultiplayerGame {
    switch (gameType) {
      case 'quiz_battle':
        return new QuizBattleGame(container, state);
      case 'jeopardy':
        return new JeopardyGame(container, state);
      case 'hot_seat_challenge':
        return new HotSeatChallengeGame(container, state);
      case 'lightning_chain':
        return new LightningChainGame(container, state);
      default:
        throw new Error(`Unknown game type: ${gameType}`);
    }
  }

  /**
   * Initialize lobby chat panel for waiting screen
   */
  private async initializeLobbyChatPanel(): Promise<void> {
    if (!this.chatManager || !this.currentGameSession || !this.currentUserId) {
      return;
    }

    const chatContainer = document.getElementById('game-lobby-chat');
    if (!chatContainer) return;

    const participants = this.currentParticipants.map(p => ({
      userId: p.userId,
      userName: p.userFullName || p.userEmail.split('@')[0]
    }));

    this.lobbyChatPanel = new ChatPanel(this.chatManager);
    await this.lobbyChatPanel.init(
      chatContainer,
      this.currentGameSession.roomId,
      this.currentUserId,
      participants
    );
  }

  /**
   * Destroy lobby chat panel
   */
  private destroyLobbyChatPanel(): void {
    if (this.lobbyChatPanel) {
      this.lobbyChatPanel.destroy();
      this.lobbyChatPanel = null;
    }
  }

  /**
   * Get active game for a room
   */
  public async getActiveGame(roomId: string): Promise<GameSession | null> {
    const result = await window.scribeCat.games.getActiveGameForRoom(roomId);

    if (result.success && result.gameSession) {
      return GameSession.fromJSON(result.gameSession);
    }

    return null;
  }

  /**
   * Cancel a game
   */
  public async cancelGame(gameSessionId: string): Promise<void> {
    const result = await window.scribeCat.games.cancelGame(gameSessionId);

    if (!result.success) {
      throw new Error(result.error || 'Failed to cancel game');
    }

    await this.cleanup();
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    this.destroyLobbyChatPanel();
    this.pollingFallback.stopAll();
    this.reconnectionHandler.reset();
    this.realtimeSubscriptions.cleanupChannels();

    if (this.eventHandlers) {
      this.eventHandlers.removeListeners();
      this.eventHandlers = null;
    }

    if (this.currentGame) {
      await this.currentGame.cleanup();
      this.currentGame = null;
    }

    TimeSync.getInstance().cleanup();

    this.currentGameSession = null;
    this.currentContainer = null;
    this.currentParticipants = [];
  }
}
