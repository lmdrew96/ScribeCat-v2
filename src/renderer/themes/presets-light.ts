/**
 * Light Theme Presets - Redesigned with Color Psychology
 *
 * 16 intentionally distinct light themes organized by emotional impact.
 * Each theme uses color psychology principles for its intended effect.
 */

import { Theme } from './types.js';

export const lightThemes: Theme[] = [
  // ===== CALM & PEACEFUL (3 themes) =====
  // Psychology: Lower arousal, trust, tranquility. Cool temperatures, lower saturation.
  {
    id: 'deep-ocean-light',
    name: 'Deep Ocean',
    category: 'calm',
    variant: 'light',
    description: 'Airy sky blues evoke open calm and trustworthy clarity',
    colors: {
      bgPrimary: '#f0f9ff',
      bgSecondary: '#e0f2fe',
      bgTertiary: '#bae6fd',
      accent: '#0077b6',
      accentHover: '#006796',
      accentSecondary: '#0284c7',
      accentSecondaryHover: '#0274b7',
      textPrimary: '#0c4a6e',
      textSecondary: '#1e6b8f',
      textTertiary: '#3a87a8',
      recordColor: '#0087c6',
      recordHover: '#0077b6',
      success: '#0284c7',
      border: '#7dd3fc',
      shadow: 'rgba(12, 74, 110, 0.1)'
    }
  },
  {
    id: 'moss-garden-light',
    name: 'Moss Garden',
    category: 'calm',
    variant: 'light',
    description: 'Soft sage and cream for gentle, grounded energy',
    colors: {
      bgPrimary: '#f7fbf7',
      bgSecondary: '#ecf5ec',
      bgTertiary: '#d8ebd8',
      accent: '#2d5a3d',
      accentHover: '#1d4a2d',
      accentSecondary: '#8b6914',
      accentSecondaryHover: '#7b5904',
      textPrimary: '#1a3a24',
      textSecondary: '#2d5040',
      textTertiary: '#4a6858',
      recordColor: '#3d6a4d',
      recordHover: '#2d5a3d',
      success: '#2d5a3d',
      border: '#a8d4b0',
      shadow: 'rgba(26, 58, 36, 0.1)'
    }
  },
  {
    id: 'twilight-mist-light',
    name: 'Twilight Mist',
    category: 'calm',
    variant: 'light',
    description: 'Pale lavender clouds for dreamy contemplation',
    colors: {
      bgPrimary: '#faf8ff',
      bgSecondary: '#f3f0ff',
      bgTertiary: '#e9e3ff',
      accent: '#7c3aed',
      accentHover: '#6c2add',
      accentSecondary: '#4f46e5',
      accentSecondaryHover: '#3f36d5',
      textPrimary: '#3b2d60',
      textSecondary: '#5a4880',
      textTertiary: '#7a68a0',
      recordColor: '#8c4afd',
      recordHover: '#7c3aed',
      success: '#4f46e5',
      border: '#c4b5fd',
      shadow: 'rgba(124, 58, 237, 0.1)'
    }
  },

  // ===== ENERGETIC & MOTIVATED (3 themes) =====
  // Psychology: High arousal, motivation, action. Warm temperatures, high saturation.
  {
    id: 'solar-flare-light',
    name: 'Solar Flare',
    category: 'energetic',
    variant: 'light',
    description: 'Warm sunshine yellows radiate optimism and energy',
    colors: {
      bgPrimary: '#fffbeb',
      bgSecondary: '#fef3c7',
      bgTertiary: '#fde68a',
      accent: '#d97706',
      accentHover: '#b45309',
      accentSecondary: '#ea580c',
      accentSecondaryHover: '#c2410c',
      textPrimary: '#451a03',
      textSecondary: '#713f12',
      textTertiary: '#92400e',
      recordColor: '#e98716',
      recordHover: '#d97706',
      success: '#ea580c',
      border: '#fcd34d',
      shadow: 'rgba(217, 119, 6, 0.12)'
    }
  },
  {
    id: 'cherry-bomb-light',
    name: 'Cherry Bomb',
    category: 'energetic',
    variant: 'light',
    description: 'Vibrant coral and rose for passionate drive',
    colors: {
      bgPrimary: '#fff1f2',
      bgSecondary: '#ffe4e6',
      bgTertiary: '#fecdd3',
      accent: '#dc2626',
      accentHover: '#b91c1c',
      accentSecondary: '#ea580c',
      accentSecondaryHover: '#c2410c',
      textPrimary: '#450a0a',
      textSecondary: '#7f1d1d',
      textTertiary: '#991b1b',
      recordColor: '#ec3636',
      recordHover: '#dc2626',
      success: '#ea580c',
      border: '#fca5a5',
      shadow: 'rgba(220, 38, 38, 0.1)'
    }
  },
  {
    id: 'electric-lime-light',
    name: 'Electric Lime',
    category: 'energetic',
    variant: 'light',
    description: 'Fresh spring greens burst with youthful energy',
    colors: {
      bgPrimary: '#f7fee7',
      bgSecondary: '#ecfccb',
      bgTertiary: '#d9f99d',
      accent: '#65a30d',
      accentHover: '#4d7c0f',
      accentSecondary: '#0891b2',
      accentSecondaryHover: '#0e7490',
      textPrimary: '#1a2e05',
      textSecondary: '#365314',
      textTertiary: '#4d7c0f',
      recordColor: '#75b31d',
      recordHover: '#65a30d',
      success: '#0891b2',
      border: '#bef264',
      shadow: 'rgba(101, 163, 13, 0.1)'
    }
  },

  // ===== FOCUS & PRODUCTIVITY (3 themes) =====
  // Psychology: Minimal distraction, professional, sustained attention. Muted, strategic.
  {
    id: 'graphite-light',
    name: 'Graphite',
    category: 'focus',
    variant: 'light',
    description: 'Clean whites and soft grays for distraction-free focus',
    colors: {
      bgPrimary: '#fafafa',
      bgSecondary: '#f4f4f5',
      bgTertiary: '#e4e4e7',
      accent: '#52525b',
      accentHover: '#3f3f46',
      accentSecondary: '#2563eb',
      accentSecondaryHover: '#1d4ed8',
      textPrimary: '#18181b',
      textSecondary: '#3f3f46',
      textTertiary: '#71717a',
      recordColor: '#62626b',
      recordHover: '#52525b',
      success: '#2563eb',
      border: '#d4d4d8',
      shadow: 'rgba(24, 24, 27, 0.08)'
    }
  },
  {
    id: 'espresso-light',
    name: 'Espresso',
    category: 'focus',
    variant: 'light',
    description: 'Creamy latte tones create warm productive comfort',
    colors: {
      bgPrimary: '#fdfaf6',
      bgSecondary: '#faf5ed',
      bgTertiary: '#f5ebe0',
      accent: '#78350f',
      accentHover: '#5c2907',
      accentSecondary: '#92400e',
      accentSecondaryHover: '#7c3006',
      textPrimary: '#1c1410',
      textSecondary: '#44403c',
      textTertiary: '#78716c',
      recordColor: '#88451f',
      recordHover: '#78350f',
      success: '#92400e',
      border: '#d6d3d1',
      shadow: 'rgba(28, 20, 16, 0.08)'
    }
  },
  {
    id: 'ink-paper-light',
    name: 'Ink & Paper',
    category: 'focus',
    variant: 'light',
    description: 'Classic sepia paper tones for serious writing',
    colors: {
      bgPrimary: '#fffbeb',
      bgSecondary: '#fef9e7',
      bgTertiary: '#fef3c7',
      accent: '#1c1917',
      accentHover: '#0c0a09',
      accentSecondary: '#b45309',
      accentSecondaryHover: '#92400e',
      textPrimary: '#0c0a09',
      textSecondary: '#292524',
      textTertiary: '#57534e',
      recordColor: '#2c2927',
      recordHover: '#1c1917',
      success: '#b45309',
      border: '#e7e5e4',
      shadow: 'rgba(12, 10, 9, 0.08)'
    }
  },

  // ===== CREATIVE & INSPIRED (4 themes) =====
  // Psychology: Inspiration, imagination, playfulness. Unexpected combinations, artistic.
  {
    id: 'synthwave-light',
    name: 'Synthwave',
    category: 'creative',
    variant: 'light',
    description: 'Soft pink with electric accents for retro creativity',
    colors: {
      bgPrimary: '#fdf2f8',
      bgSecondary: '#fce7f3',
      bgTertiary: '#fbcfe8',
      accent: '#db2777',
      accentHover: '#be185d',
      accentSecondary: '#0891b2',
      accentSecondaryHover: '#0e7490',
      textPrimary: '#500724',
      textSecondary: '#831843',
      textTertiary: '#9d174d',
      recordColor: '#eb3787',
      recordHover: '#db2777',
      success: '#0891b2',
      border: '#f9a8d4',
      shadow: 'rgba(219, 39, 119, 0.1)'
    }
  },
  {
    id: 'aurora-light',
    name: 'Aurora',
    category: 'creative',
    variant: 'light',
    description: 'Mint fresh with mystical purple accents',
    colors: {
      bgPrimary: '#f0fdf4',
      bgSecondary: '#dcfce7',
      bgTertiary: '#bbf7d0',
      accent: '#16a34a',
      accentHover: '#15803d',
      accentSecondary: '#9333ea',
      accentSecondaryHover: '#7e22ce',
      textPrimary: '#052e16',
      textSecondary: '#166534',
      textTertiary: '#22863a',
      recordColor: '#26b35a',
      recordHover: '#16a34a',
      success: '#9333ea',
      border: '#86efac',
      shadow: 'rgba(22, 163, 74, 0.1)'
    }
  },
  {
    id: 'candy-pop-light',
    name: 'Candy Pop',
    category: 'creative',
    variant: 'light',
    description: 'Bubblegum pastels that spark joy and playfulness',
    colors: {
      bgPrimary: '#fef7ff',
      bgSecondary: '#fae8ff',
      bgTertiary: '#f5d0fe',
      accent: '#ec4899',
      accentHover: '#db2777',
      accentSecondary: '#8b5cf6',
      accentSecondaryHover: '#7c3aed',
      textPrimary: '#4a044e',
      textSecondary: '#701a75',
      textTertiary: '#86198f',
      recordColor: '#fc58a9',
      recordHover: '#ec4899',
      success: '#8b5cf6',
      border: '#e879f9',
      shadow: 'rgba(236, 72, 153, 0.1)'
    }
  },
  {
    id: 'sunset-gradient-light',
    name: 'Sunset Gradient',
    category: 'creative',
    variant: 'light',
    description: 'Peachy warmth with lavender dreams',
    colors: {
      bgPrimary: '#fff7ed',
      bgSecondary: '#ffedd5',
      bgTertiary: '#fed7aa',
      accent: '#ea580c',
      accentHover: '#c2410c',
      accentSecondary: '#a855f7',
      accentSecondaryHover: '#9333ea',
      textPrimary: '#431407',
      textSecondary: '#7c2d12',
      textTertiary: '#9a3412',
      recordColor: '#fa681c',
      recordHover: '#ea580c',
      success: '#a855f7',
      border: '#fdba74',
      shadow: 'rgba(234, 88, 12, 0.1)'
    }
  },

  // ===== BALANCED & HARMONIOUS (3 themes) =====
  // Psychology: Harmony, versatility, sophistication. Complementary pairs, earth tones.
  {
    id: 'terra-light',
    name: 'Terra',
    category: 'balanced',
    variant: 'light',
    description: 'Warm sand and olive for natural balance',
    colors: {
      bgPrimary: '#fefce8',
      bgSecondary: '#fef9c3',
      bgTertiary: '#fef08a',
      accent: '#a16207',
      accentHover: '#854d0e',
      accentSecondary: '#4d7c0f',
      accentSecondaryHover: '#3f6212',
      textPrimary: '#1c1917',
      textSecondary: '#44403c',
      textTertiary: '#78716c',
      recordColor: '#b17217',
      recordHover: '#a16207',
      success: '#4d7c0f',
      border: '#fde047',
      shadow: 'rgba(161, 98, 7, 0.1)'
    }
  },
  {
    id: 'coastal-light',
    name: 'Coastal',
    category: 'balanced',
    variant: 'light',
    description: 'Seafoam and driftwood for beach tranquility',
    colors: {
      bgPrimary: '#f0fdfa',
      bgSecondary: '#ccfbf1',
      bgTertiary: '#99f6e4',
      accent: '#0d9488',
      accentHover: '#0f766e',
      accentSecondary: '#d97706',
      accentSecondaryHover: '#b45309',
      textPrimary: '#042f2e',
      textSecondary: '#134e4a',
      textTertiary: '#115e59',
      recordColor: '#1da498',
      recordHover: '#0d9488',
      success: '#d97706',
      border: '#5eead4',
      shadow: 'rgba(13, 148, 136, 0.1)'
    }
  },
  {
    id: 'sakura-light',
    name: 'Sakura',
    category: 'balanced',
    variant: 'light',
    description: 'Soft blossom pink with fresh mint green',
    colors: {
      bgPrimary: '#fdf2f8',
      bgSecondary: '#fce7f3',
      bgTertiary: '#fbcfe8',
      accent: '#ec4899',
      accentHover: '#db2777',
      accentSecondary: '#10b981',
      accentSecondaryHover: '#059669',
      textPrimary: '#500724',
      textSecondary: '#831843',
      textTertiary: '#9d174d',
      recordColor: '#fc58a9',
      recordHover: '#ec4899',
      success: '#10b981',
      border: '#f9a8d4',
      shadow: 'rgba(236, 72, 153, 0.08)'
    }
  },

  // ===== SPECIAL THEMED (3 themes) =====
  {
    id: 'ghibli-spirit-light',
    name: 'Ghibli Spirit',
    category: 'special',
    variant: 'light',
    description: 'Warm golden sunshine with dreamy sky blue accents',
    colors: {
      bgPrimary: '#fefce8',
      bgSecondary: '#fef9c3',
      bgTertiary: '#fef08a',
      accent: '#b45309',
      accentHover: '#92400e',
      accentSecondary: '#0284c7',
      accentSecondaryHover: '#0369a1',
      textPrimary: '#1c1a0a',
      textSecondary: '#44400c',
      textTertiary: '#78700c',
      recordColor: '#c46319',
      recordHover: '#b45309',
      success: '#0284c7',
      border: '#fde047',
      shadow: 'rgba(180, 83, 9, 0.1)'
    }
  },
  {
    id: 'hyrule-light',
    name: 'Hyrule',
    category: 'special',
    variant: 'light',
    description: 'Bright Hyrule fields with Sheikah tech cyan',
    colors: {
      bgPrimary: '#ecfdf5',
      bgSecondary: '#d1fae5',
      bgTertiary: '#a7f3d0',
      accent: '#0891b2',
      accentHover: '#0e7490',
      accentSecondary: '#65a30d',
      accentSecondaryHover: '#4d7c0f',
      textPrimary: '#022c22',
      textSecondary: '#064e3b',
      textTertiary: '#065f46',
      recordColor: '#18a1c2',
      recordHover: '#0891b2',
      success: '#65a30d',
      border: '#6ee7b7',
      shadow: 'rgba(8, 145, 178, 0.1)'
    }
  },
  {
    id: 'void-walker-light',
    name: 'Void Walker',
    category: 'special',
    variant: 'light',
    description: 'Pale nebula clouds with cosmic purple and pink',
    colors: {
      bgPrimary: '#faf5ff',
      bgSecondary: '#f3e8ff',
      bgTertiary: '#e9d5ff',
      accent: '#7c3aed',
      accentHover: '#6d28d9',
      accentSecondary: '#db2777',
      accentSecondaryHover: '#be185d',
      textPrimary: '#2e1065',
      textSecondary: '#4c1d95',
      textTertiary: '#5b21b6',
      recordColor: '#8c4afd',
      recordHover: '#7c3aed',
      success: '#db2777',
      border: '#c4b5fd',
      shadow: 'rgba(124, 58, 237, 0.1)'
    }
  }
];
