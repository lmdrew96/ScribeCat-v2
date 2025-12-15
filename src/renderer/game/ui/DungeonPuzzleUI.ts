/**
 * DungeonPuzzleUI
 *
 * Handles puzzle interaction UI in dungeon scenes (riddles, sequences).
 * Extracted from DungeonScene.ts to reduce file size.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import type { RoomContent } from '../../canvas/dungeon/DungeonGenerator.js';
import { GameState } from '../state/GameState.js';
import { playSound } from '../systems/sound.js';

// Riddles for puzzle rooms
const RIDDLES = [
  { question: "I have keys but no locks. What am I?", answer: 0, options: ["Keyboard", "Piano", "Map"] },
  { question: "What has hands but can't clap?", answer: 1, options: ["Gloves", "Clock", "Statue"] },
  { question: "I get wetter as I dry. What am I?", answer: 2, options: ["Sponge", "Rain", "Towel"] },
  { question: "What has a head and tail but no body?", answer: 0, options: ["Coin", "Snake", "Comet"] },
  { question: "What can you catch but not throw?", answer: 1, options: ["Ball", "Cold", "Fish"] },
];

// Sequences for puzzle rooms
const SEQUENCES = [
  { pattern: [0, 1, 2], display: "↑ → ↓" },
  { pattern: [1, 0, 1, 2], display: "→ ↑ → ↓" },
  { pattern: [2, 2, 0, 1], display: "↓ ↓ ↑ →" },
  { pattern: [0, 2, 1, 0], display: "↑ ↓ → ↑" },
];

interface RiddleState {
  type: 'riddle';
  riddle: typeof RIDDLES[0];
  selectedOption: number;
}

interface SequenceState {
  type: 'sequence';
  sequence: typeof SEQUENCES[0];
  inputIndex: number;
  inputs: number[];
  showPattern: boolean;
}

type PuzzleState = RiddleState | SequenceState;

export interface PuzzleUIConfig {
  canvasWidth: number;
  canvasHeight: number;
}

export interface PuzzleUICallbacks {
  showFloatingMessage: (text: string, x: number, y: number, color?: [number, number, number]) => void;
  freezePlayer: () => void;
  unfreezePlayer: () => void;
  renderRoom: () => void;
}

/**
 * Create a puzzle UI controller for dungeon scenes
 */
export function createPuzzleUI(
  k: KAPLAYCtx,
  config: PuzzleUIConfig,
  callbacks: PuzzleUICallbacks
) {
  let puzzleActive = false;
  let currentPuzzle: RoomContent | null = null;
  let puzzleState: PuzzleState | null = null;
  let puzzleUIElements: GameObj[] = [];
  let puzzleTimerCancel: (() => void) | null = null;

  /**
   * Atomically set puzzle state to maintain invariant
   */
  function setPuzzleState(puzzle: RoomContent, state: PuzzleState): void {
    currentPuzzle = puzzle;
    puzzleState = state;
    puzzleActive = true;
    callbacks.freezePlayer();
  }

  /**
   * Atomically clear puzzle state
   */
  function clearPuzzleState(): void {
    puzzleActive = false;
    currentPuzzle = null;
    puzzleState = null;
    callbacks.unfreezePlayer();
  }

  /**
   * Clear puzzle UI and reset state
   */
  function clear(): void {
    // Cancel any pending puzzle timer
    if (puzzleTimerCancel) {
      try { puzzleTimerCancel(); } catch { /* timer may already be complete */ }
      puzzleTimerCancel = null;
    }

    for (const e of puzzleUIElements) {
      try { k.destroy(e); } catch { /* element may already be destroyed */ }
    }
    puzzleUIElements = [];
    clearPuzzleState();
  }

  /**
   * Show riddle puzzle UI
   */
  function showRiddle(content: RoomContent): void {
    const riddle = RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
    setPuzzleState(content, { type: 'riddle', riddle, selectedOption: 0 });

    const { canvasWidth } = config;

    // Background
    puzzleUIElements.push(k.add([
      k.rect(380, 180),
      k.pos(canvasWidth / 2 - 190, 70),
      k.color(20, 20, 40),
      k.outline(3, k.rgb(100, 150, 255)),
      k.z(500),
    ]));

    // Title
    puzzleUIElements.push(k.add([
      k.text('Riddle Stone', { size: 14 }),
      k.pos(canvasWidth / 2, 85),
      k.anchor('center'),
      k.color(100, 180, 255),
      k.z(501),
    ]));

    // Question
    puzzleUIElements.push(k.add([
      k.text(riddle.question, { size: 14, width: 350 }),
      k.pos(canvasWidth / 2, 115),
      k.anchor('center'),
      k.color(255, 255, 255),
      k.z(501),
    ]));

    renderRiddleOptions();

    // Instructions
    puzzleUIElements.push(k.add([
      k.text('Up/Down: Select | ENTER: Answer | ESC: Leave', { size: 12 }),
      k.pos(canvasWidth / 2, 240),
      k.anchor('center'),
      k.color(150, 150, 150),
      k.z(501),
    ]));
  }

  /**
   * Render riddle option buttons
   */
  function renderRiddleOptions(): void {
    if (!puzzleState || puzzleState.type !== 'riddle') return;

    const { canvasWidth } = config;

    // Remove old option elements
    puzzleUIElements = puzzleUIElements.filter(e => {
      if ((e as any)._isOption) {
        try { k.destroy(e); } catch { /* element may already be destroyed */ }
        return false;
      }
      return true;
    });

    const { riddle, selectedOption } = puzzleState;
    riddle.options.forEach((opt: string, i: number) => {
      const isSelected = i === selectedOption;
      const optBg = k.add([
        k.rect(300, 28),
        k.pos(canvasWidth / 2 - 150, 145 + i * 32),
        k.color(isSelected ? 60 : 30, isSelected ? 80 : 30, isSelected ? 120 : 50),
        k.outline(2, k.rgb(isSelected ? 100 : 60, isSelected ? 180 : 80, isSelected ? 255 : 120)),
        k.z(501),
      ]) as any;
      optBg._isOption = true;
      puzzleUIElements.push(optBg);

      const optText = k.add([
        k.text(`${i + 1}. ${opt}`, { size: 13 }),
        k.pos(canvasWidth / 2, 159 + i * 32),
        k.anchor('center'),
        k.color(255, 255, 255),
        k.z(502),
      ]) as any;
      optText._isOption = true;
      puzzleUIElements.push(optText);
    });
  }

  /**
   * Show sequence puzzle UI
   */
  function showSequence(content: RoomContent): void {
    const sequence = SEQUENCES[Math.floor(Math.random() * SEQUENCES.length)];
    setPuzzleState(content, { type: 'sequence', sequence, inputIndex: 0, inputs: [], showPattern: true });

    const { canvasWidth } = config;

    // Background
    puzzleUIElements.push(k.add([
      k.rect(380, 160),
      k.pos(canvasWidth / 2 - 190, 80),
      k.color(20, 20, 40),
      k.outline(3, k.rgb(255, 180, 100)),
      k.z(500),
    ]));

    // Title
    puzzleUIElements.push(k.add([
      k.text('Sequence Lock', { size: 14 }),
      k.pos(canvasWidth / 2, 95),
      k.anchor('center'),
      k.color(255, 180, 100),
      k.z(501),
    ]));

    // Pattern display
    puzzleUIElements.push(k.add([
      k.text(`Memorize: ${sequence.display}`, { size: 16 }),
      k.pos(canvasWidth / 2, 130),
      k.anchor('center'),
      k.color(255, 255, 100),
      k.z(501),
    ]));

    puzzleUIElements.push(k.add([
      k.text('Pattern will hide in 3 seconds...', { size: 13 }),
      k.pos(canvasWidth / 2, 160),
      k.anchor('center'),
      k.color(200, 200, 200),
      k.z(501),
    ]));

    // Hide pattern after 3 seconds
    const timerControl = k.wait(3, () => {
      puzzleTimerCancel = null;
      if (puzzleActive && puzzleState?.type === 'sequence') {
        puzzleState.showPattern = false;
        renderSequenceInput();
      }
    });
    puzzleTimerCancel = timerControl.cancel;
  }

  /**
   * Render sequence input UI (after pattern hidden)
   */
  function renderSequenceInput(): void {
    if (!puzzleState || puzzleState.type !== 'sequence') return;

    const { canvasWidth } = config;

    // Save state before clearing UI
    const savedPuzzle = currentPuzzle;
    const savedState = puzzleState;

    // Cancel timer and clear UI elements only
    if (puzzleTimerCancel) {
      try { puzzleTimerCancel(); } catch { /* timer may already be complete */ }
      puzzleTimerCancel = null;
    }
    for (const e of puzzleUIElements) {
      try { k.destroy(e); } catch { /* element may already be destroyed */ }
    }
    puzzleUIElements = [];

    // Restore state and ensure player stays frozen
    currentPuzzle = savedPuzzle;
    puzzleState = savedState;
    puzzleActive = true;
    callbacks.freezePlayer();

    // Background
    puzzleUIElements.push(k.add([
      k.rect(380, 160),
      k.pos(canvasWidth / 2 - 190, 80),
      k.color(20, 20, 40),
      k.outline(3, k.rgb(255, 180, 100)),
      k.z(500),
    ]));

    puzzleUIElements.push(k.add([
      k.text('Enter the Sequence!', { size: 14 }),
      k.pos(canvasWidth / 2, 95),
      k.anchor('center'),
      k.color(255, 180, 100),
      k.z(501),
    ]));

    // Show current inputs
    const arrows = ['Up', 'Right', 'Down'];
    const inputStr = savedState.inputs.map((i: number) => arrows[i]).join(' ') || '...';
    puzzleUIElements.push(k.add([
      k.text(`Your input: ${inputStr}`, { size: 14 }),
      k.pos(canvasWidth / 2, 130),
      k.anchor('center'),
      k.color(100, 255, 100),
      k.z(501),
    ]));

    puzzleUIElements.push(k.add([
      k.text(`${savedState.inputs.length}/${savedState.sequence.pattern.length}`, { size: 12 }),
      k.pos(canvasWidth / 2, 155),
      k.anchor('center'),
      k.color(200, 200, 200),
      k.z(501),
    ]));

    puzzleUIElements.push(k.add([
      k.text('Arrow Keys: Input | ESC: Give up', { size: 12 }),
      k.pos(canvasWidth / 2, 220),
      k.anchor('center'),
      k.color(150, 150, 150),
      k.z(501),
    ]));
  }

  /**
   * Handle puzzle solve - award rewards
   */
  function solvePuzzle(): void {
    if (!currentPuzzle) return;

    currentPuzzle.triggered = true;
    const goldReward = currentPuzzle.data?.goldReward || 50;
    const xpReward = currentPuzzle.data?.xpReward || 20;

    GameState.addGold(goldReward);
    GameState.addXp(xpReward);

    const { canvasWidth } = config;

    clear();
    playSound(k, 'victory');
    callbacks.showFloatingMessage('Puzzle Solved!', canvasWidth / 2, 120, [100, 255, 100]);
    callbacks.showFloatingMessage(`+${goldReward} Gold!`, canvasWidth / 2, 145, [251, 191, 36]);
    callbacks.showFloatingMessage(`+${xpReward} XP!`, canvasWidth / 2, 170, [150, 255, 150]);

    callbacks.renderRoom();
  }

  /**
   * Handle puzzle failure
   */
  function failPuzzle(): void {
    const { canvasWidth } = config;
    clear();
    callbacks.showFloatingMessage('Wrong answer!', canvasWidth / 2, 140, [255, 100, 100]);
  }

  /**
   * Handle keyboard input for puzzle UI
   */
  function handleInput(key: string): void {
    if (!puzzleActive || !puzzleState) return;

    const { canvasWidth } = config;

    if (key === 'escape') {
      clear();
      callbacks.showFloatingMessage('Puzzle abandoned...', canvasWidth / 2, 150, [150, 150, 150]);
      return;
    }

    if (puzzleState.type === 'riddle') {
      if (key === 'up' && puzzleState.selectedOption > 0) {
        puzzleState.selectedOption--;
        renderRiddleOptions();
      } else if (key === 'down' && puzzleState.selectedOption < puzzleState.riddle.options.length - 1) {
        puzzleState.selectedOption++;
        renderRiddleOptions();
      } else if (key === 'enter') {
        const correct = puzzleState.selectedOption === puzzleState.riddle.answer;
        if (correct) {
          solvePuzzle();
        } else {
          failPuzzle();
        }
      }
    } else if (puzzleState.type === 'sequence' && !puzzleState.showPattern) {
      let input = -1;
      if (key === 'up') input = 0;
      else if (key === 'right') input = 1;
      else if (key === 'down') input = 2;

      if (input >= 0) {
        puzzleState.inputs.push(input);
        renderSequenceInput();

        if (puzzleState.inputs.length === puzzleState.sequence.pattern.length) {
          const correct = puzzleState.inputs.every(
            (v: number, i: number) => v === puzzleState!.sequence.pattern[i]
          );
          if (correct) {
            solvePuzzle();
          } else {
            failPuzzle();
          }
        }
      }
    }
  }

  return {
    get isActive() { return puzzleActive; },
    clear,
    showRiddle,
    showSequence,
    handleInput,
  };
}

export type DungeonPuzzleUI = ReturnType<typeof createPuzzleUI>;
