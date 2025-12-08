/**
 * StudyBuddyScene
 *
 * KAPLAY scene for the Study Buddy cat companion widget.
 * Shows an animated cat that reacts to user activity.
 * Ported from StudyBuddyCanvas.ts
 */

import type { KAPLAYCtx, GameObj, SpriteComp, PosComp, AnchorComp, ScaleComp } from 'kaplay';
import { loadCatSprites, getCatSpriteName, type CatColor, type CatAnimationType } from '../sprites/catSprites.js';

// Speech bubble messages
const MESSAGES = {
  sessionStart: ["Let's do this!", 'Ready to study!', 'Focus time!'],
  milestone15: ['Great focus!', "You're doing great!", '15 min!'],
  milestone25: ['Pomodoro complete!', 'Take a break?', 'Amazing focus!'],
  milestone45: ['Wow, marathon!', 'Incredible!', 'Study champion!'],
  returnFromIdle: ['Welcome back!', 'Missed you!', "Let's continue!"],
  foundXP: ['Found some XP!', '*happy meow*', 'Treasure!'],
  breakReminder: ['Stretch time?', 'Rest your eyes!', 'Quick break?'],
  random: ['*purr*', '*meow*', '*yawn*', '...zzz', '!'],
};

export type MessageCategory = keyof typeof MESSAGES;

export interface StudyBuddyState {
  catColor: CatColor;
  isActive: boolean;
  isSleeping: boolean;
}

export interface StudyBuddySceneData {
  state: StudyBuddyState;
  onCatClick?: () => void;
}

/**
 * Register the Study Buddy scene with a KAPLAY instance
 */
export function registerStudyBuddyScene(k: KAPLAYCtx): void {
  k.scene('studyBuddy', async (data: StudyBuddySceneData) => {
    const { state, onCatClick } = data;
    const { catColor, isActive, isSleeping } = state;

    // Load sprites for selected cat
    await loadCatSprites(k, catColor);

    // Determine initial animation
    let currentAnim: CatAnimationType = 'idle';
    if (isSleeping) currentAnim = 'sleep';
    else if (!isActive) currentAnim = 'idle2';

    // Clear background (transparent for widget overlay)
    k.onDraw(() => {
      k.drawRect({
        width: k.width(),
        height: k.height(),
        color: k.rgb(0, 0, 0),
        opacity: 0,
      });
    });

    // Draw shadow under cat (using scaled circle since KAPLAY doesn't have ellipse component)
    const shadow = k.add([
      k.circle(25),
      k.pos(k.width() / 2, k.height() - 22),
      k.anchor('center'),
      k.scale(1, 0.32), // Scale Y to create ellipse effect
      k.color(0, 0, 0),
      k.opacity(0.2),
    ]);

    // Add the cat sprite
    const cat = k.add([
      k.sprite(getCatSpriteName(catColor, currentAnim)),
      k.pos(k.width() / 2, k.height() - 56),
      k.anchor('center'),
      k.scale(2),
      k.area(),
      'cat',
    ]) as GameObj<SpriteComp | PosComp | AnchorComp | ScaleComp>;

    cat.play(currentAnim);

    // Speech bubble state
    let speechBubble: GameObj | null = null;
    let speechText: GameObj | null = null;
    let speechTimer: ReturnType<typeof setTimeout> | null = null;

    // Idle state timers
    let idleTimer = 0;
    const IDLE_SWITCH_TIME = 10; // seconds
    const SIT_TIME = 30; // seconds

    // Show speech bubble
    function showSpeechBubble(text: string, duration: number = 3): void {
      // Remove existing bubble
      hideSpeechBubble();

      // Create bubble background
      speechBubble = k.add([
        k.rect(80, 30, { radius: 8 }),
        k.pos(10, 5),
        k.color(255, 255, 255),
        k.outline(2, k.rgb(51, 51, 51)),
        k.z(10),
      ]);

      // Create text
      speechText = k.add([
        k.text(text, {
          size: 9,
          font: 'monospace',
          align: 'center',
        }),
        k.pos(50, 20),
        k.anchor('center'),
        k.color(51, 51, 51),
        k.z(11),
      ]);

      // Auto-hide after duration
      speechTimer = setTimeout(() => {
        hideSpeechBubble();
      }, duration * 1000);
    }

    function hideSpeechBubble(): void {
      if (speechBubble) {
        k.destroy(speechBubble);
        speechBubble = null;
      }
      if (speechText) {
        k.destroy(speechText);
        speechText = null;
      }
      if (speechTimer) {
        clearTimeout(speechTimer);
        speechTimer = null;
      }
    }

    // Show random message from category
    function showRandomMessage(category: MessageCategory): void {
      const msgs = MESSAGES[category];
      const text = msgs[Math.floor(Math.random() * msgs.length)];
      showSpeechBubble(text);
    }

    // Change animation
    function setAnimation(anim: CatAnimationType): void {
      if (currentAnim === anim) return;
      currentAnim = anim;
      cat.use(k.sprite(getCatSpriteName(catColor, anim)));
      cat.play(anim);
    }

    // Celebrate (jump animation)
    function celebrate(): void {
      setAnimation('jump');
      // Spawn particles
      for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 * i) / 20;
        const speed = 50 + Math.random() * 100;
        const colors = [k.rgb(255, 215, 0), k.rgb(255, 107, 107), k.rgb(74, 222, 128), k.rgb(96, 165, 250), k.rgb(244, 114, 182)];

        const particle = k.add([
          k.rect(2 + Math.random() * 3, 2 + Math.random() * 3),
          k.pos(k.width() / 2, k.height() - 50),
          k.color(colors[Math.floor(Math.random() * colors.length)]),
          k.move(k.Vec2.fromAngle(k.rad2deg(angle)), speed),
          k.lifespan(1, { fade: 0.5 }),
        ]);
      }

      // Return to idle after animation
      k.wait(2, () => {
        if (currentAnim === 'jump') {
          setAnimation(isActive ? 'idle' : 'idle2');
        }
      });
    }

    // Click handler
    cat.onClick(() => {
      showRandomMessage('random');
      if (onCatClick) {
        onCatClick();
      }
    });

    // Update loop
    k.onUpdate(() => {
      // Only update idle behavior if not sleeping or celebrating
      if (!isSleeping && currentAnim !== 'jump') {
        idleTimer += k.dt();

        // Switch between idle animations
        if (idleTimer > IDLE_SWITCH_TIME && currentAnim === 'idle') {
          setAnimation('idle2');
          idleTimer = 0;
        } else if (idleTimer > IDLE_SWITCH_TIME && currentAnim === 'idle2') {
          setAnimation('idle');
          idleTimer = 0;
        }

        // Sit down if very idle
        if (idleTimer > SIT_TIME && (currentAnim === 'idle' || currentAnim === 'idle2')) {
          setAnimation('sit');
          idleTimer = 0;
        }
      }
    });

    // Expose methods for external control via scene data
    // These can be called by re-entering the scene with updated data
  });
}

/**
 * Helper to get a random message
 */
export function getRandomMessage(category: MessageCategory): string {
  const msgs = MESSAGES[category];
  return msgs[Math.floor(Math.random() * msgs.length)];
}
