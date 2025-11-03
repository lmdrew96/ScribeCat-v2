/**
 * Theme Presets
 * 
 * 20 carefully designed themes using color theory to evoke positive emotions.
 * Organized into 5 categories: Calm, Energetic, Focus, Creative, and Balanced.
 */

import { Theme } from './types.js';

export const themes: Theme[] = [
  // ===== CALM & PEACEFUL (4 themes) =====
  {
    id: 'ocean-serenity',
    name: 'Ocean Serenity',
    category: 'calm',
    variant: 'dark',
    description: 'Deep blues evoke tranquility and trust, with warm coral accents',
    colors: {
      bgPrimary: '#1a2332',
      bgSecondary: '#243447',
      bgTertiary: '#2e4557',
      accent: '#ff8566',
      accentHover: '#ff7055',
      textPrimary: '#e8f4f8',
      textSecondary: '#b8d4e0',
      textTertiary: '#8ab4c8',
      recordColor: '#ff9977',
      recordHover: '#ff8566',
      success: '#6bc4a6',
      border: '#3a5566',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },
  {
    id: 'forest-meditation',
    name: 'Forest Meditation',
    category: 'calm',
    variant: 'dark',
    description: 'Grounding greens bring natural peace with soft lavender accents',
    colors: {
      bgPrimary: '#1a2e1a',
      bgSecondary: '#243d24',
      bgTertiary: '#2e4d2e',
      accent: '#b399d8',
      accentHover: '#a388c8',
      textPrimary: '#e8f4e8',
      textSecondary: '#c8e0c8',
      textTertiary: '#a0c8a0',
      recordColor: '#c3aae8',
      recordHover: '#b399d8',
      success: '#7bc47b',
      border: '#3a5a3a',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },
  {
    id: 'lavender-dreams',
    name: 'Lavender Dreams',
    category: 'calm',
    variant: 'dark',
    description: 'Soft purples inspire calm creativity and spiritual peace',
    colors: {
      bgPrimary: '#2a2438',
      bgSecondary: '#3a3448',
      bgTertiary: '#4a4458',
      accent: '#8b7fa8',
      accentHover: '#7b6f98',
      textPrimary: '#f0e8f8',
      textSecondary: '#d8c8e8',
      textTertiary: '#c0a8d8',
      recordColor: '#a88fc4',
      recordHover: '#987fb4',
      success: '#9b8fb8',
      border: '#4a3e5a',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },
  {
    id: 'moonlight-zen',
    name: 'Moonlight Zen',
    category: 'calm',
    variant: 'dark',
    description: 'Cool silvers and blues with warm golden accents',
    colors: {
      bgPrimary: '#1e2228',
      bgSecondary: '#2a3038',
      bgTertiary: '#363e48',
      accent: '#f0b857',
      accentHover: '#e0a847',
      textPrimary: '#e8ecf0',
      textSecondary: '#c8d0d8',
      textTertiary: '#a8b4c0',
      recordColor: '#ffc870',
      recordHover: '#f0b857',
      success: '#7a9fb8',
      border: '#3e4a5a',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },

  // ===== ENERGETIC & MOTIVATED (4 themes) =====
  {
    id: 'sunrise-energy',
    name: 'Sunrise Energy',
    category: 'energetic',
    variant: 'dark',
    description: 'Warm oranges and golds radiate enthusiasm and optimism',
    colors: {
      bgPrimary: '#2e1a1a',
      bgSecondary: '#3d2424',
      bgTertiary: '#4d2e2e',
      accent: '#d2691e',
      accentHover: '#c2590e',
      textPrimary: '#fff4e8',
      textSecondary: '#f0d8c8',
      textTertiary: '#d8b8a0',
      recordColor: '#e8843e',
      recordHover: '#d8742e',
      success: '#e89f5a',
      border: '#5a3a2e',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },
  {
    id: 'ruby-passion',
    name: 'Ruby Passion',
    category: 'energetic',
    variant: 'dark',
    description: 'Bold reds ignite determination with cool teal balance',
    colors: {
      bgPrimary: '#2e1a1e',
      bgSecondary: '#3d2428',
      bgTertiary: '#4d2e32',
      accent: '#4ecdc4',
      accentHover: '#3ebdb4',
      textPrimary: '#ffe8ec',
      textSecondary: '#f0c8d0',
      textTertiary: '#d8a0b0',
      recordColor: '#5eddd4',
      recordHover: '#4ecdc4',
      success: '#e85a7a',
      border: '#5a2e38',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },
  {
    id: 'citrus-burst',
    name: 'Citrus Burst',
    category: 'energetic',
    variant: 'dark',
    description: 'Vibrant yellows and oranges spark joy and creativity',
    colors: {
      bgPrimary: '#2e2a1a',
      bgSecondary: '#3d3624',
      bgTertiary: '#4d442e',
      accent: '#ffa500',
      accentHover: '#ef9500',
      textPrimary: '#fffae8',
      textSecondary: '#f0e8c8',
      textTertiary: '#d8d0a0',
      recordColor: '#ffb84d',
      recordHover: '#efa83d',
      success: '#ffc966',
      border: '#5a4a2e',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },
  {
    id: 'tropical-fire',
    name: 'Tropical Fire',
    category: 'energetic',
    variant: 'dark',
    description: 'Hot pinks and magentas energize with playful vibrancy',
    colors: {
      bgPrimary: '#2e1a2a',
      bgSecondary: '#3d2436',
      bgTertiary: '#4d2e44',
      accent: '#ff1493',
      accentHover: '#ef0483',
      textPrimary: '#ffe8f8',
      textSecondary: '#f0c8e8',
      textTertiary: '#d8a0d0',
      recordColor: '#ff69b4',
      recordHover: '#ef59a4',
      success: '#ff8fc7',
      border: '#5a2e48',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },

  // ===== FOCUS & PRODUCTIVITY (4 themes) =====
  {
    id: 'midnight-focus',
    name: 'Midnight Focus',
    category: 'focus',
    variant: 'dark',
    description: 'Deep navy promotes intense concentration with warm amber highlights',
    colors: {
      bgPrimary: '#0f1419',
      bgSecondary: '#1a2028',
      bgTertiary: '#252d38',
      accent: '#f5a742',
      accentHover: '#e59732',
      textPrimary: '#e8f0f8',
      textSecondary: '#c8d8e8',
      textTertiary: '#a0b8d0',
      recordColor: '#ffb85c',
      recordHover: '#f5a742',
      success: '#5a9fb8',
      border: '#2a3848',
      shadow: 'rgba(0, 0, 0, 0.5)'
    }
  },
  {
    id: 'slate-professional',
    name: 'Slate Professional',
    category: 'focus',
    variant: 'dark',
    description: 'Neutral grays provide balanced, clear-minded focus',
    colors: {
      bgPrimary: '#1e2228',
      bgSecondary: '#2a3038',
      bgTertiary: '#363e48',
      accent: '#708090',
      accentHover: '#607080',
      textPrimary: '#e8ecf0',
      textSecondary: '#c8d0d8',
      textTertiary: '#a8b4c0',
      recordColor: '#8090a0',
      recordHover: '#708090',
      success: '#7a9fb8',
      border: '#3e4a5a',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },
  {
    id: 'deep-space',
    name: 'Deep Space',
    category: 'focus',
    variant: 'dark',
    description: 'Dark purples and blues for mysterious, deep concentration',
    colors: {
      bgPrimary: '#0a0a14',
      bgSecondary: '#14141e',
      bgTertiary: '#1e1e2e',
      accent: '#6a5acd',
      accentHover: '#5a4abd',
      textPrimary: '#e8e8ff',
      textSecondary: '#c8c8e8',
      textTertiary: '#a0a0d0',
      recordColor: '#7a6add',
      recordHover: '#6a5acd',
      success: '#7a8aed',
      border: '#2e2e48',
      shadow: 'rgba(0, 0, 0, 0.6)'
    }
  },
  {
    id: 'arctic-clarity',
    name: 'Arctic Clarity',
    category: 'focus',
    variant: 'dark',
    description: 'Crisp teals and ice blues for refreshing mental clarity',
    colors: {
      bgPrimary: '#1a2e2e',
      bgSecondary: '#243d3d',
      bgTertiary: '#2e4d4d',
      accent: '#5f9ea0',
      accentHover: '#4f8e90',
      textPrimary: '#e8f8f8',
      textSecondary: '#c8e8e8',
      textTertiary: '#a0d0d0',
      recordColor: '#6faeb0',
      recordHover: '#5f9ea0',
      success: '#7abec0',
      border: '#3a5a5a',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },

  // ===== CREATIVE & INSPIRED (4 themes) =====
  {
    id: 'sunset-canvas',
    name: 'Sunset Canvas',
    category: 'creative',
    variant: 'dark',
    description: 'Purple and orange blend for artistic imagination',
    colors: {
      bgPrimary: '#2a1e2e',
      bgSecondary: '#3a2838',
      bgTertiary: '#4a3248',
      accent: '#ff8c42',
      accentHover: '#ef7c32',
      textPrimary: '#fff0e8',
      textSecondary: '#f0d0c8',
      textTertiary: '#d8b0a8',
      recordColor: '#ff9c5a',
      recordHover: '#ef8c4a',
      success: '#b88fd8',
      border: '#5a3e58',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },
  {
    id: 'rainbow-joy',
    name: 'Rainbow Joy',
    category: 'creative',
    variant: 'dark',
    description: 'Full spectrum rainbow colors bring vibrant joy and creativity',
    colors: {
      bgPrimary: '#1e1e2e',
      bgSecondary: '#2a2a3a',
      bgTertiary: '#363648',
      accent: '#ff6b9d',
      accentHover: '#ff5b8d',
      textPrimary: '#f0f0ff',
      textSecondary: '#d0d0e8',
      textTertiary: '#b0b0d0',
      recordColor: '#ffa500',
      recordHover: '#ff9500',
      success: '#00ff88',
      border: '#6b4ecf',
      shadow: 'rgba(107, 78, 207, 0.3)'
    }
  },
  {
    id: 'neon-dreams',
    name: 'Neon Dreams',
    category: 'creative',
    variant: 'dark',
    description: 'Electric neons on dark for bold, modern creativity',
    colors: {
      bgPrimary: '#0a0a0f',
      bgSecondary: '#14141a',
      bgTertiary: '#1e1e28',
      accent: '#00ffff',
      accentHover: '#00efef',
      textPrimary: '#f0f0ff',
      textSecondary: '#d0d0e8',
      textTertiary: '#b0b0d0',
      recordColor: '#ff00ff',
      recordHover: '#ef00ef',
      success: '#00ff88',
      border: '#2e2e48',
      shadow: 'rgba(0, 255, 255, 0.2)'
    }
  },
  {
    id: 'autumn-inspiration',
    name: 'Autumn Inspiration',
    category: 'creative',
    variant: 'dark',
    description: 'Warm autumn tones inspire cozy creativity',
    colors: {
      bgPrimary: '#2a1e1a',
      bgSecondary: '#3a2824',
      bgTertiary: '#4a322e',
      accent: '#d2691e',
      accentHover: '#c2590e',
      textPrimary: '#fff4e8',
      textSecondary: '#f0d8c8',
      textTertiary: '#d8b8a0',
      recordColor: '#cd853f',
      recordHover: '#bd752f',
      success: '#daa520',
      border: '#5a3e2e',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },

  // ===== BALANCED & HARMONIOUS (4 themes) =====
  {
    id: 'earth-tones',
    name: 'Earth Tones',
    category: 'balanced',
    variant: 'dark',
    description: 'Natural browns provide stable harmony with turquoise energy',
    colors: {
      bgPrimary: '#2a2420',
      bgSecondary: '#3a3028',
      bgTertiary: '#4a3c30',
      accent: '#5bc0be',
      accentHover: '#4bb0ae',
      textPrimary: '#f0ece8',
      textSecondary: '#d8d0c8',
      textTertiary: '#c0b0a0',
      recordColor: '#6bd0ce',
      recordHover: '#5bc0be',
      success: '#9b8f7a',
      border: '#5a4a3e',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },
  {
    id: 'sakura-blossom',
    name: 'Sakura Blossom',
    category: 'balanced',
    variant: 'dark',
    description: 'Elegant pink and gray for gentle sophistication',
    colors: {
      bgPrimary: '#2a2428',
      bgSecondary: '#3a2e32',
      bgTertiary: '#4a383c',
      accent: '#d8a0b0',
      accentHover: '#c890a0',
      textPrimary: '#fff0f4',
      textSecondary: '#f0d0d8',
      textTertiary: '#d8b0c0',
      recordColor: '#e8b0c0',
      recordHover: '#d8a0b0',
      success: '#c8a0b8',
      border: '#5a3e48',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },
  {
    id: 'jade-garden',
    name: 'Jade Garden',
    category: 'balanced',
    variant: 'dark',
    description: 'Jade greens bring balanced prosperity and freshness',
    colors: {
      bgPrimary: '#1e2a24',
      bgSecondary: '#28362e',
      bgTertiary: '#324238',
      accent: '#7cb89d',
      accentHover: '#6ca88d',
      textPrimary: '#e8f8f0',
      textSecondary: '#c8e8d8',
      textTertiary: '#a0d0b8',
      recordColor: '#8cc8ad',
      recordHover: '#7cb89d',
      success: '#9cd8bd',
      border: '#3e5a48',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },
  {
    id: 'twilight-balance',
    name: 'Twilight Balance',
    category: 'balanced',
    variant: 'dark',
    description: 'Indigo and mauve for peaceful transition and balance',
    colors: {
      bgPrimary: '#1e1e2a',
      bgSecondary: '#2a2a38',
      bgTertiary: '#363648',
      accent: '#9b8fb8',
      accentHover: '#8b7fa8',
      textPrimary: '#f0e8ff',
      textSecondary: '#d8c8e8',
      textTertiary: '#c0a8d0',
      recordColor: '#ab9fc8',
      recordHover: '#9b8fb8',
      success: '#b8afd8',
      border: '#3e3e58',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },

  // ===== LIGHT MODE THEMES =====
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

/**
 * Get theme by ID
 */
export function getThemeById(id: string): Theme | undefined {
  return themes.find(theme => theme.id === id);
}

/**
 * Get themes by category
 */
export function getThemesByCategory(category: string): Theme[] {
  return themes.filter(theme => theme.category === category);
}

/**
 * Get all theme categories
 */
export function getCategories(): string[] {
  return ['calm', 'energetic', 'focus', 'creative', 'balanced'];
}

/**
 * Get default theme
 */
export function getDefaultTheme(): Theme {
  return themes[0]; // Ocean Serenity
}
