/**
 * Speech Bubble UI Component
 *
 * Creates and manages speech bubbles above entities.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';

export interface SpeechBubbleConfig {
  x: number;
  y: number;
  text: string;
  width?: number;
  duration?: number; // 0 = permanent until manually hidden
  fontSize?: number;
  backgroundColor?: ReturnType<typeof import('kaplay').default.rgb>;
  textColor?: ReturnType<typeof import('kaplay').default.rgb>;
}

export interface SpeechBubble {
  bubble: GameObj;
  textObj: GameObj;
  hide: () => void;
}

/**
 * Create a speech bubble
 */
export function createSpeechBubble(k: KAPLAYCtx, config: SpeechBubbleConfig): SpeechBubble {
  const {
    x,
    y,
    text,
    width = 80,
    duration = 3,
    fontSize = 9,
  } = config;

  const height = 30;
  const tailSize = 8;

  // Background bubble
  const bubble = k.add([
    k.rect(width, height, { radius: 8 }),
    k.pos(x - width / 2, y - height - tailSize),
    k.color(255, 255, 255),
    k.outline(2, k.rgb(51, 51, 51)),
    k.z(100),
    'speechBubble',
  ]);

  // Bubble tail (triangle pointing down)
  const tail = k.add([
    k.polygon([
      k.vec2(0, 0),
      k.vec2(tailSize, 0),
      k.vec2(tailSize / 2, tailSize),
    ]),
    k.pos(x - tailSize / 2, y - tailSize),
    k.color(255, 255, 255),
    k.z(99),
    'speechBubble',
  ]);

  // Text
  const textObj = k.add([
    k.text(text, {
      size: fontSize,
      width: width - 10,
      align: 'center',
    }),
    k.pos(x, y - height / 2 - tailSize),
    k.anchor('center'),
    k.color(51, 51, 51),
    k.z(101),
    'speechBubble',
  ]);

  let hideTimeout: ReturnType<typeof setTimeout> | null = null;

  const hide = () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
    if (bubble.exists()) k.destroy(bubble);
    if (tail.exists()) k.destroy(tail);
    if (textObj.exists()) k.destroy(textObj);
  };

  // Auto-hide after duration
  if (duration > 0) {
    hideTimeout = setTimeout(hide, duration * 1000);
  }

  return {
    bubble,
    textObj,
    hide,
  };
}

/**
 * Create a speech bubble manager for an entity
 */
export function createSpeechBubbleManager(k: KAPLAYCtx) {
  let currentBubble: SpeechBubble | null = null;

  return {
    show(x: number, y: number, text: string, duration = 3) {
      // Hide existing bubble
      this.hide();

      currentBubble = createSpeechBubble(k, {
        x,
        y,
        text,
        duration,
      });

      return currentBubble;
    },

    hide() {
      if (currentBubble) {
        currentBubble.hide();
        currentBubble = null;
      }
    },

    get visible() {
      return currentBubble !== null;
    },
  };
}

/**
 * Message categories for random selection
 */
export const SPEECH_MESSAGES = {
  sessionStart: ["Let's do this!", 'Ready to study!', 'Focus time!'],
  milestone15: ['Great focus!', "You're doing great!", '15 min!'],
  milestone25: ['Pomodoro complete!', 'Take a break?', 'Amazing focus!'],
  milestone45: ['Wow, marathon!', 'Incredible!', 'Study champion!'],
  returnFromIdle: ['Welcome back!', 'Missed you!', "Let's continue!"],
  foundXP: ['Found some XP!', '*happy meow*', 'Treasure!'],
  breakReminder: ['Stretch time?', 'Rest your eyes!', 'Quick break?'],
  random: ['*purr*', '*meow*', '*yawn*', '...zzz', '!'],
  greeting: ['Hello!', 'Hi there!', 'Hey!'],
  goodbye: ['Bye!', 'See ya!', 'Later!'],
} as const;

export type MessageCategory = keyof typeof SPEECH_MESSAGES;

/**
 * Get a random message from a category
 */
export function getRandomMessage(category: MessageCategory): string {
  const messages = SPEECH_MESSAGES[category];
  return messages[Math.floor(Math.random() * messages.length)];
}
