/**
 * StudyBuddyScene - REFACTORED
 *
 * KAPLAY scene for the Study Buddy cat companion widget.
 * Shows an animated cat that reacts to user activity.
 * Now uses shared UI components.
 */

import type { KAPLAYCtx, GameObj, SpriteComp, PosComp, AnchorComp, ScaleComp } from 'kaplay';
import { loadCatSprites, getCatSpriteName, type CatColor, type CatAnimationType } from '../sprites/catSprites.js';
import { createSpeechBubbleManager, getRandomMessage, type MessageCategory } from '../ui/speechBubble.js';
import { spawnParticles } from '../ui/effects.js';

export interface StudyBuddyState {
  catColor: CatColor;
  isActive: boolean;
  isSleeping: boolean;
}

export interface StudyBuddySceneData {
  state: StudyBuddyState;
  onCatClick?: () => void;
}

// Idle behavior timings
const IDLE_SWITCH_TIME = 10; // seconds
const SIT_TIME = 30; // seconds

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

    // Draw shadow under cat
    k.add([
      k.circle(25),
      k.pos(k.width() / 2, k.height() - 22),
      k.anchor('center'),
      k.scale(1, 0.32),
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

    // Speech bubble manager
    const speechBubble = createSpeechBubbleManager(k);

    // Idle state timer
    let idleTimer = 0;

    // Animation helper
    function setAnimation(anim: CatAnimationType): void {
      if (currentAnim === anim) return;
      currentAnim = anim;
      cat.use(k.sprite(getCatSpriteName(catColor, anim)));
      cat.play(anim);
    }

    // Show random message from category
    function showMessage(category: MessageCategory): void {
      const text = getRandomMessage(category);
      speechBubble.show(k.width() / 2, cat.pos.y - 30, text, 3);
    }

    // Celebrate with particles
    function celebrate(): void {
      setAnimation('jump');

      // Spawn colorful particles
      const colors = [
        k.rgb(255, 215, 0),
        k.rgb(255, 107, 107),
        k.rgb(74, 222, 128),
        k.rgb(96, 165, 250),
        k.rgb(244, 114, 182),
      ];

      for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 * i) / 20;
        const speed = 50 + Math.random() * 100;
        const color = colors[Math.floor(Math.random() * colors.length)];

        const particle = k.add([
          k.rect(2 + Math.random() * 3, 2 + Math.random() * 3),
          k.pos(k.width() / 2, k.height() - 50),
          k.color(color),
          k.move(k.Vec2.fromAngle(k.rad2deg(angle)), speed),
          k.lifespan(1, { fade: 0.5 }),
          k.z(50),
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
      showMessage('random');
      onCatClick?.();
    });

    // Update loop for idle behavior
    k.onUpdate(() => {
      if (isSleeping || currentAnim === 'jump') return;

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
    });

    // Expose scene controls via KAPLAY's trigger system
    k.on('studyBuddy:message', (category: MessageCategory) => {
      showMessage(category);
    });

    k.on('studyBuddy:celebrate', () => {
      celebrate();
    });

    k.on('studyBuddy:setActive', (active: boolean) => {
      if (active) {
        setAnimation('idle');
      } else {
        setAnimation('idle2');
      }
    });

    k.on('studyBuddy:setSleeping', (sleeping: boolean) => {
      if (sleeping) {
        setAnimation('sleep');
      } else {
        setAnimation(isActive ? 'idle' : 'idle2');
      }
    });
  });
}

// Re-export for backwards compatibility
export { getRandomMessage };
export type { MessageCategory };
