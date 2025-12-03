/**
 * AppEasterEggs
 *
 * Fun interactive features: Konami code, triple-click Study Buddy.
 */

import { KonamiCodeDetector, TripleClickDetector, StudyBuddy, triggerCatParty } from '../utils/easter-eggs.js';

export class AppEasterEggs {
  /**
   * Initialize all easter eggs
   */
  static initialize(): void {
    // 1. Konami Code Cat Party
    new KonamiCodeDetector(() => {
      console.log('🎉 Konami code activated!');
      triggerCatParty();
    });

    // 2. Triple-click app title for Study Buddy
    const appTitle = document.querySelector('.app-title') as HTMLElement;
    const appLogo = document.querySelector('.app-logo') as HTMLElement;

    if (appTitle) {
      const studyBuddy = new StudyBuddy();
      new TripleClickDetector(appTitle, (isActive) => {
        studyBuddy.toggle();

        // Visual feedback on logo
        if (appLogo) {
          appLogo.classList.add('easter-egg-active');
          setTimeout(() => appLogo.classList.remove('easter-egg-active'), 500);
        }
      });
    } else {
      console.warn('❌ App title not found for Study Buddy easter egg');
    }
  }

  /**
   * Print console ASCII art and info
   */
  static printConsoleArt(version: string): void {
    console.log(
      '%c     /\\_/\\  \n' +
      '    ( o.o ) \n' +
      '     > ^ <\n' +
      '    /|   |\\\n' +
      '   (_|   |_)\n',
      'color: #00ffff; font-family: monospace; font-size: 16px;'
    );
    console.log(
      '%c Curious cat found you! 👀',
      'color: #ff69b4; font-weight: bold; font-size: 14px;'
    );
    console.log(
      `%c ScribeCat v${version} - Brought to You by ADHD: Agentic Development of Human Designs 🧠⚡️`,
      'color: #ffd700; font-size: 12px;'
    );
    console.log(
      '%c Found a bug? Meow at us on GitHub!\n https://github.com/lmdrew96/ScribeCat-v2',
      'color: #c0c0c0; font-size: 11px;'
    );
    console.log('');
  }
}
