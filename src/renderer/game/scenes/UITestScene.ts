/**
 * UI Test Scene
 *
 * A simple scene to test the UISystem components.
 * Shows main menu and handles button interactions.
 */

import type { KAPLAYCtx } from 'kaplay';
import { UISystem } from '../ui/index.js';

/**
 * Register the UI test scene
 */
export function registerUITestScene(k: KAPLAYCtx): void {
  k.scene('ui-test', async () => {
    // Create UI system with blue theme (default)
    const ui = new UISystem(k);
    await ui.setColorTheme('blue');

    // Function to show main menu (reusable for theme changes)
    const showMenu = async () => {
      await ui.showMainMenu({
        onPlay: async () => {
          ui.hideMainMenu();
          await ui.showOkDialog('Game starting!', () => {
            console.log('OK clicked - would start game here');
            showMenu(); // Return to menu for testing
          });
        },

        onSettings: async () => {
          ui.hideMainMenu();
          await ui.showYesNoDialog('Change to pink theme?', {
            onYes: async () => {
              console.log('Switching to pink theme');
              await ui.setColorTheme('pink');
              showMenu(); // Re-show menu with new theme
            },
            onNo: () => {
              console.log('Keeping current theme');
              showMenu(); // Return to menu
            },
          });
        },

        onExit: () => {
          console.log('Exit clicked');
          ui.hideMainMenu();
          // Show a confirmation dialog
          ui.showYesNoDialog('Really exit?', {
            onYes: () => {
              console.log('Exiting...');
              // In a real app, would close or go back
            },
            onNo: () => {
              showMenu();
            },
          });
        },
      });
    };

    // Show character HUD in corner for demo
    await ui.showCharacterHud(10, 10);
    ui.updateHealth(75, 100);
    ui.updateXP(30, 100);
    ui.updateCurrency(181122);

    // Health controls (1-3)
    k.onKeyPress('1', () => {
      ui.updateHealth(100, 100);
      console.log('Health: 100%');
    });
    k.onKeyPress('2', () => {
      ui.updateHealth(50, 100);
      console.log('Health: 50%');
    });
    k.onKeyPress('3', () => {
      ui.updateHealth(20, 100);
      console.log('Health: 20%');
    });

    // XP controls (4-6)
    k.onKeyPress('4', () => {
      ui.updateXP(100, 100);
      console.log('XP: 100%');
    });
    k.onKeyPress('5', () => {
      ui.updateXP(50, 100);
      console.log('XP: 50%');
    });
    k.onKeyPress('6', () => {
      ui.updateXP(0, 100);
      console.log('XP: 0%');
    });

    // Currency controls (7-9)
    let testCurrency = 181122;
    k.onKeyPress('7', () => {
      testCurrency += 100;
      ui.updateCurrency(testCurrency);
      console.log('Currency:', testCurrency);
    });
    k.onKeyPress('8', () => {
      testCurrency = Math.max(0, testCurrency - 100);
      ui.updateCurrency(testCurrency);
      console.log('Currency:', testCurrency);
    });
    k.onKeyPress('9', () => {
      testCurrency = 0;
      ui.updateCurrency(testCurrency);
      console.log('Currency: reset to 0');
    });

    // Theme switching hotkeys
    k.onKeyPress('b', () => {
      ui.setColorTheme('blue');
      console.log('Theme: blue');
    });
    k.onKeyPress('p', () => {
      ui.setColorTheme('pink');
      console.log('Theme: pink');
    });
    k.onKeyPress('g', () => {
      ui.setColorTheme('beige');
      console.log('Theme: beige');
    });
    k.onKeyPress('r', () => {
      ui.setColorTheme('brown');
      console.log('Theme: brown');
    });

    // Start by showing the main menu
    await showMenu();

    // Instructions
    console.log('=== UI Test Scene ===');
    console.log('Click menu buttons to test dialogs');
    console.log('Press 1/2/3 = Health (100%/50%/20%)');
    console.log('Press 4/5/6 = XP (100%/50%/0%)');
    console.log('Press 7/8/9 = Currency (+100/-100/reset)');
    console.log('Press B/P/G/R = Theme (Blue/Pink/beiGe/bRown)');
  });
}
