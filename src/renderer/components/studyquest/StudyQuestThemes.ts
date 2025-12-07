/**
 * StudyQuestThemes.ts
 *
 * UI Theme definitions using sprite sheets.
 * Each theme maps sprite regions (x, y, width, height) for UI elements.
 */

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

  // Preview region for settings panel
  preview: SpriteRegion;
}

// Backward compatibility alias
export type ThemeSpriteMap = ThemeSpriteConfig;

// Theme colors - merged structure
export interface ThemeColors {
  // Core colors (new)
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

  // Additional colors for compatibility
  surfaceAlt: string;
  shadow: string;
  textOnPrimary: string;
  gold: string;
  hp: string;
  hpBg: string;
  xp: string;
  xpBg: string;
}

// Theme definition
export interface StudyQuestTheme {
  id: StudyQuestThemeId;
  name: string;
  description: string;

  // Sprite sheet path (relative to assets/)
  spriteSheet: string;

  // Sprite regions
  sprites: ThemeSpriteConfig;

  // CSS color overrides
  colors: ThemeColors;

  // 9-slice corner inset for panels
  sliceInset: number;

  // Optional: specific cat color that matches theme
  recommendedCatColor?: 'orange' | 'black' | 'white' | 'grey' | 'brown' | 'cream';
}

// Theme IDs
export type StudyQuestThemeId =
  | 'cat'
  | 'pastel'
  | 'fairytale'
  | 'magic'
  | 'minimal'
  | 'elegant-brown'
  | 'royal'
  | 'horror';

// =============================================================================
// THEME DEFINITIONS
// =============================================================================

/**
 * CAT THEME (catUI.png) - DEFAULT
 * Cat-shaped panels, paw buttons, sleeping cats
 */
const CAT_THEME: StudyQuestTheme = {
  id: 'cat',
  name: 'Cat Theme',
  description: 'Adorable cat-shaped UI perfect for StudyQuest!',
  spriteSheet: '../../assets/sprites/studyquest/ui/catUI.png',
  recommendedCatColor: 'orange',
  sliceInset: 16,

  sprites: {
    // Dark bordered panels (left side at y:128, better for stretching)
    panelSmall: { x: 0, y: 128, width: 80, height: 96 },
    panelMedium: { x: 80, y: 128, width: 80, height: 96 },
    panelLarge: { x: 0, y: 128, width: 80, height: 96 },
    panelMenu: { x: 288, y: 272, width: 96, height: 112 },

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

    // Preview for settings
    preview: { x: 256, y: 304, width: 80, height: 96 },
  },

  colors: {
    primary: '#D4A574',
    secondary: '#F5D6BA',
    accent: '#E8B89D',
    background: '#f5e8d8',
    surface: '#fff5e8',
    text: '#5a4a3a',
    textMuted: '#8a7a6a',
    border: '#c8a888',
    success: '#7CB87C',
    danger: '#C27070',
    warning: '#D4A574',
    // Compatibility colors
    surfaceAlt: '#ffffff',
    shadow: '#e8d8c8',
    textOnPrimary: '#5a4a3a',
    gold: '#d4a040',
    hp: '#e06060',
    hpBg: '#f8e0e0',
    xp: '#60c060',
    xpBg: '#e0f8e0',
  },
};

/**
 * PASTEL THEME (PastelUi.png)
 * Soft rainbow colors, multiple color variants
 */
const PASTEL_THEME: StudyQuestTheme = {
  id: 'pastel',
  name: 'Pastel Dream',
  description: 'Soft, cozy colors for a relaxing study session',
  spriteSheet: '../../assets/sprites/studyquest/ui/PastelUi.png',
  recommendedCatColor: 'white',
  sliceInset: 8,

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

    preview: { x: 160, y: 384, width: 128, height: 96 },
  },

  colors: {
    primary: '#A8D8EA',
    secondary: '#FFD3B6',
    accent: '#DCEDC1',
    background: '#e8e0f0',
    surface: '#f5f0fa',
    text: '#4a4060',
    textMuted: '#7a7090',
    border: '#c8b8d8',
    success: '#B5E8B5',
    danger: '#FFB3B3',
    warning: '#FFE5A0',
    // Compatibility colors
    surfaceAlt: '#ffffff',
    shadow: '#d0c8e0',
    textOnPrimary: '#4a4060',
    gold: '#d4a840',
    hp: '#e07070',
    hpBg: '#f8e0e0',
    xp: '#70c070',
    xpBg: '#e0f8e0',
  },
};

/**
 * FAIRYTALE THEME (FairytaleUI.png)
 * Forest/nature vibes with green tones
 */
const FAIRYTALE_THEME: StudyQuestTheme = {
  id: 'fairytale',
  name: 'Enchanted Forest',
  description: 'A magical forest adventure awaits!',
  spriteSheet: '../../assets/sprites/studyquest/ui/FairytaleUI.png',
  recommendedCatColor: 'brown',
  sliceInset: 8,

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

    preview: { x: 0, y: 320, width: 128, height: 96 },
  },

  colors: {
    primary: '#4A7C59',
    secondary: '#8B6914',
    accent: '#C9A227',
    background: '#1a2a1a',
    surface: '#2a3a2a',
    text: '#f0fff0',
    textMuted: '#80a080',
    border: '#5a7a5a',
    success: '#6B8E23',
    danger: '#8B0000',
    warning: '#DAA520',
    // Compatibility colors
    surfaceAlt: '#3a4a3a',
    shadow: '#0a150a',
    textOnPrimary: '#ffffff',
    gold: '#daa520',
    hp: '#dd4444',
    hpBg: '#331515',
    xp: '#44dd44',
    xpBg: '#153315',
  },
};

/**
 * MAGIC THEME (UImAGIC.png)
 * Purple wizard aesthetic with ornate frames
 */
const MAGIC_THEME: StudyQuestTheme = {
  id: 'magic',
  name: 'Arcane Magic',
  description: 'Channel your inner wizard with mystical UI',
  spriteSheet: '../../assets/sprites/studyquest/ui/UImAGIC.png',
  recommendedCatColor: 'black',
  sliceInset: 16,

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

    preview: { x: 0, y: 256, width: 96, height: 80 },
  },

  colors: {
    primary: '#8B5CF6',
    secondary: '#4C1D95',
    accent: '#F59E0B',
    background: '#1a1528',
    surface: '#2a2540',
    text: '#e8e0f0',
    textMuted: '#9080a8',
    border: '#6a5090',
    success: '#10B981',
    danger: '#DC2626',
    warning: '#F59E0B',
    // Compatibility colors
    surfaceAlt: '#3a3550',
    shadow: '#0a0815',
    textOnPrimary: '#ffffff',
    gold: '#e6b422',
    hp: '#dd4444',
    hpBg: '#331515',
    xp: '#44dd44',
    xpBg: '#153315',
  },
};

/**
 * MINIMAL THEME (BlackandWhiteUI.png)
 * Clean black and white for accessibility
 */
const MINIMAL_THEME: StudyQuestTheme = {
  id: 'minimal',
  name: 'Minimal',
  description: 'Clean and simple black & white design',
  spriteSheet: '../../assets/sprites/studyquest/ui/BlackandWhiteUI.png',
  sliceInset: 8,

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

    preview: { x: 360, y: 90, width: 96, height: 96 },
  },

  colors: {
    primary: '#333333',
    secondary: '#666666',
    accent: '#888888',
    background: '#1a1a1a',
    surface: '#2a2a2a',
    text: '#ffffff',
    textMuted: '#888888',
    border: '#555555',
    success: '#2D5A2D',
    danger: '#8B0000',
    warning: '#8B6914',
    // Compatibility colors
    surfaceAlt: '#3a3a3a',
    shadow: '#000000',
    textOnPrimary: '#ffffff',
    gold: '#cccccc',
    hp: '#ff6666',
    hpBg: '#332222',
    xp: '#66ff66',
    xpBg: '#223322',
  },
};

/**
 * ELEGANT BROWN THEME (UI.png)
 * Warm brown tones, classic RPG feel
 */
const ELEGANT_BROWN_THEME: StudyQuestTheme = {
  id: 'elegant-brown',
  name: 'Classic Brown',
  description: 'Warm, classic RPG styling',
  spriteSheet: '../../assets/sprites/studyquest/ui/UI.png',
  recommendedCatColor: 'brown',
  sliceInset: 8,

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

    preview: { x: 360, y: 90, width: 96, height: 96 },
  },

  colors: {
    primary: '#8B4513',
    secondary: '#A0522D',
    accent: '#D2691E',
    background: '#1C1410',
    surface: '#2D241C',
    text: '#F5E6D3',
    textMuted: '#B8A090',
    border: '#5C4033',
    success: '#556B2F',
    danger: '#8B0000',
    warning: '#B8860B',
    // Compatibility colors
    surfaceAlt: '#3D342C',
    shadow: '#0C0805',
    textOnPrimary: '#ffffff',
    gold: '#daa520',
    hp: '#cc3333',
    hpBg: '#331111',
    xp: '#33cc33',
    xpBg: '#113311',
  },
};

/**
 * ROYAL THEME (UiElegant.png)
 * Dark with gold trim for a premium feel
 */
const ROYAL_THEME: StudyQuestTheme = {
  id: 'royal',
  name: 'Royal Gold',
  description: 'Elegant dark theme with gold accents',
  spriteSheet: '../../assets/sprites/studyquest/ui/UiElegant.png',
  recommendedCatColor: 'grey',
  sliceInset: 8,

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

    preview: { x: 360, y: 90, width: 96, height: 96 },
  },

  colors: {
    primary: '#C9A227',
    secondary: '#1A1A2E',
    accent: '#FFD700',
    background: '#0D0D14',
    surface: '#1A1A28',
    text: '#F0E6D2',
    textMuted: '#8B8B7A',
    border: '#4A4A3A',
    success: '#4A7C59',
    danger: '#8B2500',
    warning: '#DAA520',
    // Compatibility colors
    surfaceAlt: '#2A2A3E',
    shadow: '#050508',
    textOnPrimary: '#ffffff',
    gold: '#c9a227',
    hp: '#ff5555',
    hpBg: '#331515',
    xp: '#55ff55',
    xpBg: '#153315',
  },
};

/**
 * HORROR THEME (UiHorror.png)
 * Spooky dark red for Halloween or horror dungeons
 */
const HORROR_THEME: StudyQuestTheme = {
  id: 'horror',
  name: 'Spooky Night',
  description: 'Dark and spooky for brave adventurers!',
  spriteSheet: '../../assets/sprites/studyquest/ui/UiHorror.png',
  recommendedCatColor: 'black',
  sliceInset: 8,

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

    preview: { x: 904, y: 0, width: 80, height: 80 },
  },

  colors: {
    primary: '#8B0000',
    secondary: '#2D0A0A',
    accent: '#DC143C',
    background: '#0a0808',
    surface: '#1a1212',
    text: '#ddcccc',
    textMuted: '#887777',
    border: '#4a2020',
    success: '#2D5A2D',
    danger: '#DC143C',
    warning: '#B8860B',
    // Compatibility colors
    surfaceAlt: '#2a1a1a',
    shadow: '#000000',
    textOnPrimary: '#ffffff',
    gold: '#aa8833',
    hp: '#cc0000',
    hpBg: '#220000',
    xp: '#33aa33',
    xpBg: '#002200',
  },
};

// =============================================================================
// THEME REGISTRY
// =============================================================================

export const ALL_THEMES: StudyQuestTheme[] = [
  CAT_THEME,
  PASTEL_THEME,
  FAIRYTALE_THEME,
  MAGIC_THEME,
  MINIMAL_THEME,
  ELEGANT_BROWN_THEME,
  ROYAL_THEME,
  HORROR_THEME,
];

export const DEFAULT_THEME = CAT_THEME;

// Build STUDYQUEST_THEMES record for backward compatibility
export const STUDYQUEST_THEMES: Record<StudyQuestThemeId, StudyQuestTheme> = {
  cat: CAT_THEME,
  pastel: PASTEL_THEME,
  fairytale: FAIRYTALE_THEME,
  magic: MAGIC_THEME,
  minimal: MINIMAL_THEME,
  'elegant-brown': ELEGANT_BROWN_THEME,
  royal: ROYAL_THEME,
  horror: HORROR_THEME,
};

// Backward compatibility alias
export const THEME_LIST = ALL_THEMES;

/**
 * Get theme by ID (new API)
 */
export function getThemeById(id: string): StudyQuestTheme {
  return STUDYQUEST_THEMES[id as StudyQuestThemeId] || DEFAULT_THEME;
}

/**
 * Get theme by ID (backward compatible)
 */
export function getTheme(id: StudyQuestThemeId): StudyQuestTheme {
  return STUDYQUEST_THEMES[id] || DEFAULT_THEME;
}

/**
 * Get all available theme IDs (new API)
 */
export function getAvailableThemeIds(): string[] {
  return ALL_THEMES.map(t => t.id);
}

/**
 * Get all available theme IDs (backward compatible)
 */
export function getThemeIds(): StudyQuestThemeId[] {
  return Object.keys(STUDYQUEST_THEMES) as StudyQuestThemeId[];
}

/**
 * Migrate old theme ID to new theme ID
 */
export function migrateThemeId(oldId: string): StudyQuestThemeId {
  const migrations: Record<string, StudyQuestThemeId> = {
    'default': 'cat',
    'blackwhite': 'minimal',
    'elegant': 'royal',
    'medieval': 'elegant-brown',
  };
  return migrations[oldId] || (oldId as StudyQuestThemeId);
}
