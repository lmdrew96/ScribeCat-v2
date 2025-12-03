/**
 * JeopardyGame Component
 *
 * Real Jeopardy game implementation with:
 * - Question selection board (categories × point values)
 * - Buzzer system (first to buzz gets to answer)
 * - Turn rotation (correct answerer picks next question)
 * - Daily Doubles with wager
 * - Final Jeopardy with wager
 * - Negative scoring for wrong answers
 *
 * Refactored to delegate to focused sub-modules:
 * - JeopardyBoard: Board rendering and question selection
 * - JeopardyBuzzer: Buzzer subscriptions and handling
 * - JeopardyQuestion: Question view and answer submission
 * - JeopardyWager: Daily Double and legacy FJ wagers
 * - JeopardyFinalRound: New Final Jeopardy flow
 */

import { MultiplayerGame, GameState } from './MultiplayerGame.js';
import {
  JeopardyGameState,
  createInitialJeopardyState,
  JeopardyBoard,
  JeopardyBuzzer,
  JeopardyQuestion,
  JeopardyWager,
  JeopardyFinalRound,
  JeopardyFinalRoundRenderer,
} from './jeopardy/index.js';

export class JeopardyGame extends MultiplayerGame {
  protected state: JeopardyGameState;
  private buzzer: JeopardyBuzzer;
  private finalRound: JeopardyFinalRound;
  private boundHandleAnswerResult: ((event: Event) => void) | null = null;

  constructor(container: HTMLElement, initialState: GameState) {
    super(container, initialState);

    console.log('[JeopardyGame] Constructor called with initialState:', {
      hasCurrentQuestion: !!initialState.currentQuestion,
      currentQuestionId: initialState.currentQuestion?.id,
      currentPlayerId: initialState.session.currentPlayerId,
      selectedQuestionId: initialState.session.selectedQuestionId,
      gameStatus: initialState.session.status,
      round: initialState.session.round,
    });

    // Initialize Jeopardy-specific state from session
    this.state = {
      ...this.state,
      ...createInitialJeopardyState(initialState),
    };

    // Initialize sub-modules
    this.buzzer = new JeopardyBuzzer();
    this.finalRound = new JeopardyFinalRound();
  }

  public async initialize(): Promise<void> {
    console.log('[JeopardyGame] initialize() called');
    await super.initialize();

    console.log('[JeopardyGame] Loading board...');
    const board = await JeopardyBoard.loadBoard(this.state.session.id);
    if (board) {
      this.updateState({ board });
    }
    console.log('[JeopardyGame] Board loaded:', this.state.board?.length, 'questions');

    // Subscribe to buzzer presses if we have a current question
    if (this.state.currentQuestion) {
      console.log('[JeopardyGame] Current question exists, subscribing to buzzers:', this.state.currentQuestion.id);
      this.subscribeToBuzzers(this.state.currentQuestion.id);
    } else {
      console.log('[JeopardyGame] No current question - board selection mode');
    }

    // Listen for answer results from other players (for rebuzz)
    this.boundHandleAnswerResult = this.handleAnswerResultEvent.bind(this);
    window.addEventListener('game:jeopardy:answer-result', this.boundHandleAnswerResult);
  }

  public async cleanup(): Promise<void> {
    if (this.boundHandleAnswerResult) {
      window.removeEventListener('game:jeopardy:answer-result', this.boundHandleAnswerResult);
      this.boundHandleAnswerResult = null;
    }
    this.buzzer.cleanup();
    this.finalRound.cleanup();
    await super.cleanup();
  }

  private subscribeToBuzzers(questionId: string): void {
    this.buzzer.subscribeToBuzzers(questionId, this.state.participants, (updates) => {
      this.updateState(updates);
    });
  }

  private handleAnswerResultEvent(event: Event): void {
    const customEvent = event as CustomEvent<{
      userId: string;
      questionId: string;
      isCorrect: boolean;
      pointsEarned: number;
    }>;
    const { userId, questionId, isCorrect } = customEvent.detail;

    if (this.state.currentQuestion?.id !== questionId) return;

    const currentUser = this.state.participants.find(p => p.isCurrentUser);
    if (userId === currentUser?.userId) return;

    console.log(`[JeopardyGame] Answer result event - user: ${userId}, correct: ${isCorrect}`);

    this.updateState({
      showingAnswerFeedback: true,
      lastAnswerCorrect: isCorrect,
      lastAnswerUserId: userId,
      feedbackQuestion: this.state.currentQuestion,
    });

    if (isCorrect) {
      setTimeout(() => {
        this.updateState({ showingAnswerFeedback: false, feedbackQuestion: null });
      }, 2500);
    } else {
      const newWrongAnswers = new Set(this.state.playersWhoAnsweredWrong);
      newWrongAnswers.add(userId);
      this.updateState({ playersWhoAnsweredWrong: newWrongAnswers });

      setTimeout(() => {
        this.updateState({
          showingAnswerFeedback: false,
          feedbackQuestion: null,
          buzzerEnabled: true,
          buzzers: [],
          firstBuzzerId: null,
          myBuzzerRank: null,
          hasAnswered: false,
        });
      }, 2500);
    }
  }

  public updateState(updates: Partial<JeopardyGameState>): void {
    const previousQuestionId = this.state.currentQuestion?.id;
    const questionChanged = updates.currentQuestion && updates.currentQuestion.id !== previousQuestionId;

    if (questionChanged) {
      const resetState: Partial<JeopardyGameState> = {
        buzzerEnabled: true,
        buzzers: [],
        firstBuzzerId: null,
        myBuzzerRank: null,
        hasAnswered: false,
        showingAnswerFeedback: false,
        lastAnswerCorrect: null,
        lastAnswerUserId: null,
        playersWhoAnsweredWrong: new Set<string>(),
      };

      if (updates.currentQuestion!.isDailyDouble) {
        const currentUser = this.state.participants.find(p => p.isCurrentUser);
        const currentPlayerId = updates.currentPlayerId ?? this.state.currentPlayerId;
        const isMyTurn = currentPlayerId === currentUser?.userId;

        if (isMyTurn) {
          resetState.showingDailyDoubleWager = true;
        }
      }

      updates = { ...resetState, ...updates };
    }

    super.updateState(updates as Partial<GameState>);

    if (questionChanged) {
      this.subscribeToBuzzers(updates.currentQuestion!.id);
    }

    if ('currentQuestion' in updates && updates.currentQuestion === null && previousQuestionId) {
      setTimeout(() => this.reloadBoard(), 500);
    }

    if (updates.round === 'final_jeopardy' && this.state.round !== 'final_jeopardy') {
      setTimeout(() => this.startFinalJeopardy(), 100);
    }
  }

  private async reloadBoard(): Promise<void> {
    console.log('[JeopardyGame] Reloading board');
    const board = await JeopardyBoard.loadBoard(this.state.session.id);
    if (board) {
      this.updateState({ board });
    }
  }

  protected render(): void {
    const { gameStarted, gameEnded, showingDailyDoubleWager, showingFinalJeopardyWager, showingAnswerFeedback, currentQuestion } = this.state;

    console.log('[JeopardyGame] render() called with state:', {
      gameStarted,
      gameEnded,
      showingDailyDoubleWager,
      showingFinalJeopardyWager,
      showingAnswerFeedback,
      hasCurrentQuestion: !!currentQuestion,
      hasBoardData: !!this.state.board,
    });

    if (gameEnded) {
      this.container.innerHTML = this.renderGameComplete();
      this.attachCompleteListeners();
      return;
    }

    if (!gameStarted) {
      this.container.innerHTML = this.renderWaitingScreen();
      this.attachWaitingListeners();
      return;
    }

    if (showingAnswerFeedback && this.state.feedbackQuestion) {
      this.container.innerHTML = JeopardyQuestion.renderAnswerFeedback(
        this.state, this.renderHeader.bind(this), this.renderLeaderboard.bind(this), this.escapeHtml.bind(this)
      );
      this.attachExitListeners();
      return;
    }

    if (this.state.round === 'final_jeopardy' && this.state.fjPhase) {
      this.renderFinalJeopardyPhase();
      return;
    }

    if (showingFinalJeopardyWager) {
      this.container.innerHTML = JeopardyWager.renderFinalJeopardyWager(
        this.state, this.renderHeader.bind(this), this.renderLeaderboard.bind(this), this.escapeHtml.bind(this),
        async () => await (window as any).scribeCat.games.completeGame(this.state.session.id)
      );
      JeopardyWager.attachFinalWagerListeners(this.container, this.state, (wager) => this.handleFinalJeopardyWager(wager), this.attachExitListeners.bind(this));
      return;
    }

    if (showingDailyDoubleWager) {
      this.container.innerHTML = JeopardyWager.renderDailyDoubleWager(
        this.state, this.renderHeader.bind(this), this.renderLeaderboard.bind(this), this.escapeHtml.bind(this)
      );
      JeopardyWager.attachDailyDoubleWagerListeners(this.container, this.state, (wager) => this.handleDailyDoubleWager(wager), this.attachExitListeners.bind(this));
      return;
    }

    if (currentQuestion) {
      this.container.innerHTML = JeopardyQuestion.renderQuestionView(
        this.state, this.renderHeader.bind(this), this.renderProgress.bind(this), this.renderLeaderboard.bind(this), this.escapeHtml.bind(this), this.ordinal.bind(this)
      );
      JeopardyQuestion.attachQuestionListeners(
        this.container, this.state,
        () => this.handleBuzzerPress(),
        (answer) => this.handleAnswer(answer),
        () => this.handleSkipQuestion(),
        this.attachExitListeners.bind(this)
      );
      return;
    }

    this.container.innerHTML = JeopardyBoard.renderBoardView(
      this.state, this.renderHeader.bind(this), this.renderLeaderboard.bind(this), this.escapeHtml.bind(this)
    );
    JeopardyBoard.attachBoardListeners(this.container, (questionId) => this.handleQuestionSelect(questionId), this.attachExitListeners.bind(this));
  }

  private renderFinalJeopardyPhase(): void {
    if (this.state.fjPhase === 'wager') {
      this.container.innerHTML = JeopardyFinalRoundRenderer.renderFJWagerScreen(
        this.state, this.renderHeader.bind(this), this.renderLeaderboard.bind(this), this.escapeHtml.bind(this)
      );
      JeopardyFinalRoundRenderer.attachFJWagerListeners(this.container, this.state, (wager) => this.handleFJWagerSubmit(wager), this.attachExitListeners.bind(this));
    } else if (this.state.fjPhase === 'question') {
      this.container.innerHTML = JeopardyFinalRoundRenderer.renderFJQuestionScreen(
        this.state, this.renderHeader.bind(this), this.renderLeaderboard.bind(this), this.escapeHtml.bind(this)
      );
      JeopardyFinalRoundRenderer.attachFJQuestionListeners(this.container, this.state, (answer) => this.handleFJAnswerSelect(answer), this.attachExitListeners.bind(this));
    } else if (this.state.fjPhase === 'results') {
      this.container.innerHTML = JeopardyFinalRoundRenderer.renderFJResultsScreen(
        this.state, this.renderHeader.bind(this), this.escapeHtml.bind(this)
      );
      JeopardyFinalRoundRenderer.attachFJResultsListeners(this.container, () => this.completeGame());
    }
  }

  private async handleQuestionSelect(questionId: string): Promise<void> {
    const currentUser = this.state.participants.find(p => p.isCurrentUser);
    if (!currentUser) return;
    await JeopardyBoard.selectQuestion(this.state.session.id, questionId, currentUser.userId);
  }

  private async handleBuzzerPress(): Promise<void> {
    const result = await this.buzzer.handleBuzzerPress(this.state);
    if (result.success) {
      const updates: Partial<JeopardyGameState> = {
        myBuzzerRank: result.buzzerRank,
        buzzerEnabled: false,
      };
      const currentUser = this.state.participants.find(p => p.isCurrentUser);
      if (result.buzzerRank === 1) {
        updates.firstBuzzerId = currentUser?.userId || null;
      }
      this.updateState(updates);
    }
  }

  protected async handleAnswer(answer: string): Promise<void> {
    const result = await JeopardyQuestion.submitAnswer(this.state, answer);
    if (!result.success) return;

    this.updateState({ hasAnswered: true });

    const leaderboardResult = await (window as any).scribeCat.games.getGameLeaderboard(this.state.session.id);
    if (leaderboardResult.success) {
      this.updateState({ leaderboard: leaderboardResult.leaderboard || [] });
    }

    const currentUser = this.state.participants.find(p => p.isCurrentUser);
    const question = this.state.currentQuestion!;

    this.updateState({
      showingAnswerFeedback: true,
      lastAnswerCorrect: result.isCorrect,
      lastAnswerUserId: currentUser?.userId || null,
      feedbackQuestion: question,
    });

    if (result.isCorrect) {
      await JeopardyQuestion.setAsCurrentPlayer(this.state.session.id, currentUser!.userId);
      setTimeout(async () => {
        this.updateState({ showingAnswerFeedback: false, feedbackQuestion: null });
        await this.finalRound.checkForFinalJeopardy(this.state.session.id);
      }, 2500);
    } else {
      this.handleWrongAnswer(question.isDailyDouble, currentUser!.userId, question.id);
    }
  }

  private handleWrongAnswer(isDailyDouble: boolean, userId: string, questionId: string): void {
    if (isDailyDouble) {
      setTimeout(async () => {
        this.updateState({ showingAnswerFeedback: false, feedbackQuestion: null, wagerAmount: null });
        await this.handleSkipQuestion();
      }, 2500);
    } else {
      const newWrongAnswers = new Set(this.state.playersWhoAnsweredWrong);
      newWrongAnswers.add(userId);
      this.updateState({ playersWhoAnsweredWrong: newWrongAnswers });

      this.buzzer.clearBuzzers(questionId);

      setTimeout(() => {
        this.updateState({
          showingAnswerFeedback: false,
          feedbackQuestion: null,
          buzzerEnabled: true,
          buzzers: [],
          firstBuzzerId: null,
          myBuzzerRank: null,
          hasAnswered: false,
        });
      }, 2500);
    }
  }

  private async handleSkipQuestion(): Promise<void> {
    if (!this.state.currentQuestion) return;
    const result = await JeopardyQuestion.skipQuestion(this.state.session.id, this.state.currentQuestion.id);
    if (result.success) {
      setTimeout(() => this.finalRound.checkForFinalJeopardy(this.state.session.id), 500);
    }
  }

  private handleDailyDoubleWager(wager: number): void {
    const currentUser = this.state.participants.find(p => p.isCurrentUser);
    this.updateState({
      wagerAmount: wager,
      showingDailyDoubleWager: false,
      buzzerEnabled: false,
      firstBuzzerId: currentUser?.userId || null,
      myBuzzerRank: 1,
    });
    this.render();
  }

  private async handleFinalJeopardyWager(wager: number): Promise<void> {
    const currentUser = this.state.participants.find(p => p.isCurrentUser);
    if (!currentUser) return;

    const result = await this.finalRound.submitFJWager(this.state.session.id, currentUser.userId, wager);
    if (result.success) {
      const newWagers = new Map(this.state.fjWagers);
      newWagers.set(currentUser.userId, wager);
      this.updateState({ wagerAmount: wager, fjMyWagerSubmitted: true, fjWagers: newWagers });
    }
  }

  private startFinalJeopardy(): void {
    this.finalRound.start((updates) => this.updateState(updates));
    this.finalRound.subscribeToFJWagers(
      this.state.session.id,
      (userId, wagerAmount) => {
        const newWagers = new Map(this.state.fjWagers);
        newWagers.set(userId, wagerAmount);
        this.updateState({ fjWagers: newWagers });
      },
      () => {
        this.updateState({ fjPhase: 'question', fjTimer: 30, fjMyAnswerSubmitted: false });
        this.finalRound.startQuestionPhase(
          (timeRemaining) => this.updateState({ fjTimer: timeRemaining }),
          () => this.handleFJTimerExpired()
        );
      }
    );
  }

  private async handleFJWagerSubmit(wager: number): Promise<void> {
    await this.handleFinalJeopardyWager(wager);
  }

  private async handleFJAnswerSelect(answer: string): Promise<void> {
    const result = await this.finalRound.submitFJAnswer(this.state, answer);
    if (result.success) {
      this.updateState({ fjMyAnswerSubmitted: true });
      const allSubmitted = await this.finalRound.checkAllFJAnswersSubmitted(this.state.session.id, this.state.currentQuestion!.id);
      if (allSubmitted) {
        this.finalRound.stopTimer();
        await this.showFJResults();
      }
    }
  }

  private async handleFJTimerExpired(): Promise<void> {
    if (!this.state.fjMyAnswerSubmitted) {
      await this.finalRound.submitFJAnswer(this.state, '');
    }
    setTimeout(() => this.showFJResults(), 1000);
  }

  private async showFJResults(): Promise<void> {
    const leaderboardResult = await (window as any).scribeCat.games.getGameLeaderboard(this.state.session.id);
    if (leaderboardResult.success) {
      this.updateState({ leaderboard: leaderboardResult.leaderboard || [] });
    }
    this.updateState({ fjPhase: 'results' });
  }

  private async completeGame(): Promise<void> {
    await (window as any).scribeCat.games.completeGame(this.state.session.id);
  }

  private attachWaitingListeners(): void {
    const startBtn = this.container.querySelector('#start-game-btn');
    startBtn?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('game:start')));
    this.attachExitListeners();
  }

  private attachCompleteListeners(): void {
    const closeBtn = this.container.querySelector('#close-game-btn');
    closeBtn?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('game:close')));
  }

  private attachExitListeners(): void {
    const exitBtn = this.container.querySelector('#exit-game-btn');
    exitBtn?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('game:exit')));
  }

  private ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  protected getInstructions(): string {
    return 'Select questions from the board! Buzz in to answer, but be careful - wrong answers lose points!';
  }
}
