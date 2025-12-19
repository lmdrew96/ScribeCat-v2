/**
 * DungeonPuzzleOverlay - HTML-based puzzle UI for dungeon scene
 *
 * Provides styled interfaces for riddle and sequence puzzles.
 */

import { injectOverlayStyles } from '../../css/index.js';

export interface Riddle {
  question: string;
  options: string[];
  answer: number;
}

export interface Sequence {
  pattern: number[];
  display: string;
}

export interface PuzzleCallbacks {
  onSolve: () => void;
  onFail: () => void;
  onClose: () => void;
}

/**
 * DungeonPuzzleOverlay - Puzzle UI overlay for dungeon scene
 */
export class DungeonPuzzleOverlay {
  private container: HTMLDivElement;
  private callbacks: PuzzleCallbacks;
  private _isOpen = false;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  // Riddle state
  private currentRiddle: Riddle | null = null;
  private riddleSelection = 0;

  // Sequence state
  private currentSequence: Sequence | null = null;
  private sequenceInputs: number[] = [];
  private showingPattern = false;

  private puzzleType: 'riddle' | 'sequence' | null = null;

  constructor(parentElement: HTMLElement, callbacks: PuzzleCallbacks) {
    this.callbacks = callbacks;

    injectOverlayStyles();

    this.container = document.createElement('div');
    this.container.className = 'sq-dungeon-puzzle-overlay';
    this.container.style.cssText = `
      display: none;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 200;
    `;

    this.addStyles();
    parentElement.appendChild(this.container);
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  private addStyles(): void {
    if (document.getElementById('sq-dungeon-puzzle-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'sq-dungeon-puzzle-styles';
    styles.textContent = `
      .sq-dungeon-puzzle-overlay {
        font-family: 'Segoe UI', system-ui, sans-serif;
      }

      .sq-puzzle-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(3px);
        -webkit-backdrop-filter: blur(3px);
      }

      /* Riddle Panel */
      .sq-puzzle-panel.riddle {
        background: linear-gradient(180deg, #1e2a4e 0%, #141e32 100%);
        border-color: #64b4ff;
      }

      .sq-puzzle-panel.riddle .sq-puzzle-header {
        background: linear-gradient(180deg, #2a3a6e 0%, #1e2a4e 100%);
        border-color: #4a7aaa;
      }

      .sq-puzzle-panel.riddle .sq-puzzle-title {
        color: #64b4ff;
      }

      /* Sequence Panel */
      .sq-puzzle-panel.sequence {
        background: linear-gradient(180deg, #2a2a1e 0%, #1e1e14 100%);
        border-color: #ffb464;
      }

      .sq-puzzle-panel.sequence .sq-puzzle-header {
        background: linear-gradient(180deg, #3a3a2e 0%, #2a2a1e 100%);
        border-color: #aa8844;
      }

      .sq-puzzle-panel.sequence .sq-puzzle-title {
        color: #ffb464;
      }

      .sq-puzzle-panel {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 420px;
        max-width: 90%;
        max-height: 85%;
        background: linear-gradient(180deg, #2a2a4e 0%, #1e1e32 100%);
        border: 3px solid #6496ff;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .sq-puzzle-header {
        padding: 14px 16px;
        background: linear-gradient(180deg, #3a3a6e 0%, #2a2a4e 100%);
        border-bottom: 2px solid #4a6aaa;
        text-align: center;
      }

      .sq-puzzle-title {
        margin: 0;
        font-size: 17px;
        font-weight: 600;
        color: #fbbf24;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }

      .sq-puzzle-body {
        padding: 20px;
      }

      .sq-puzzle-question {
        text-align: center;
        font-size: 15px;
        color: #fff;
        margin-bottom: 20px;
        line-height: 1.5;
      }

      .sq-puzzle-options {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .sq-puzzle-option {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        background: rgba(42, 42, 78, 0.5);
        border: 2px solid transparent;
        border-radius: 8px;
        color: #c4c4c4;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .sq-puzzle-option:hover {
        background: rgba(100, 180, 255, 0.15);
        color: #fff;
      }

      .sq-puzzle-option.selected {
        background: linear-gradient(90deg, rgba(100, 180, 255, 0.3) 0%, rgba(100, 180, 255, 0.1) 100%);
        border-color: #64ff64;
        color: #fff;
        box-shadow: 0 0 12px rgba(100, 255, 100, 0.2);
      }

      .sq-puzzle-option.selected::before {
        content: '▸ ';
        color: #64ff64;
        font-weight: bold;
      }

      .sq-puzzle-option-num {
        margin-right: 12px;
        font-weight: 600;
        color: #888;
      }

      .sq-puzzle-option.selected .sq-puzzle-option-num {
        color: #64ff64;
      }

      /* Sequence specific */
      .sq-sequence-display {
        text-align: center;
        margin-bottom: 20px;
      }

      .sq-sequence-pattern {
        font-size: 28px;
        color: #ffff64;
        letter-spacing: 8px;
        margin-bottom: 8px;
        text-shadow: 0 0 10px rgba(255, 255, 100, 0.5);
      }

      .sq-sequence-hint {
        font-size: 12px;
        color: #888;
        font-style: italic;
      }

      .sq-sequence-input {
        text-align: center;
        margin-bottom: 16px;
      }

      .sq-sequence-input-label {
        font-size: 13px;
        color: #aaa;
        margin-bottom: 8px;
      }

      .sq-sequence-arrows {
        font-size: 24px;
        color: #64ff64;
        letter-spacing: 12px;
        min-height: 32px;
      }

      .sq-sequence-progress {
        display: flex;
        justify-content: center;
        gap: 4px;
        margin-bottom: 12px;
      }

      .sq-sequence-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #333;
        border: 2px solid #555;
        transition: all 0.2s ease;
      }

      .sq-sequence-dot.filled {
        background: #64ff64;
        border-color: #64ff64;
        box-shadow: 0 0 8px rgba(100, 255, 100, 0.5);
      }

      .sq-puzzle-footer {
        padding: 12px 16px;
        background: rgba(0, 0, 0, 0.2);
        border-top: 1px solid #4a6aaa;
      }

      .sq-puzzle-hint {
        font-size: 11px;
        color: #888;
        text-align: center;
      }

      .sq-puzzle-hint kbd {
        display: inline-block;
        padding: 2px 6px;
        background: #2a2a4e;
        border: 1px solid #4a6aaa;
        border-radius: 4px;
        font-family: inherit;
        font-size: 10px;
        color: #b4b4b4;
      }
    `;
    document.head.appendChild(styles);
  }

  private buildRiddleDOM(): void {
    if (!this.currentRiddle) return;

    this.container.innerHTML = `
      <div class="sq-puzzle-backdrop"></div>
      <div class="sq-puzzle-panel riddle">
        <div class="sq-puzzle-header">
          <h3 class="sq-puzzle-title">🔮 Riddle Stone</h3>
        </div>
        <div class="sq-puzzle-body">
          <div class="sq-puzzle-question">${this.currentRiddle.question}</div>
          <div class="sq-puzzle-options"></div>
        </div>
        <div class="sq-puzzle-footer">
          <div class="sq-puzzle-hint">
            <kbd>↑↓</kbd> Select &nbsp; <kbd>Enter</kbd> Answer &nbsp; <kbd>Esc</kbd> Leave
          </div>
        </div>
      </div>
    `;

    this.container.addEventListener('click', (e) => this.handleClick(e));
    this.renderRiddleOptions();
  }

  private renderRiddleOptions(): void {
    if (!this.currentRiddle) return;

    const optionsContainer = this.container.querySelector('.sq-puzzle-options');
    if (!optionsContainer) return;

    optionsContainer.innerHTML = this.currentRiddle.options.map((opt, index) => `
      <div 
        class="sq-puzzle-option ${index === this.riddleSelection ? 'selected' : ''}"
        data-index="${index}"
      >
        <span class="sq-puzzle-option-num">${index + 1}.</span>
        ${opt}
      </div>
    `).join('');
  }

  private buildSequenceDOM(): void {
    if (!this.currentSequence) return;

    this.container.innerHTML = `
      <div class="sq-puzzle-backdrop"></div>
      <div class="sq-puzzle-panel sequence">
        <div class="sq-puzzle-header">
          <h3 class="sq-puzzle-title">🔐 Sequence Lock</h3>
        </div>
        <div class="sq-puzzle-body">
          <div class="sq-sequence-display">
            <div class="sq-sequence-pattern">${this.currentSequence.display}</div>
            <div class="sq-sequence-hint">(Memorize the pattern - it will disappear!)</div>
          </div>
        </div>
        <div class="sq-puzzle-footer">
          <div class="sq-puzzle-hint">
            Memorizing...
          </div>
        </div>
      </div>
    `;

    this.container.addEventListener('click', (e) => this.handleClick(e));
  }

  private buildSequenceInputDOM(): void {
    if (!this.currentSequence) return;

    const arrows = ['↑', '→', '↓'];
    const inputStr = this.sequenceInputs.map(i => arrows[i]).join('  ') || '...';

    this.container.innerHTML = `
      <div class="sq-puzzle-backdrop"></div>
      <div class="sq-puzzle-panel sequence">
        <div class="sq-puzzle-header">
          <h3 class="sq-puzzle-title">⌨️ Enter the Sequence!</h3>
        </div>
        <div class="sq-puzzle-body">
          <div class="sq-sequence-input">
            <div class="sq-sequence-input-label">Your input:</div>
            <div class="sq-sequence-arrows">${inputStr}</div>
          </div>
          <div class="sq-sequence-progress">
            ${this.currentSequence.pattern.map((_, i) => `
              <div class="sq-sequence-dot ${i < this.sequenceInputs.length ? 'filled' : ''}"></div>
            `).join('')}
          </div>
        </div>
        <div class="sq-puzzle-footer">
          <div class="sq-puzzle-hint">
            <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd> Arrow Keys &nbsp; <kbd>Esc</kbd> Give up
          </div>
        </div>
      </div>
    `;

    this.container.addEventListener('click', (e) => this.handleClick(e));
  }

  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;

    if (target.classList.contains('sq-puzzle-backdrop')) {
      this.callbacks.onClose();
      this.close();
      return;
    }

    if (this.puzzleType === 'riddle') {
      const optionEl = target.closest('.sq-puzzle-option') as HTMLElement;
      if (optionEl) {
        const index = parseInt(optionEl.dataset.index || '0');
        this.riddleSelection = index;
        this.renderRiddleOptions();
        this.checkRiddleAnswer();
      }
    }
  }

  private setupKeyboardHandlers(): void {
    this.keyHandler = (e: KeyboardEvent) => {
      if (!this._isOpen) return;

      if (this.puzzleType === 'riddle' && !this.showingPattern) {
        this.handleRiddleKey(e);
      } else if (this.puzzleType === 'sequence' && !this.showingPattern) {
        this.handleSequenceKey(e);
      }
    };

    window.addEventListener('keydown', this.keyHandler, true);
  }

  private handleRiddleKey(e: KeyboardEvent): void {
    if (!this.currentRiddle) return;

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        e.stopPropagation();
        this.riddleSelection = Math.max(0, this.riddleSelection - 1);
        this.renderRiddleOptions();
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        e.stopPropagation();
        this.riddleSelection = Math.min(this.currentRiddle.options.length - 1, this.riddleSelection + 1);
        this.renderRiddleOptions();
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        e.stopPropagation();
        this.checkRiddleAnswer();
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this.callbacks.onClose();
        this.close();
        break;
    }
  }

  private handleSequenceKey(e: KeyboardEvent): void {
    if (!this.currentSequence) return;

    let inputValue = -1;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        inputValue = 0;
        break;
      case 'ArrowRight':
        e.preventDefault();
        e.stopPropagation();
        inputValue = 1;
        break;
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        inputValue = 2;
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this.callbacks.onClose();
        this.close();
        return;
    }

    if (inputValue >= 0) {
      this.sequenceInputs.push(inputValue);
      this.buildSequenceInputDOM();

      // Check if complete
      if (this.sequenceInputs.length >= this.currentSequence.pattern.length) {
        this.checkSequenceAnswer();
      }
    }
  }

  private removeKeyboardHandlers(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = null;
    }
  }

  private checkRiddleAnswer(): void {
    if (!this.currentRiddle) return;

    if (this.riddleSelection === this.currentRiddle.answer) {
      this.callbacks.onSolve();
    } else {
      this.callbacks.onFail();
    }
    this.close();
  }

  private checkSequenceAnswer(): void {
    if (!this.currentSequence) return;

    const correct = this.sequenceInputs.every(
      (input, index) => input === this.currentSequence!.pattern[index]
    );

    if (correct) {
      this.callbacks.onSolve();
    } else {
      this.callbacks.onFail();
    }
    this.close();
  }

  openRiddle(riddle: Riddle): void {
    if (this._isOpen) return;

    this.puzzleType = 'riddle';
    this.currentRiddle = riddle;
    this.riddleSelection = 0;
    this.showingPattern = false;

    this.buildRiddleDOM();
    this.container.style.display = 'block';
    this._isOpen = true;

    setTimeout(() => {
      if (this._isOpen) {
        this.setupKeyboardHandlers();
      }
    }, 100);
  }

  openSequence(sequence: Sequence): void {
    if (this._isOpen) return;

    this.puzzleType = 'sequence';
    this.currentSequence = sequence;
    this.sequenceInputs = [];
    this.showingPattern = true;

    this.buildSequenceDOM();
    this.container.style.display = 'block';
    this._isOpen = true;

    // Show pattern for 3 seconds then switch to input mode
    setTimeout(() => {
      if (this._isOpen && this.puzzleType === 'sequence') {
        this.showingPattern = false;
        this.buildSequenceInputDOM();
        this.setupKeyboardHandlers();
      }
    }, 3000);
  }

  close(): void {
    if (!this._isOpen) return;

    this.container.style.display = 'none';
    this._isOpen = false;
    this.removeKeyboardHandlers();
    this.puzzleType = null;
    this.currentRiddle = null;
    this.currentSequence = null;
  }

  destroy(): void {
    this.removeKeyboardHandlers();
    this.container.remove();
  }
}
