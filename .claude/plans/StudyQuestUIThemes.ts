/**
 * StudyQuestUIThemes.ts
 * 
 * NEW UI Theme definitions using the uploaded sprite sheets.
 * Each theme maps sprite regions (x, y, width, height) for UI elements.
 * 
 * To integrate:
 * 1. Copy sprite sheets to: assets/sprites/studyquest/ui/
 * 2. Replace content in src/renderer/components/studyquest/StudyQuestThemes.ts
 * 3. The theme system will automatically apply these!
 */

import type { CatColor } from './SpriteLoader.js';

// Sprite region definition
export interface SpriteRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Full sprite configuration for a theme
export interface ThemeSpriteConfig {
  // Panels
  panelSmall: SpriteRegion;      // Small cards (shop items, class cards)
  panelMedium: SpriteRegion;     // Medium panels (town buildings, quest cards)
  panelLarge: SpriteRegion;      // Large panels (dialogs, character sheet)
  panelMenu: SpriteRegion;       // Menu panel (PLAY/SETTINGS/EXIT style)
  
  // Buttons
  buttonNormal: SpriteRegion;    // Default button state
  buttonHover: SpriteRegion;     // Hover state
  buttonPressed: SpriteRegion;   // Pressed/active state
  buttonSuccess: SpriteRegion;   // Green/success button
  buttonDanger: SpriteRegion;    // Red/danger button
  
  // Health/Status
  healthBarBg: SpriteRegion;     // Health bar background
  healthBarFill: SpriteRegion;   // Health bar fill (will be scaled)
  heartFull: SpriteRegion;       // Full heart
  heartHalf: SpriteRegion;       // Half heart
  heartEmpty: SpriteRegion;      // Empty heart
  
  // Inventory
  inventorySlot: SpriteRegion;   // Single inventory slot
  inventoryGrid: SpriteRegion;   // Full inventory grid (optional)
  
  // Icons (16x16 or similar)
  iconCoin: SpriteRegion;
  iconStar: SpriteRegion;
  iconCheck: SpriteRegion;
  iconX: SpriteRegion;
  iconArrowLeft: SpriteRegion;
  iconArrowRight: SpriteRegion;
  iconArrowUp: SpriteRegion;
  iconArrowDown: SpriteRegion;
}

// Theme definition
export interface StudyQuestTheme {
  id: string;
  name: string;
  description: string;
  
  // Sprite sheet path (relative to assets/)
  spriteSheet: string;
  
  // Sprite regions
  sprites: ThemeSpriteConfig;
  
  // CSS color overrides (for elements not using sprites)
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    success: string;
    danger: string;
    warning: string;
  };
  
  // Optional: specific cat color that matches theme
  recommendedCatColor?: CatColor;
}

// =============================================================================
// THEME DEFINITIONS
// =============================================================================

/**
 * 🐱 CAT THEME (catUI.png) - RECOMMENDED DEFAULT
 * Cat-shaped panels, paw buttons, sleeping cats
 */
export const CAT_THEME: StudyQuestTheme = {
  id: 'cat',
  name: 'Cat Theme',
  description: 'Adorable cat-shaped UI perfect for StudyQuest!',
  spriteSheet: 'assets/sprites/studyquest/ui/catUI.png',
  recommendedCatColor: 'orange',
  
  sprites: {
    // Cat-ear panels (the pink cat-head shaped ones)
    panelSmall: { x: 344, y: 352, width: 80, height: 96 },    // Small cat panel
    panelMedium: { x: 264, y: 352, width: 80, height: 112 },  // Medium cat panel  
    panelLarge: { x: 0, y: 448, width: 128, height: 112 },    // Large dialog panel
    panelMenu: { x: 264, y: 272, width: 80, height: 80 },     // Cat menu (PLAY/SETTINGS/EXIT)
    
    // Rounded buttons with paw theme
    buttonNormal: { x: 0, y: 128, width: 48, height: 16 },
    buttonHover: { x: 48, y: 128, width: 48, height: 16 },
    buttonPressed: { x: 96, y: 128, width: 48, height: 16 },
    buttonSuccess: { x: 168, y: 336, width: 48, height: 16 },
    buttonDanger: { x: 216, y: 336, width: 48, height: 16 },
    
    // Health bar with cat icon
    healthBarBg: { x: 0, y: 0, width: 96, height: 16 },
    healthBarFill: { x: 16, y: 0, width: 80, height: 8 },
    heartFull: { x: 344, y: 272, width: 16, height: 16 },
    heartHalf: { x: 360, y: 272, width: 16, height: 16 },
    heartEmpty: { x: 376, y: 272, width: 16, height: 16 },
    
    // Inventory slots
    inventorySlot: { x: 136, y: 192, width: 16, height: 16 },
    inventoryGrid: { x: 424, y: 352, width: 80, height: 80 },
    
    // Icons (paw-themed where possible)
    iconCoin: { x: 168, y: 192, width: 16, height: 16 },
    iconStar: { x: 184, y: 192, width: 16, height: 16 },
    iconCheck: { x: 200, y: 192, width: 16, height: 16 },
    iconX: { x: 216, y: 192, width: 16, height: 16 },
    iconArrowLeft: { x: 344, y: 64, width: 16, height: 16 },
    iconArrowRight: { x: 360, y: 64, width: 16, height: 16 },
    iconArrowUp: { x: 376, y: 64, width: 16, height: 16 },
    iconArrowDown: { x: 392, y: 64, width: 16, height: 16 },
  },
  
  colors: {
    primary: '#D4A574',      // Warm tan
    secondary: '#F5D6BA',    // Light cream
    accent: '#E8B89D',       // Soft peach
    background: '#2A2A2A',   // Dark bg
    surface: '#3A3A3A',      // Surface
    text: '#FFFFFF',
    textMuted: '#B0A090',
    border: '#8B7355',       // Brown border
    success: '#7CB87C',
    danger: '#C27070',
    warning: '#D4A574',
  },
};

/**
 * 🌸 PASTEL THEME (PastelUi.png)
 * Soft rainbow colors, multiple color variants
 */
export const PASTEL_THEME: StudyQuestTheme = {
  id: 'pastel',
  name: 'Pastel Dream',
  description: 'Soft, cozy colors for a relaxing study session',
  spriteSheet: 'assets/sprites/studyquest/ui/PastelUi.png',
  recommendedCatColor: 'white',
  
  sprites: {
    panelSmall: { x: 624, y: 288, width: 96, height: 112 },
    panelMedium: { x: 720, y: 288, width: 96, height: 112 },
    panelLarge: { x: 304, y: 464, width: 160, height: 144 },
    panelMenu: { x: 0, y: 80, width: 64, height: 64 },
    
    buttonNormal: { x: 136, y: 0, width: 64, height: 24 },
    buttonHover: { x: 200, y: 0, width: 64, height: 24 },
    buttonPressed: { x: 136, y: 24, width: 64, height: 24 },
    buttonSuccess: { x: 280, y: 192, width: 48, height: 16 },
    buttonDanger: { x: 280, y: 160, width: 48, height: 16 },
    
    healthBarBg: { x: 0, y: 0, width: 128, height: 24 },
    healthBarFill: { x: 32, y: 8, width: 88, height: 8 },
    heartFull: { x: 592, y: 768, width: 16, height: 16 },
    heartHalf: { x: 592, y: 784, width: 16, height: 16 },
    heartEmpty: { x: 592, y: 800, width: 16, height: 16 },
    
    inventorySlot: { x: 528, y: 0, width: 16, height: 16 },
    inventoryGrid: { x: 624, y: 160, width: 128, height: 128 },
    
    iconCoin: { x: 0, y: 288, width: 16, height: 16 },
    iconStar: { x: 16, y: 288, width: 16, height: 16 },
    iconCheck: { x: 0, y: 256, width: 16, height: 16 },
    iconX: { x: 32, y: 256, width: 16, height: 16 },
    iconArrowLeft: { x: 352, y: 160, width: 16, height: 16 },
    iconArrowRight: { x: 368, y: 160, width: 16, height: 16 },
    iconArrowUp: { x: 384, y: 160, width: 16, height: 16 },
    iconArrowDown: { x: 400, y: 160, width: 16, height: 16 },
  },
  
  colors: {
    primary: '#A8D8EA',      // Soft blue
    secondary: '#FFD3B6',    // Soft peach
    accent: '#DCEDC1',       // Soft green
    background: '#F8F8F8',
    surface: '#FFFFFF',
    text: '#5A5A5A',
    textMuted: '#9A9A9A',
    border: '#E0E0E0',
    success: '#B5E8B5',
    danger: '#FFB3B3',
    warning: '#FFE5A0',
  },
};

/**
 * 🌲 FAIRYTALE THEME (FairytaleUI.png)
 * Forest/nature vibes with green tones
 */
export const FAIRYTALE_THEME: StudyQuestTheme = {
  id: 'fairytale',
  name: 'Enchanted Forest',
  description: 'A magical forest adventure awaits!',
  spriteSheet: 'assets/sprites/studyquest/ui/FairytaleUI.png',
  recommendedCatColor: 'brown',
  
  sprites: {
    panelSmall: { x: 0, y: 416, width: 96, height: 96 },
    panelMedium: { x: 0, y: 512, width: 128, height: 96 },
    panelLarge: { x: 0, y: 608, width: 176, height: 128 },
    panelMenu: { x: 0, y: 128, width: 96, height: 96 },
    
    buttonNormal: { x: 0, y: 256, width: 80, height: 24 },
    buttonHover: { x: 80, y: 256, width: 80, height: 24 },
    buttonPressed: { x: 0, y: 280, width: 80, height: 24 },
    buttonSuccess: { x: 272, y: 256, width: 64, height: 24 },
    buttonDanger: { x: 272, y: 280, width: 64, height: 24 },
    
    healthBarBg: { x: 264, y: 0, width: 128, height: 24 },
    healthBarFill: { x: 296, y: 8, width: 88, height: 8 },
    heartFull: { x: 416, y: 320, width: 16, height: 16 },
    heartHalf: { x: 432, y: 320, width: 16, height: 16 },
    heartEmpty: { x: 448, y: 320, width: 16, height: 16 },
    
    inventorySlot: { x: 336, y: 96, width: 16, height: 16 },
    inventoryGrid: { x: 392, y: 96, width: 96, height: 96 },
    
    iconCoin: { x: 0, y: 336, width: 16, height: 16 },
    iconStar: { x: 16, y: 336, width: 16, height: 16 },
    iconCheck: { x: 32, y: 336, width: 16, height: 16 },
    iconX: { x: 48, y: 336, width: 16, height: 16 },
    iconArrowLeft: { x: 344, y: 224, width: 16, height: 16 },
    iconArrowRight: { x: 360, y: 224, width: 16, height: 16 },
    iconArrowUp: { x: 376, y: 224, width: 16, height: 16 },
    iconArrowDown: { x: 392, y: 224, width: 16, height: 16 },
  },
  
  colors: {
    primary: '#4A7C59',      // Forest green
    secondary: '#8B6914',    // Wood brown
    accent: '#C9A227',       // Gold
    background: '#1A2F1A',
    surface: '#2D4A2D',
    text: '#E8E8D0',
    textMuted: '#A0A080',
    border: '#5C4033',
    success: '#6B8E23',
    danger: '#8B0000',
    warning: '#DAA520',
  },
};

/**
 * ✨ MAGIC THEME (UImAGIC.png)
 * Purple wizard aesthetic with ornate frames
 */
export const MAGIC_THEME: StudyQuestTheme = {
  id: 'magic',
  name: 'Arcane Magic',
  description: 'Channel your inner wizard with mystical UI',
  spriteSheet: 'assets/sprites/studyquest/ui/UImAGIC.png',
  recommendedCatColor: 'black',
  
  sprites: {
    panelSmall: { x: 0, y: 288, width: 128, height: 96 },
    panelMedium: { x: 0, y: 384, width: 160, height: 112 },
    panelLarge: { x: 0, y: 0, width: 128, height: 160 },
    panelMenu: { x: 0, y: 160, width: 96, height: 96 },
    
    buttonNormal: { x: 264, y: 0, width: 80, height: 24 },
    buttonHover: { x: 344, y: 0, width: 80, height: 24 },
    buttonPressed: { x: 264, y: 24, width: 80, height: 24 },
    buttonSuccess: { x: 264, y: 96, width: 64, height: 24 },
    buttonDanger: { x: 264, y: 120, width: 64, height: 24 },
    
    healthBarBg: { x: 264, y: 48, width: 128, height: 24 },
    healthBarFill: { x: 280, y: 56, width: 96, height: 8 },
    heartFull: { x: 552, y: 192, width: 16, height: 16 },
    heartHalf: { x: 568, y: 192, width: 16, height: 16 },
    heartEmpty: { x: 584, y: 192, width: 16, height: 16 },
    
    inventorySlot: { x: 616, y: 96, width: 24, height: 24 },
    inventoryGrid: { x: 616, y: 0, width: 96, height: 96 },
    
    iconCoin: { x: 296, y: 416, width: 16, height: 16 },
    iconStar: { x: 312, y: 416, width: 16, height: 16 },
    iconCheck: { x: 264, y: 352, width: 16, height: 16 },
    iconX: { x: 280, y: 352, width: 16, height: 16 },
    iconArrowLeft: { x: 488, y: 192, width: 16, height: 16 },
    iconArrowRight: { x: 504, y: 192, width: 16, height: 16 },
    iconArrowUp: { x: 520, y: 192, width: 16, height: 16 },
    iconArrowDown: { x: 536, y: 192, width: 16, height: 16 },
  },
  
  colors: {
    primary: '#8B5CF6',      // Vivid purple
    secondary: '#4C1D95',    // Deep purple
    accent: '#F59E0B',       // Gold accent
    background: '#1E1033',
    surface: '#2D1F4A',
    text: '#E8E0F0',
    textMuted: '#9580B0',
    border: '#6D28D9',
    success: '#10B981',
    danger: '#DC2626',
    warning: '#F59E0B',
  },
};

/**
 * 🖤 MINIMAL THEME (BlackandWhiteUI.png)
 * Clean black and white for accessibility
 */
export const MINIMAL_THEME: StudyQuestTheme = {
  id: 'minimal',
  name: 'Minimal',
  description: 'Clean and simple black & white design',
  spriteSheet: 'assets/sprites/studyquest/ui/BlackandWhiteUI.png',
  
  sprites: {
    panelSmall: { x: 344, y: 128, width: 80, height: 80 },
    panelMedium: { x: 424, y: 128, width: 96, height: 96 },
    panelLarge: { x: 0, y: 176, width: 176, height: 96 },
    panelMenu: { x: 168, y: 48, width: 96, height: 80 },
    
    buttonNormal: { x: 136, y: 0, width: 64, height: 24 },
    buttonHover: { x: 200, y: 0, width: 64, height: 24 },
    buttonPressed: { x: 136, y: 24, width: 64, height: 24 },
    buttonSuccess: { x: 392, y: 256, width: 48, height: 16 },
    buttonDanger: { x: 440, y: 256, width: 48, height: 16 },
    
    healthBarBg: { x: 0, y: 0, width: 128, height: 24 },
    healthBarFill: { x: 32, y: 8, width: 88, height: 8 },
    heartFull: { x: 408, y: 0, width: 16, height: 16 },
    heartHalf: { x: 424, y: 0, width: 16, height: 16 },
    heartEmpty: { x: 440, y: 0, width: 16, height: 16 },
    
    inventorySlot: { x: 264, y: 48, width: 16, height: 16 },
    inventoryGrid: { x: 344, y: 208, width: 80, height: 80 },
    
    iconCoin: { x: 264, y: 128, width: 16, height: 16 },
    iconStar: { x: 280, y: 128, width: 16, height: 16 },
    iconCheck: { x: 296, y: 128, width: 16, height: 16 },
    iconX: { x: 312, y: 128, width: 16, height: 16 },
    iconArrowLeft: { x: 264, y: 64, width: 16, height: 16 },
    iconArrowRight: { x: 280, y: 64, width: 16, height: 16 },
    iconArrowUp: { x: 296, y: 64, width: 16, height: 16 },
    iconArrowDown: { x: 312, y: 64, width: 16, height: 16 },
  },
  
  colors: {
    primary: '#333333',
    secondary: '#666666',
    accent: '#888888',
    background: '#FFFFFF',
    surface: '#F5F5F5',
    text: '#1A1A1A',
    textMuted: '#666666',
    border: '#CCCCCC',
    success: '#2D5A2D',
    danger: '#8B0000',
    warning: '#8B6914',
  },
};

/**
 * 🍫 ELEGANT BROWN THEME (UI.png)
 * Warm brown tones, classic RPG feel
 */
export const ELEGANT_BROWN_THEME: StudyQuestTheme = {
  id: 'elegant-brown',
  name: 'Classic Brown',
  description: 'Warm, classic RPG styling',
  spriteSheet: 'assets/sprites/studyquest/ui/UI.png',
  recommendedCatColor: 'brown',
  
  sprites: {
    panelSmall: { x: 344, y: 128, width: 80, height: 80 },
    panelMedium: { x: 424, y: 128, width: 96, height: 96 },
    panelLarge: { x: 0, y: 176, width: 176, height: 96 },
    panelMenu: { x: 168, y: 48, width: 96, height: 80 },
    
    buttonNormal: { x: 136, y: 0, width: 64, height: 24 },
    buttonHover: { x: 200, y: 0, width: 64, height: 24 },
    buttonPressed: { x: 136, y: 24, width: 64, height: 24 },
    buttonSuccess: { x: 392, y: 256, width: 48, height: 16 },
    buttonDanger: { x: 440, y: 256, width: 48, height: 16 },
    
    healthBarBg: { x: 0, y: 0, width: 128, height: 24 },
    healthBarFill: { x: 32, y: 8, width: 88, height: 8 },
    heartFull: { x: 408, y: 0, width: 16, height: 16 },
    heartHalf: { x: 424, y: 0, width: 16, height: 16 },
    heartEmpty: { x: 440, y: 0, width: 16, height: 16 },
    
    inventorySlot: { x: 264, y: 48, width: 16, height: 16 },
    inventoryGrid: { x: 344, y: 208, width: 80, height: 80 },
    
    iconCoin: { x: 264, y: 128, width: 16, height: 16 },
    iconStar: { x: 280, y: 128, width: 16, height: 16 },
    iconCheck: { x: 296, y: 128, width: 16, height: 16 },
    iconX: { x: 312, y: 128, width: 16, height: 16 },
    iconArrowLeft: { x: 264, y: 64, width: 16, height: 16 },
    iconArrowRight: { x: 280, y: 64, width: 16, height: 16 },
    iconArrowUp: { x: 296, y: 64, width: 16, height: 16 },
    iconArrowDown: { x: 312, y: 64, width: 16, height: 16 },
  },
  
  colors: {
    primary: '#8B4513',      // Saddle brown
    secondary: '#A0522D',    // Sienna
    accent: '#D2691E',       // Chocolate
    background: '#1C1410',
    surface: '#2D241C',
    text: '#F5E6D3',
    textMuted: '#B8A090',
    border: '#5C4033',
    success: '#556B2F',
    danger: '#8B0000',
    warning: '#B8860B',
  },
};

/**
 * 👑 ROYAL THEME (UiElegant.png)
 * Dark with gold trim for a premium feel
 */
export const ROYAL_THEME: StudyQuestTheme = {
  id: 'royal',
  name: 'Royal Gold',
  description: 'Elegant dark theme with gold accents',
  spriteSheet: 'assets/sprites/studyquest/ui/UiElegant.png',
  recommendedCatColor: 'grey',
  
  sprites: {
    panelSmall: { x: 344, y: 128, width: 80, height: 80 },
    panelMedium: { x: 424, y: 128, width: 96, height: 96 },
    panelLarge: { x: 0, y: 176, width: 176, height: 96 },
    panelMenu: { x: 168, y: 48, width: 96, height: 80 },
    
    buttonNormal: { x: 136, y: 0, width: 64, height: 24 },
    buttonHover: { x: 200, y: 0, width: 64, height: 24 },
    buttonPressed: { x: 136, y: 24, width: 64, height: 24 },
    buttonSuccess: { x: 392, y: 256, width: 48, height: 16 },
    buttonDanger: { x: 440, y: 256, width: 48, height: 16 },
    
    healthBarBg: { x: 0, y: 0, width: 128, height: 24 },
    healthBarFill: { x: 32, y: 8, width: 88, height: 8 },
    heartFull: { x: 408, y: 0, width: 16, height: 16 },
    heartHalf: { x: 424, y: 0, width: 16, height: 16 },
    heartEmpty: { x: 440, y: 0, width: 16, height: 16 },
    
    inventorySlot: { x: 264, y: 48, width: 16, height: 16 },
    inventoryGrid: { x: 344, y: 208, width: 80, height: 80 },
    
    iconCoin: { x: 264, y: 128, width: 16, height: 16 },
    iconStar: { x: 280, y: 128, width: 16, height: 16 },
    iconCheck: { x: 296, y: 128, width: 16, height: 16 },
    iconX: { x: 312, y: 128, width: 16, height: 16 },
    iconArrowLeft: { x: 264, y: 64, width: 16, height: 16 },
    iconArrowRight: { x: 280, y: 64, width: 16, height: 16 },
    iconArrowUp: { x: 296, y: 64, width: 16, height: 16 },
    iconArrowDown: { x: 312, y: 64, width: 16, height: 16 },
  },
  
  colors: {
    primary: '#C9A227',      // Gold
    secondary: '#1A1A2E',    // Dark blue-black
    accent: '#FFD700',       // Bright gold
    background: '#0D0D14',
    surface: '#1A1A28',
    text: '#F0E6D2',
    textMuted: '#8B8B7A',
    border: '#4A4A3A',
    success: '#4A7C59',
    danger: '#8B2500',
    warning: '#DAA520',
  },
};

/**
 * 💀 HORROR THEME (UiHorror.png)
 * Spooky dark red for Halloween or horror dungeons
 */
export const HORROR_THEME: StudyQuestTheme = {
  id: 'horror',
  name: 'Spooky Night',
  description: 'Dark and spooky for brave adventurers!',
  spriteSheet: 'assets/sprites/studyquest/ui/UiHorror.png',
  recommendedCatColor: 'black',
  
  sprites: {
    panelSmall: { x: 728, y: 64, width: 80, height: 80 },
    panelMedium: { x: 808, y: 64, width: 96, height: 96 },
    panelLarge: { x: 0, y: 192, width: 160, height: 96 },
    panelMenu: { x: 176, y: 96, width: 96, height: 80 },
    
    buttonNormal: { x: 0, y: 64, width: 80, height: 24 },
    buttonHover: { x: 80, y: 64, width: 80, height: 24 },
    buttonPressed: { x: 0, y: 88, width: 80, height: 24 },
    buttonSuccess: { x: 560, y: 192, width: 64, height: 24 },
    buttonDanger: { x: 624, y: 192, width: 64, height: 24 },
    
    healthBarBg: { x: 0, y: 0, width: 176, height: 24 },
    healthBarFill: { x: 32, y: 8, width: 136, height: 8 },
    heartFull: { x: 872, y: 160, width: 16, height: 16 },
    heartHalf: { x: 888, y: 160, width: 16, height: 16 },
    heartEmpty: { x: 904, y: 160, width: 16, height: 16 },
    
    inventorySlot: { x: 728, y: 0, width: 24, height: 24 },
    inventoryGrid: { x: 728, y: 144, width: 96, height: 96 },
    
    iconCoin: { x: 0, y: 288, width: 16, height: 16 },
    iconStar: { x: 16, y: 288, width: 16, height: 16 },
    iconCheck: { x: 32, y: 288, width: 16, height: 16 },
    iconX: { x: 48, y: 288, width: 16, height: 16 },
    iconArrowLeft: { x: 472, y: 128, width: 16, height: 16 },
    iconArrowRight: { x: 488, y: 128, width: 16, height: 16 },
    iconArrowUp: { x: 504, y: 128, width: 16, height: 16 },
    iconArrowDown: { x: 520, y: 128, width: 16, height: 16 },
  },
  
  colors: {
    primary: '#8B0000',      // Dark red
    secondary: '#2D0A0A',    // Very dark red
    accent: '#DC143C',       // Crimson
    background: '#0A0505',
    surface: '#1A0A0A',
    text: '#E8D0D0',
    textMuted: '#8B7070',
    border: '#4A2020',
    success: '#2D5A2D',
    danger: '#DC143C',
    warning: '#B8860B',
  },
};

// =============================================================================
// THEME REGISTRY
// =============================================================================

export const ALL_THEMES: StudyQuestTheme[] = [
  CAT_THEME,          // Default - it's a cat game!
  PASTEL_THEME,
  FAIRYTALE_THEME,
  MAGIC_THEME,
  MINIMAL_THEME,
  ELEGANT_BROWN_THEME,
  ROYAL_THEME,
  HORROR_THEME,
];

export const DEFAULT_THEME = CAT_THEME;

/**
 * Get theme by ID
 */
export function getThemeById(id: string): StudyQuestTheme {
  return ALL_THEMES.find(t => t.id === id) || DEFAULT_THEME;
}

/**
 * Get all available theme IDs
 */
export function getAvailableThemeIds(): string[] {
  return ALL_THEMES.map(t => t.id);
}
