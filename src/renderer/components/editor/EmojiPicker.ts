/**
 * EmojiPicker
 *
 * Professional emoji picker component for notes editors.
 * Uses emoji-picker-element for native-like emoji selection.
 */

import 'emoji-picker-element';
import type { Editor } from '@tiptap/core';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('EmojiPicker');

export interface EmojiPickerOptions {
  onEmojiSelect: (emoji: string) => void;
  position?: { x: number; y: number };
}

/**
 * Create and show an emoji picker
 */
export function showEmojiPicker(editor: Editor, button: HTMLElement): void {
  // Check if picker already exists
  let picker = document.getElementById('emoji-picker-popup') as any;

  if (picker) {
    // Toggle visibility
    const isHidden = picker.style.display === 'none';
    picker.style.display = isHidden ? 'block' : 'none';

    if (!isHidden) {
      return; // Just hide it
    }

    // Position near the button when showing
    const buttonRect = button.getBoundingClientRect();
    picker.style.top = `${buttonRect.bottom + 8}px`;
    picker.style.left = `${buttonRect.left}px`;

    // Close picker when clicking outside
    const closeHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!picker.contains(target) && !button.contains(target)) {
        picker.style.display = 'none';
        document.removeEventListener('click', closeHandler);
      }
    };

    // Add close handler after a short delay to prevent immediate closing
    setTimeout(() => {
      document.addEventListener('click', closeHandler);
    }, 100);

    return; // Picker already has listener, just showing it
  }

  // Create new picker (first time only)
  picker = document.createElement('emoji-picker');
  picker.id = 'emoji-picker-popup';
  picker.className = 'emoji-picker-popup';

  // Style the picker
  picker.style.position = 'absolute';
  picker.style.zIndex = '2000'; // Above floating toolbar (1500), below modals (10000)
  picker.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
  picker.style.borderRadius = '12px';
  picker.style.overflow = 'hidden';

  // Position near the button
  const buttonRect = button.getBoundingClientRect();
  picker.style.top = `${buttonRect.bottom + 8}px`;
  picker.style.left = `${buttonRect.left}px`;

  // Add to document
  document.body.appendChild(picker);

  // Handle emoji selection (add listener ONCE during creation)
  const handleEmojiClick = (event: CustomEvent) => {
    const emoji = event.detail.unicode;

    // Insert emoji at cursor position
    editor.chain().focus().insertContent(emoji).run();

    // Hide picker after selection
    picker.style.display = 'none';

    logger.debug(`Inserted emoji: ${emoji}`);
  };

  // Add listener only once
  picker.addEventListener('emoji-click', handleEmojiClick);

  // Close picker when clicking outside
  const closeHandler = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!picker.contains(target) && !button.contains(target)) {
      picker.style.display = 'none';
      document.removeEventListener('click', closeHandler);
    }
  };

  // Add close handler after a short delay to prevent immediate closing
  setTimeout(() => {
    document.addEventListener('click', closeHandler);
  }, 100);
}

/**
 * Create emoji button for toolbar
 */
export function createEmojiButton(editor: Editor, options: {
  iconHTML: string;
  className?: string;
} = { iconHTML: '😊' }): HTMLButtonElement {
  const { iconHTML, className = '' } = options;

  const button = document.createElement('button');
  button.className = `toolbar-btn emoji-picker-btn ${className}`;
  button.setAttribute('title', 'Insert Emoji');
  button.innerHTML = iconHTML;
  button.type = 'button';

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showEmojiPicker(editor, button);
  });

  return button;
}

/**
 * Add emoji picker CSS
 */
export function addEmojiPickerStyles(): void {
  const styleId = 'emoji-picker-styles';

  // Check if styles already added
  if (document.getElementById(styleId)) {
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    emoji-picker {
      --background: var(--bg-secondary, #2a2a2a);
      --border-color: var(--border, #444);
      --button-active-background: var(--accent, #007acc);
      --button-hover-background: rgba(255, 255, 255, 0.1);
      --input-border-color: var(--border, #444);
      --input-font-color: var(--text-primary, #fff);
      --input-placeholder-color: var(--text-secondary, #999);
      --outline-color: var(--accent, #007acc);
      --category-emoji-size: 1.375rem;
      --emoji-size: 1.5rem;
      --indicator-color: var(--accent, #007acc);
      --indicator-height: 3px;
      width: 350px;
      height: 400px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .emoji-picker-popup {
      display: block;
      animation: emojiPickerFadeIn 0.2s ease;
    }

    @keyframes emojiPickerFadeIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      emoji-picker {
        width: 300px;
        height: 350px;
      }
    }
  `;

  document.head.appendChild(style);
  logger.info('Emoji picker styles added');
}

/**
 * Initialize emoji picker support
 */
export function initEmojiPicker(): void {
  // Add styles when component is first used
  addEmojiPickerStyles();
  logger.info('Emoji picker initialized');
}
