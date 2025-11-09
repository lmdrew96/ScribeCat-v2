/**
 * Light Theme Presets
 *
 * 20 light mode themes using color theory to evoke positive emotions.
 * Organized into 5 categories: Calm, Energetic, Focus, Creative, and Balanced.
 */

import { Theme } from './types.js';

export const lightThemes: Theme[] = [
  // ===== CALM & PEACEFUL - LIGHT (4 themes) =====
  {
    id: 'ocean-serenity-light',
    name: 'Ocean Serenity (Light)',
    category: 'calm',
    variant: 'light',
    description: 'Deep blues evoke tranquility and trust, with warm coral accents',
    colors: {
      bgPrimary: '#f5f9fb',
      bgSecondary: '#e8f2f6',
      bgTertiary: '#d8e8f0',
      accent: '#ff6644',
      accentHover: '#ff5533',
      textPrimary: '#1a2332',
      textSecondary: '#2e4557',
      textTertiary: '#4a6577',
      recordColor: '#ff7755',
      recordHover: '#ff6644',
      success: '#5ba48b',
      border: '#c8d8e0',
      shadow: 'rgba(26, 35, 50, 0.1)'
    }
  },
  {
    id: 'forest-meditation-light',
    name: 'Forest Meditation (Light)',
    category: 'calm',
    variant: 'light',
    description: 'Grounding greens bring natural peace with soft lavender accents',
    colors: {
      bgPrimary: '#f5fbf5',
      bgSecondary: '#e8f6e8',
      bgTertiary: '#d8f0d8',
      accent: '#9377c8',
      accentHover: '#8366b8',
      textPrimary: '#1a2e1a',
      textSecondary: '#2e4d2e',
      textTertiary: '#4a6d4a',
      recordColor: '#a388d8',
      recordHover: '#9377c8',
      success: '#6ba86b',
      border: '#c8e0c8',
      shadow: 'rgba(26, 46, 26, 0.1)'
    }
  },
  {
    id: 'lavender-dreams-light',
    name: 'Lavender Dreams (Light)',
    category: 'calm',
    variant: 'light',
    description: 'Soft purples inspire calm creativity and spiritual peace',
    colors: {
      bgPrimary: '#faf8fc',
      bgSecondary: '#f0e8f8',
      bgTertiary: '#e8d8f0',
      accent: '#7b6f98',
      accentHover: '#6b5f88',
      textPrimary: '#2a2438',
      textSecondary: '#4a4458',
      textTertiary: '#6a6478',
      recordColor: '#8b7fa8',
      recordHover: '#7b6f98',
      success: '#8b7fa8',
      border: '#d8c8e8',
      shadow: 'rgba(42, 36, 56, 0.1)'
    }
  },
  {
    id: 'moonlight-zen-light',
    name: 'Moonlight Zen (Light)',
    category: 'calm',
    variant: 'light',
    description: 'Cool silvers and blues with warm golden accents',
    colors: {
      bgPrimary: '#f8f9fb',
      bgSecondary: '#eef2f6',
      bgTertiary: '#e0e8f0',
      accent: '#d89a37',
      accentHover: '#c88a27',
      textPrimary: '#1e2228',
      textSecondary: '#363e48',
      textTertiary: '#5a6270',
      recordColor: '#e0a847',
      recordHover: '#d89a37',
      success: '#6a8fa8',
      border: '#c8d0d8',
      shadow: 'rgba(30, 34, 40, 0.1)'
    }
  },

  // ===== ENERGETIC & MOTIVATED - LIGHT (4 themes) =====
  {
    id: 'sunrise-energy-light',
    name: 'Sunrise Energy (Light)',
    category: 'energetic',
    variant: 'light',
    description: 'Warm oranges and golds radiate enthusiasm and optimism',
    colors: {
      bgPrimary: '#fffaf5',
      bgSecondary: '#fff0e8',
      bgTertiary: '#ffe8d8',
      accent: '#c2590e',
      accentHover: '#b24900',
      textPrimary: '#2e1a1a',
      textSecondary: '#4d2e2e',
      textTertiary: '#6d4a4a',
      recordColor: '#d2691e',
      recordHover: '#c2590e',
      success: '#d8893e',
      border: '#f0d8c8',
      shadow: 'rgba(46, 26, 26, 0.1)'
    }
  },
  {
    id: 'ruby-passion-light',
    name: 'Ruby Passion (Light)',
    category: 'energetic',
    variant: 'light',
    description: 'Bold reds ignite determination with cool teal balance',
    colors: {
      bgPrimary: '#fff5f7',
      bgSecondary: '#ffe8ec',
      bgTertiary: '#ffd8e0',
      accent: '#3eada4',
      accentHover: '#2e9d94',
      textPrimary: '#2e1a1e',
      textSecondary: '#4d2e32',
      textTertiary: '#6d4a4e',
      recordColor: '#4ebdb4',
      recordHover: '#3eada4',
      success: '#e8445a',
      border: '#f0c8d0',
      shadow: 'rgba(46, 26, 30, 0.1)'
    }
  },
  {
    id: 'citrus-burst-light',
    name: 'Citrus Burst (Light)',
    category: 'energetic',
    variant: 'light',
    description: 'Vibrant yellows and oranges spark joy and creativity',
    colors: {
      bgPrimary: '#fffdf5',
      bgSecondary: '#fffae8',
      bgTertiary: '#fff0d8',
      accent: '#ef9500',
      accentHover: '#df8500',
      textPrimary: '#2e2a1a',
      textSecondary: '#4d442e',
      textTertiary: '#6d6444',
      recordColor: '#ffa500',
      recordHover: '#ef9500',
      success: '#ffb84d',
      border: '#f0e8c8',
      shadow: 'rgba(46, 42, 26, 0.1)'
    }
  },
  {
    id: 'tropical-fire-light',
    name: 'Tropical Fire (Light)',
    category: 'energetic',
    variant: 'light',
    description: 'Hot pinks and magentas energize with playful vibrancy',
    colors: {
      bgPrimary: '#fff5fb',
      bgSecondary: '#ffe8f8',
      bgTertiary: '#ffd8f0',
      accent: '#ef0483',
      accentHover: '#df0073',
      textPrimary: '#2e1a2a',
      textSecondary: '#4d2e44',
      textTertiary: '#6d4a64',
      recordColor: '#ff1493',
      recordHover: '#ef0483',
      success: '#ff69b4',
      border: '#f0c8e8',
      shadow: 'rgba(46, 26, 42, 0.1)'
    }
  },

  // ===== FOCUS & PRODUCTIVITY - LIGHT (4 themes) =====
  {
    id: 'midnight-focus-light',
    name: 'Midnight Focus (Light)',
    category: 'focus',
    variant: 'light',
    description: 'Deep navy promotes intense concentration with warm amber highlights',
    colors: {
      bgPrimary: '#f5f8fb',
      bgSecondary: '#e8f0f8',
      bgTertiary: '#d8e8f0',
      accent: '#e08722',
      accentHover: '#d07712',
      textPrimary: '#0f1419',
      textSecondary: '#252d38',
      textTertiary: '#3a4858',
      recordColor: '#f59732',
      recordHover: '#e08722',
      success: '#4a8fb8',
      border: '#c8d8e8',
      shadow: 'rgba(15, 20, 25, 0.12)'
    }
  },
  {
    id: 'slate-professional-light',
    name: 'Slate Professional (Light)',
    category: 'focus',
    variant: 'light',
    description: 'Neutral grays provide balanced, clear-minded focus',
    colors: {
      bgPrimary: '#f8f9fb',
      bgSecondary: '#eef2f6',
      bgTertiary: '#e0e8f0',
      accent: '#607080',
      accentHover: '#506070',
      textPrimary: '#1e2228',
      textSecondary: '#363e48',
      textTertiary: '#5a6270',
      recordColor: '#708090',
      recordHover: '#607080',
      success: '#6a8fa8',
      border: '#c8d0d8',
      shadow: 'rgba(30, 34, 40, 0.1)'
    }
  },
  {
    id: 'deep-space-light',
    name: 'Deep Space (Light)',
    category: 'focus',
    variant: 'light',
    description: 'Dark purples and blues for mysterious, deep concentration',
    colors: {
      bgPrimary: '#f8f8ff',
      bgSecondary: '#e8e8f8',
      bgTertiary: '#d8d8f0',
      accent: '#5a4abd',
      accentHover: '#4a3aad',
      textPrimary: '#0a0a14',
      textSecondary: '#1e1e2e',
      textTertiary: '#3a3a50',
      recordColor: '#6a5acd',
      recordHover: '#5a4abd',
      success: '#6a7add',
      border: '#c8c8e8',
      shadow: 'rgba(10, 10, 20, 0.15)'
    }
  },
  {
    id: 'arctic-clarity-light',
    name: 'Arctic Clarity (Light)',
    category: 'focus',
    variant: 'light',
    description: 'Crisp teals and ice blues for refreshing mental clarity',
    colors: {
      bgPrimary: '#f5fbfb',
      bgSecondary: '#e8f8f8',
      bgTertiary: '#d8f0f0',
      accent: '#4f8e90',
      accentHover: '#3f7e80',
      textPrimary: '#1a2e2e',
      textSecondary: '#2e4d4d',
      textTertiary: '#4a6d6d',
      recordColor: '#5f9ea0',
      recordHover: '#4f8e90',
      success: '#6aaeb0',
      border: '#c8e8e8',
      shadow: 'rgba(26, 46, 46, 0.1)'
    }
  },

  // ===== CREATIVE & INSPIRED - LIGHT (4 themes) =====
  {
    id: 'sunset-canvas-light',
    name: 'Sunset Canvas (Light)',
    category: 'creative',
    variant: 'light',
    description: 'Purple and orange blend for artistic imagination',
    colors: {
      bgPrimary: '#fffaf5',
      bgSecondary: '#fff0e8',
      bgTertiary: '#ffe8d8',
      accent: '#ef7c32',
      accentHover: '#df6c22',
      textPrimary: '#2a1e2e',
      textSecondary: '#4a3248',
      textTertiary: '#6a4a68',
      recordColor: '#ff8c42',
      recordHover: '#ef7c32',
      success: '#a87fc8',
      border: '#f0d0c8',
      shadow: 'rgba(42, 30, 46, 0.1)'
    }
  },
  {
    id: 'rainbow-joy-light',
    name: 'Rainbow Joy (Light)',
    category: 'creative',
    variant: 'light',
    description: 'Full spectrum rainbow colors bring vibrant joy and creativity',
    colors: {
      bgPrimary: '#fafbff',
      bgSecondary: '#f0f2ff',
      bgTertiary: '#e8eaff',
      accent: '#ff4b7d',
      accentHover: '#ff3b6d',
      textPrimary: '#1e1e2e',
      textSecondary: '#363648',
      textTertiary: '#5a5a70',
      recordColor: '#ff8800',
      recordHover: '#ff7700',
      success: '#00dd77',
      border: '#8b6bff',
      shadow: 'rgba(139, 107, 255, 0.2)'
    }
  },
  {
    id: 'neon-dreams-light',
    name: 'Neon Dreams (Light)',
    category: 'creative',
    variant: 'light',
    description: 'Electric neons on dark for bold, modern creativity',
    colors: {
      bgPrimary: '#fafbff',
      bgSecondary: '#f0f5ff',
      bgTertiary: '#e8f0ff',
      accent: '#00cfcf',
      accentHover: '#00bfbf',
      textPrimary: '#0a0a0f',
      textSecondary: '#1e1e28',
      textTertiary: '#3a3a48',
      recordColor: '#cf00cf',
      recordHover: '#bf00bf',
      success: '#00cf78',
      border: '#d0e0ff',
      shadow: 'rgba(0, 207, 207, 0.15)'
    }
  },
  {
    id: 'autumn-inspiration-light',
    name: 'Autumn Inspiration (Light)',
    category: 'creative',
    variant: 'light',
    description: 'Warm autumn tones inspire cozy creativity',
    colors: {
      bgPrimary: '#fffaf5',
      bgSecondary: '#fff4e8',
      bgTertiary: '#ffe8d8',
      accent: '#c2590e',
      accentHover: '#b24900',
      textPrimary: '#2a1e1a',
      textSecondary: '#4a322e',
      textTertiary: '#6a4a44',
      recordColor: '#d2691e',
      recordHover: '#c2590e',
      success: '#ca9520',
      border: '#f0d8c8',
      shadow: 'rgba(42, 30, 26, 0.1)'
    }
  },

  // ===== BALANCED & HARMONIOUS - LIGHT (4 themes) =====
  {
    id: 'earth-tones-light',
    name: 'Earth Tones (Light)',
    category: 'balanced',
    variant: 'light',
    description: 'Natural browns provide stable harmony with turquoise energy',
    colors: {
      bgPrimary: '#faf8f5',
      bgSecondary: '#f0ece8',
      bgTertiary: '#e8e0d8',
      accent: '#3ba09e',
      accentHover: '#2b908e',
      textPrimary: '#2a2420',
      textSecondary: '#4a3c30',
      textTertiary: '#6a5a50',
      recordColor: '#4bb0ae',
      recordHover: '#3ba09e',
      success: '#8b7f6a',
      border: '#d8d0c8',
      shadow: 'rgba(42, 36, 32, 0.1)'
    }
  },
  {
    id: 'sakura-blossom-light',
    name: 'Sakura Blossom (Light)',
    category: 'balanced',
    variant: 'light',
    description: 'Elegant pink and gray for gentle sophistication',
    colors: {
      bgPrimary: '#fffafc',
      bgSecondary: '#fff0f4',
      bgTertiary: '#ffe8f0',
      accent: '#c890a0',
      accentHover: '#b88090',
      textPrimary: '#2a2428',
      textSecondary: '#4a383c',
      textTertiary: '#6a5558',
      recordColor: '#d8a0b0',
      recordHover: '#c890a0',
      success: '#b890a8',
      border: '#f0d0d8',
      shadow: 'rgba(42, 36, 40, 0.1)'
    }
  },
  {
    id: 'jade-garden-light',
    name: 'Jade Garden (Light)',
    category: 'balanced',
    variant: 'light',
    description: 'Jade greens bring balanced prosperity and freshness',
    colors: {
      bgPrimary: '#f5fbf8',
      bgSecondary: '#e8f8f0',
      bgTertiary: '#d8f0e8',
      accent: '#6ca88d',
      accentHover: '#5c987d',
      textPrimary: '#1e2a24',
      textSecondary: '#324238',
      textTertiary: '#4a5a50',
      recordColor: '#7cb89d',
      recordHover: '#6ca88d',
      success: '#8cc8ad',
      border: '#c8e8d8',
      shadow: 'rgba(30, 42, 36, 0.1)'
    }
  },
  {
    id: 'twilight-balance-light',
    name: 'Twilight Balance (Light)',
    category: 'balanced',
    variant: 'light',
    description: 'Indigo and mauve for peaceful transition and balance',
    colors: {
      bgPrimary: '#faf8ff',
      bgSecondary: '#f0e8ff',
      bgTertiary: '#e8d8f8',
      accent: '#8b7fa8',
      accentHover: '#7b6f98',
      textPrimary: '#1e1e2a',
      textSecondary: '#363648',
      textTertiary: '#5a5a70',
      recordColor: '#9b8fb8',
      recordHover: '#8b7fa8',
      success: '#a89fc8',
      border: '#d8c8e8',
      shadow: 'rgba(30, 30, 42, 0.1)'
    }
  }
];
