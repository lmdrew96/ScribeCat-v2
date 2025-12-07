/**
 * StudyQuestThemes
 *
 * Theme definitions for StudyQuest UI theming system.
 * Each theme includes sprite sheet coordinates and color palette.
 */

// ============================================================================
// Types
// ============================================================================

export type StudyQuestThemeId =
  | 'default'
  | 'blackwhite'
  | 'elegant'
  | 'horror'
  | 'medieval'
  | 'magic'
  | 'fairytale'
  | 'pastel'
  | 'cat';

export interface SpriteRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ThemeSpriteMap {
  // Panels (for 9-slice scaling)
  panelLarge: SpriteRegion;
  panelMedium: SpriteRegion;
  panelSmall: SpriteRegion;
  menuPanel: SpriteRegion;

  // Buttons
  buttonPrimary: SpriteRegion;
  buttonPrimaryHover: SpriteRegion;
  buttonSecondary: SpriteRegion;
  buttonSmall: SpriteRegion;

  // Bars
  hpBarBg: SpriteRegion;
  hpBarFill: SpriteRegion;
  xpBarBg: SpriteRegion;
  xpBarFill: SpriteRegion;

  // Other elements
  inventorySlot: SpriteRegion;
  inventorySlotSelected: SpriteRegion;
  heart: SpriteRegion;
  heartEmpty: SpriteRegion;

  // Preview region for settings panel
  preview: SpriteRegion;
}

export interface ThemeColors {
  // Core colors
  primary: string;
  secondary: string;
  accent: string;

  // Backgrounds
  background: string;
  surface: string;
  surfaceAlt: string;

  // Borders & shadows
  border: string;
  shadow: string;

  // Text
  text: string;
  textMuted: string;
  textOnPrimary: string;

  // Special
  gold: string;
  hp: string;
  hpBg: string;
  xp: string;
  xpBg: string;
}

export interface StudyQuestTheme {
  id: StudyQuestThemeId;
  name: string;
  spriteSheet: string | null; // null for default CSS-only theme
  sprites: ThemeSpriteMap | null;
  colors: ThemeColors;
  sliceInset: number; // Corner size for 9-slice panels
}

// ============================================================================
// Default Theme (CSS-only, no sprites)
// ============================================================================

const DEFAULT_THEME: StudyQuestTheme = {
  id: 'default',
  name: 'Default',
  spriteSheet: null,
  sprites: null,
  sliceInset: 0,
  colors: {
    primary: '#4a90d9',
    secondary: '#2a5a9a',
    accent: '#ffd700',
    background: '#1a1a2e',
    surface: '#2a2a4e',
    surfaceAlt: '#3a3a5e',
    border: '#4a4a6a',
    shadow: '#0a0a1e',
    text: '#ffffff',
    textMuted: '#8a8aaa',
    textOnPrimary: '#ffffff',
    gold: '#ffd700',
    hp: '#ff4444',
    hpBg: '#441111',
    xp: '#44ff44',
    xpBg: '#114411',
  },
};

// ============================================================================
// Sprite-Based Themes
// ============================================================================

const BLACKWHITE_THEME: StudyQuestTheme = {
  id: 'blackwhite',
  name: 'Mono',
  spriteSheet: '../../assets/New Assets/BlackandWhiteUI.png',
  sliceInset: 8,
  colors: {
    primary: '#4a4a4a',
    secondary: '#333333',
    accent: '#ffffff',
    background: '#1a1a1a',
    surface: '#2a2a2a',
    surfaceAlt: '#3a3a3a',
    border: '#555555',
    shadow: '#000000',
    text: '#ffffff',
    textMuted: '#888888',
    textOnPrimary: '#ffffff',
    gold: '#cccccc',
    hp: '#ff6666',
    hpBg: '#332222',
    xp: '#66ff66',
    xpBg: '#223322',
  },
  sprites: {
    // Empty panels (no baked text) - right side of sprite sheet
    panelLarge: { x: 360, y: 90, width: 96, height: 96 },
    panelMedium: { x: 360, y: 186, width: 64, height: 80 },
    panelSmall: { x: 424, y: 90, width: 64, height: 64 },
    menuPanel: { x: 360, y: 90, width: 96, height: 96 },
    // Buttons - NOT used (have baked text), keeping for interface compatibility
    buttonPrimary: { x: 0, y: 0, width: 1, height: 1 },
    buttonPrimaryHover: { x: 0, y: 0, width: 1, height: 1 },
    buttonSecondary: { x: 0, y: 0, width: 1, height: 1 },
    buttonSmall: { x: 0, y: 0, width: 1, height: 1 },
    // HP/XP bars
    hpBarBg: { x: 0, y: 0, width: 128, height: 13 },
    hpBarFill: { x: 0, y: 0, width: 128, height: 13 },
    xpBarBg: { x: 0, y: 13, width: 128, height: 13 },
    xpBarFill: { x: 0, y: 13, width: 128, height: 13 },
    // Inventory and hearts
    inventorySlot: { x: 424, y: 186, width: 18, height: 18 },
    inventorySlotSelected: { x: 442, y: 186, width: 18, height: 18 },
    heart: { x: 473, y: 0, width: 13, height: 12 },
    heartEmpty: { x: 489, y: 0, width: 13, height: 12 },
    preview: { x: 360, y: 90, width: 96, height: 96 },
  },
};

const ELEGANT_THEME: StudyQuestTheme = {
  id: 'elegant',
  name: 'Elegant',
  spriteSheet: '../../assets/New Assets/UiElegant.png',
  sliceInset: 8,
  colors: {
    primary: '#5a6a7a',
    secondary: '#3a4a5a',
    accent: '#c9a227',
    background: '#1a1a2a',
    surface: '#2a2a3e',
    surfaceAlt: '#3a3a4e',
    border: '#6a7a5a',
    shadow: '#0a0a1a',
    text: '#ffffff',
    textMuted: '#8a9aaa',
    textOnPrimary: '#ffffff',
    gold: '#c9a227',
    hp: '#ff5555',
    hpBg: '#331515',
    xp: '#55ff55',
    xpBg: '#153315',
  },
  sprites: {
    // Empty panels (no baked text) - right side of sprite sheet
    panelLarge: { x: 360, y: 90, width: 96, height: 96 },
    panelMedium: { x: 360, y: 186, width: 64, height: 80 },
    panelSmall: { x: 424, y: 90, width: 64, height: 64 },
    menuPanel: { x: 360, y: 90, width: 96, height: 96 },
    // Buttons - NOT used (have baked text)
    buttonPrimary: { x: 0, y: 0, width: 1, height: 1 },
    buttonPrimaryHover: { x: 0, y: 0, width: 1, height: 1 },
    buttonSecondary: { x: 0, y: 0, width: 1, height: 1 },
    buttonSmall: { x: 0, y: 0, width: 1, height: 1 },
    // HP/XP bars
    hpBarBg: { x: 0, y: 0, width: 128, height: 13 },
    hpBarFill: { x: 0, y: 0, width: 128, height: 13 },
    xpBarBg: { x: 0, y: 13, width: 128, height: 13 },
    xpBarFill: { x: 0, y: 13, width: 128, height: 13 },
    // Inventory and hearts
    inventorySlot: { x: 424, y: 186, width: 18, height: 18 },
    inventorySlotSelected: { x: 442, y: 186, width: 18, height: 18 },
    heart: { x: 473, y: 0, width: 13, height: 12 },
    heartEmpty: { x: 489, y: 0, width: 13, height: 12 },
    preview: { x: 360, y: 90, width: 96, height: 96 },
  },
};

const HORROR_THEME: StudyQuestTheme = {
  id: 'horror',
  name: 'Horror',
  spriteSheet: '../../assets/New Assets/UiHorror.png',
  sliceInset: 8,
  colors: {
    primary: '#8b2020',
    secondary: '#5a1515',
    accent: '#cc3333',
    background: '#0a0808',
    surface: '#1a1212',
    surfaceAlt: '#2a1a1a',
    border: '#4a2020',
    shadow: '#000000',
    text: '#ddcccc',
    textMuted: '#887777',
    textOnPrimary: '#ffffff',
    gold: '#aa8833',
    hp: '#cc0000',
    hpBg: '#220000',
    xp: '#33aa33',
    xpBg: '#002200',
  },
  sprites: {
    // Empty dark panels - right side folder-style panels
    panelLarge: { x: 904, y: 0, width: 80, height: 80 },
    panelMedium: { x: 904, y: 80, width: 64, height: 64 },
    panelSmall: { x: 968, y: 80, width: 48, height: 48 },
    menuPanel: { x: 904, y: 0, width: 80, height: 80 },
    // Buttons - NOT used (have baked text)
    buttonPrimary: { x: 0, y: 0, width: 1, height: 1 },
    buttonPrimaryHover: { x: 0, y: 0, width: 1, height: 1 },
    buttonSecondary: { x: 0, y: 0, width: 1, height: 1 },
    buttonSmall: { x: 0, y: 0, width: 1, height: 1 },
    // HP/XP bars - red bars at top
    hpBarBg: { x: 0, y: 0, width: 128, height: 16 },
    hpBarFill: { x: 0, y: 16, width: 128, height: 16 },
    xpBarBg: { x: 0, y: 32, width: 128, height: 16 },
    xpBarFill: { x: 0, y: 48, width: 128, height: 16 },
    // Inventory grids - dark red on right
    inventorySlot: { x: 904, y: 160, width: 18, height: 18 },
    inventorySlotSelected: { x: 922, y: 160, width: 18, height: 18 },
    // Hearts - red hearts on right side
    heart: { x: 872, y: 288, width: 13, height: 12 },
    heartEmpty: { x: 888, y: 288, width: 13, height: 12 },
    preview: { x: 904, y: 0, width: 80, height: 80 },
  },
};

const MEDIEVAL_THEME: StudyQuestTheme = {
  id: 'medieval',
  name: 'Medieval',
  spriteSheet: '../../assets/New Assets/MediavelUI/Mediavel.png',
  sliceInset: 12,
  colors: {
    primary: '#8b5a2b',
    secondary: '#6b4423',
    accent: '#daa520',
    background: '#2d1f10',
    surface: '#4a3525',
    surfaceAlt: '#5a4535',
    border: '#785028',
    shadow: '#1a0f05',
    text: '#f5deb3',
    textMuted: '#a89070',
    textOnPrimary: '#ffffff',
    gold: '#daa520',
    hp: '#cc3333',
    hpBg: '#331111',
    xp: '#33cc33',
    xpBg: '#113311',
  },
  sprites: {
    // Empty wooden panels (no text) - beautiful wood frames
    panelLarge: { x: 432, y: 176, width: 128, height: 112 },
    panelMedium: { x: 576, y: 176, width: 80, height: 80 },
    panelSmall: { x: 576, y: 256, width: 48, height: 48 },
    menuPanel: { x: 432, y: 176, width: 128, height: 112 },
    // Buttons - NOT used (have baked text)
    buttonPrimary: { x: 0, y: 0, width: 1, height: 1 },
    buttonPrimaryHover: { x: 0, y: 0, width: 1, height: 1 },
    buttonSecondary: { x: 0, y: 0, width: 1, height: 1 },
    buttonSmall: { x: 0, y: 0, width: 1, height: 1 },
    // HP/XP bars - wooden style
    hpBarBg: { x: 0, y: 0, width: 128, height: 13 },
    hpBarFill: { x: 0, y: 0, width: 128, height: 13 },
    xpBarBg: { x: 0, y: 13, width: 128, height: 13 },
    xpBarFill: { x: 0, y: 13, width: 128, height: 13 },
    // Inventory - brown wooden grid
    inventorySlot: { x: 176, y: 304, width: 18, height: 18 },
    inventorySlotSelected: { x: 194, y: 304, width: 18, height: 18 },
    // Hearts
    heart: { x: 656, y: 0, width: 13, height: 12 },
    heartEmpty: { x: 672, y: 0, width: 13, height: 12 },
    preview: { x: 432, y: 176, width: 128, height: 112 },
  },
};

const MAGIC_THEME: StudyQuestTheme = {
  id: 'magic',
  name: 'Magic',
  spriteSheet: '../../assets/New Assets/MagicUiPaid/UImAGIC.png',
  sliceInset: 16,
  colors: {
    primary: '#7b4b9e',
    secondary: '#5a3578',
    accent: '#e6b422',
    background: '#1a1528',
    surface: '#2a2540',
    surfaceAlt: '#3a3550',
    border: '#6a5090',
    shadow: '#0a0815',
    text: '#e8e0f0',
    textMuted: '#9080a8',
    textOnPrimary: '#ffffff',
    gold: '#e6b422',
    hp: '#dd4444',
    hpBg: '#331515',
    xp: '#44dd44',
    xpBg: '#153315',
  },
  sprites: {
    // Empty purple panels (no text) - ornate frames below wizard portraits
    panelLarge: { x: 0, y: 256, width: 96, height: 80 },
    panelMedium: { x: 0, y: 336, width: 160, height: 48 },
    panelSmall: { x: 96, y: 256, width: 64, height: 48 },
    menuPanel: { x: 0, y: 256, width: 96, height: 80 },
    // Buttons - NOT used (have baked text)
    buttonPrimary: { x: 0, y: 0, width: 1, height: 1 },
    buttonPrimaryHover: { x: 0, y: 0, width: 1, height: 1 },
    buttonSecondary: { x: 0, y: 0, width: 1, height: 1 },
    buttonSmall: { x: 0, y: 0, width: 1, height: 1 },
    // HP/XP bars - purple bars
    hpBarBg: { x: 272, y: 24, width: 96, height: 13 },
    hpBarFill: { x: 272, y: 24, width: 96, height: 13 },
    xpBarBg: { x: 272, y: 37, width: 96, height: 13 },
    xpBarFill: { x: 272, y: 37, width: 96, height: 13 },
    // Inventory - purple grids on right
    inventorySlot: { x: 576, y: 192, width: 18, height: 18 },
    inventorySlotSelected: { x: 594, y: 192, width: 18, height: 18 },
    // Hearts - various colors in middle
    heart: { x: 528, y: 288, width: 13, height: 12 },
    heartEmpty: { x: 544, y: 288, width: 13, height: 12 },
    preview: { x: 0, y: 256, width: 96, height: 80 },
  },
};

const FAIRYTALE_THEME: StudyQuestTheme = {
  id: 'fairytale',
  name: 'Fairytale',
  spriteSheet: '../../assets/New Assets/FairytaleUIPaid/FairytaleUI.png',
  sliceInset: 8,
  colors: {
    primary: '#4a8b4a',
    secondary: '#3a6b3a',
    accent: '#daa520',
    background: '#1a2a1a',
    surface: '#2a3a2a',
    surfaceAlt: '#3a4a3a',
    border: '#5a7a5a',
    shadow: '#0a150a',
    text: '#f0fff0',
    textMuted: '#80a080',
    textOnPrimary: '#ffffff',
    gold: '#daa520',
    hp: '#dd4444',
    hpBg: '#331515',
    xp: '#44dd44',
    xpBg: '#153315',
  },
  sprites: {
    // Empty green panels (no text) - forest frames at bottom
    panelLarge: { x: 0, y: 320, width: 128, height: 96 },
    panelMedium: { x: 0, y: 416, width: 80, height: 80 },
    panelSmall: { x: 80, y: 416, width: 48, height: 48 },
    menuPanel: { x: 0, y: 320, width: 128, height: 96 },
    // Buttons - NOT used (have baked text)
    buttonPrimary: { x: 0, y: 0, width: 1, height: 1 },
    buttonPrimaryHover: { x: 0, y: 0, width: 1, height: 1 },
    buttonSecondary: { x: 0, y: 0, width: 1, height: 1 },
    buttonSmall: { x: 0, y: 0, width: 1, height: 1 },
    // HP/XP bars - green bars at top
    hpBarBg: { x: 272, y: 0, width: 96, height: 13 },
    hpBarFill: { x: 272, y: 16, width: 96, height: 13 },
    xpBarBg: { x: 272, y: 32, width: 96, height: 13 },
    xpBarFill: { x: 272, y: 48, width: 96, height: 13 },
    // Inventory - green/brown grids on right
    inventorySlot: { x: 416, y: 160, width: 18, height: 18 },
    inventorySlotSelected: { x: 434, y: 160, width: 18, height: 18 },
    // Hearts
    heart: { x: 416, y: 288, width: 13, height: 12 },
    heartEmpty: { x: 432, y: 288, width: 13, height: 12 },
    preview: { x: 0, y: 320, width: 128, height: 96 },
  },
};

const PASTEL_THEME: StudyQuestTheme = {
  id: 'pastel',
  name: 'Pastel',
  spriteSheet: '../../assets/New Assets/FairytaleUIPaid/GIFT/PastelUi.png',
  sliceInset: 8,
  colors: {
    primary: '#a8c0d8',
    secondary: '#8aa8c0',
    accent: '#f0b0c0',
    background: '#e8e0f0',
    surface: '#f5f0fa',
    surfaceAlt: '#ffffff',
    border: '#c8b8d8',
    shadow: '#d0c8e0',
    text: '#4a4060',
    textMuted: '#7a7090',
    textOnPrimary: '#4a4060',
    gold: '#d4a840',
    hp: '#e07070',
    hpBg: '#f8e0e0',
    xp: '#70c070',
    xpBg: '#e0f8e0',
  },
  sprites: {
    // Empty pastel panels (no text) - soft colored frames at bottom left
    panelLarge: { x: 160, y: 384, width: 128, height: 96 },
    panelMedium: { x: 0, y: 464, width: 96, height: 80 },
    panelSmall: { x: 96, y: 464, width: 64, height: 64 },
    menuPanel: { x: 160, y: 384, width: 128, height: 96 },
    // Buttons - NOT used (have baked text)
    buttonPrimary: { x: 0, y: 0, width: 1, height: 1 },
    buttonPrimaryHover: { x: 0, y: 0, width: 1, height: 1 },
    buttonSecondary: { x: 0, y: 0, width: 1, height: 1 },
    buttonSmall: { x: 0, y: 0, width: 1, height: 1 },
    // HP/XP bars - pastel bars at top
    hpBarBg: { x: 0, y: 0, width: 96, height: 13 },
    hpBarFill: { x: 0, y: 16, width: 96, height: 13 },
    xpBarBg: { x: 0, y: 32, width: 96, height: 13 },
    xpBarFill: { x: 0, y: 48, width: 96, height: 13 },
    // Inventory - pastel colored grids on right
    inventorySlot: { x: 544, y: 160, width: 18, height: 18 },
    inventorySlotSelected: { x: 562, y: 160, width: 18, height: 18 },
    // Hearts - pastel hearts at bottom
    heart: { x: 400, y: 560, width: 13, height: 12 },
    heartEmpty: { x: 416, y: 560, width: 13, height: 12 },
    preview: { x: 160, y: 384, width: 128, height: 96 },
  },
};

const CAT_THEME: StudyQuestTheme = {
  id: 'cat',
  name: 'Cat',
  spriteSheet: '../../assets/New Assets/CatUIPaid/catUI.png',
  sliceInset: 16,
  colors: {
    primary: '#d4a574',
    secondary: '#b88a5c',
    accent: '#ff9090',
    background: '#f5e8d8',
    surface: '#fff5e8',
    surfaceAlt: '#ffffff',
    border: '#c8a888',
    shadow: '#e8d8c8',
    text: '#5a4a3a',
    textMuted: '#8a7a6a',
    textOnPrimary: '#5a4a3a',
    gold: '#d4a040',
    hp: '#e06060',
    hpBg: '#f8e0e0',
    xp: '#60c060',
    xpBg: '#e0f8e0',
  },
  sprites: {
    // Adorable cat-ear panels (no text) - various colors
    panelLarge: { x: 0, y: 480, width: 96, height: 80 },
    panelMedium: { x: 256, y: 304, width: 80, height: 96 }, // Beige cat ears!
    panelSmall: { x: 96, y: 480, width: 64, height: 64 },
    menuPanel: { x: 336, y: 304, width: 80, height: 96 }, // Pink cat ears!
    // Buttons - NOT used (have baked text)
    buttonPrimary: { x: 0, y: 0, width: 1, height: 1 },
    buttonPrimaryHover: { x: 0, y: 0, width: 1, height: 1 },
    buttonSecondary: { x: 0, y: 0, width: 1, height: 1 },
    buttonSmall: { x: 0, y: 0, width: 1, height: 1 },
    // HP/XP bars - cat-themed bars
    hpBarBg: { x: 0, y: 0, width: 96, height: 13 },
    hpBarFill: { x: 0, y: 16, width: 96, height: 13 },
    xpBarBg: { x: 0, y: 32, width: 96, height: 13 },
    xpBarFill: { x: 0, y: 48, width: 96, height: 13 },
    // Inventory slots
    inventorySlot: { x: 0, y: 560, width: 18, height: 18 },
    inventorySlotSelected: { x: 18, y: 560, width: 18, height: 18 },
    // Paw prints and cat faces as "hearts"
    heart: { x: 384, y: 0, width: 13, height: 13 },
    heartEmpty: { x: 400, y: 0, width: 13, height: 13 },
    preview: { x: 256, y: 304, width: 80, height: 96 },
  },
};

// ============================================================================
// Theme Registry
// ============================================================================

export const STUDYQUEST_THEMES: Record<StudyQuestThemeId, StudyQuestTheme> = {
  default: DEFAULT_THEME,
  blackwhite: BLACKWHITE_THEME,
  elegant: ELEGANT_THEME,
  horror: HORROR_THEME,
  medieval: MEDIEVAL_THEME,
  magic: MAGIC_THEME,
  fairytale: FAIRYTALE_THEME,
  pastel: PASTEL_THEME,
  cat: CAT_THEME,
};

export const THEME_LIST: StudyQuestTheme[] = Object.values(STUDYQUEST_THEMES);

/**
 * Get theme by ID
 */
export function getTheme(id: StudyQuestThemeId): StudyQuestTheme {
  return STUDYQUEST_THEMES[id] || DEFAULT_THEME;
}

/**
 * Get all available theme IDs
 */
export function getThemeIds(): StudyQuestThemeId[] {
  return Object.keys(STUDYQUEST_THEMES) as StudyQuestThemeId[];
}
