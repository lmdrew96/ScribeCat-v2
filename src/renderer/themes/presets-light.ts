/**
 * Light Theme Presets
 *
 * 15 light mode themes using color theory to evoke positive emotions.
 * Includes unique emotional categories and special themed variants.
 * Organized into 5 categories: Calm, Energetic, Focus, Creative, and Balanced.
 */

import { Theme } from './types.js';

export const lightThemes: Theme[] = [
  // ===== CALM & PEACEFUL - LIGHT (3 themes) =====
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
      accentSecondary: '#5ba48b',
      accentSecondaryHover: '#4b947b',
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
      accentSecondary: '#6ba86b',
      accentSecondaryHover: '#5b985b',
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
      accentSecondary: '#c898b8',
      accentSecondaryHover: '#b888a8',
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

  // ===== ENERGETIC & MOTIVATED - LIGHT (1 theme) =====
  {
    id: 'ruby-passion-light',
    name: 'Ruby Passion (Light)',
    category: 'energetic',
    variant: 'light',
    description: 'Vibrant ruby red and magenta for bold energy and determination',
    colors: {
      bgPrimary: '#fff0f4',
      bgSecondary: '#ffe0e8',
      bgTertiary: '#ffd0dc',
      accent: '#d83050',
      accentHover: '#c82040',
      accentSecondary: '#e85080',
      accentSecondaryHover: '#d84070',
      textPrimary: '#2e1418',
      textSecondary: '#4d2428',
      textTertiary: '#6d3438',
      recordColor: '#e84060',
      recordHover: '#d83050',
      success: '#e85080',
      border: '#f0c0d0',
      shadow: 'rgba(46, 20, 24, 0.12)'
    }
  },

  // ===== FOCUS & PRODUCTIVITY - LIGHT (2 themes) =====
  {
    id: 'midnight-focus-light',
    name: 'Midnight Focus (Light)',
    category: 'focus',
    variant: 'light',
    description: 'Warm parchment tones for comfortable reading and deep concentration',
    colors: {
      bgPrimary: '#f9f5ed',
      bgSecondary: '#f0e8d8',
      bgTertiary: '#e8dcc8',
      accent: '#d07020',
      accentHover: '#c06010',
      accentSecondary: '#8b6914',
      accentSecondaryHover: '#7b5904',
      textPrimary: '#2a1f14',
      textSecondary: '#4a3828',
      textTertiary: '#6a5040',
      recordColor: '#e08030',
      recordHover: '#d07020',
      success: '#8b6914',
      border: '#d8ccb8',
      shadow: 'rgba(42, 31, 20, 0.12)'
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
      accentSecondary: '#88c6ff',
      accentSecondaryHover: '#78b6ef',
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

  // ===== CREATIVE & INSPIRED - LIGHT (2 themes) =====
  {
    id: 'sunset-canvas-light',
    name: 'Sunset Canvas (Light)',
    category: 'creative',
    variant: 'light',
    description: 'Bold orange sunset with deep purple accents for creative energy',
    colors: {
      bgPrimary: '#fff4e8',
      bgSecondary: '#ffe8d0',
      bgTertiary: '#ffd8b0',
      accent: '#ff7030',
      accentHover: '#ef6020',
      accentSecondary: '#9860c0',
      accentSecondaryHover: '#8850b0',
      textPrimary: '#2a1810',
      textSecondary: '#4a2820',
      textTertiary: '#6a3830',
      recordColor: '#ff8040',
      recordHover: '#ff7030',
      success: '#9860c0',
      border: '#f0d0a8',
      shadow: 'rgba(42, 24, 16, 0.12)'
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
      accentSecondary: '#cf00cf',
      accentSecondaryHover: '#bf00bf',
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

  // ===== BALANCED & HARMONIOUS - LIGHT (2 themes) =====
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
      accentSecondary: '#d8a0b0',
      accentSecondaryHover: '#c890a0',
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
    description: 'Cool teal-jade tones with aquamarine accents for balanced energy',
    colors: {
      bgPrimary: '#f0fcfa',
      bgSecondary: '#e0f8f4',
      bgTertiary: '#d0f0e8',
      accent: '#40a89d',
      accentHover: '#30988d',
      accentSecondary: '#60c8bd',
      accentSecondaryHover: '#50b8ad',
      textPrimary: '#14332a',
      textSecondary: '#244a3e',
      textTertiary: '#346252',
      recordColor: '#50b8ad',
      recordHover: '#40a89d',
      success: '#60c8bd',
      border: '#b8e8e0',
      shadow: 'rgba(20, 51, 42, 0.1)'
    }
  },

  // ===== SPECIAL THEMES - LIGHT (5 themes) =====
  {
    id: 'spirited-away-light',
    name: 'Spirited Away (Light)',
    category: 'creative',
    variant: 'light',
    description: 'Warm peachy sunset skies inspired by Studio Ghibli magic',
    colors: {
      bgPrimary: '#fff8f0',
      bgSecondary: '#ffefd8',
      bgTertiary: '#ffe5c0',
      accent: '#ff9966',
      accentHover: '#ff8856',
      accentSecondary: '#ffc18a',
      accentSecondaryHover: '#ffb17a',
      textPrimary: '#2a1e14',
      textSecondary: '#4a3424',
      textTertiary: '#6a4a34',
      recordColor: '#ffa876',
      recordHover: '#ff9966',
      success: '#ffc18a',
      border: '#f0d8b8',
      shadow: 'rgba(42, 30, 20, 0.12)'
    }
  },
  {
    id: 'aurora-borealis-light',
    name: 'Aurora Borealis (Light)',
    category: 'creative',
    variant: 'light',
    description: 'Daylight aurora pastels with ice blue and soft pink tones',
    colors: {
      bgPrimary: '#f0f8ff',
      bgSecondary: '#e0f0ff',
      bgTertiary: '#d0e8ff',
      accent: '#88e5ff',
      accentHover: '#78d5ef',
      accentSecondary: '#ffb3e6',
      accentSecondaryHover: '#ffa3d6',
      textPrimary: '#0a0e1a',
      textSecondary: '#1e2230',
      textTertiary: '#3a4050',
      recordColor: '#98f5ff',
      recordHover: '#88e5ff',
      success: '#ffb3e6',
      border: '#c8e0f0',
      shadow: 'rgba(10, 14, 26, 0.1)'
    }
  },
  {
    id: 'zelda-botw-light',
    name: 'Zelda: Breath of the Wild (Light)',
    category: 'balanced',
    variant: 'light',
    description: 'Bright Hyrule grasslands with golden sunshine and adventure',
    colors: {
      bgPrimary: '#f8fce8',
      bgSecondary: '#f0f8d0',
      bgTertiary: '#e8f0b8',
      accent: '#c8a040',
      accentHover: '#b89030',
      accentSecondary: '#98b848',
      accentSecondaryHover: '#88a838',
      textPrimary: '#2a2814',
      textSecondary: '#4a4024',
      textTertiary: '#6a5834',
      recordColor: '#d8b050',
      recordHover: '#c8a040',
      success: '#98b848',
      border: '#d8e8b0',
      shadow: 'rgba(42, 40, 20, 0.1)'
    }
  },
  {
    id: 'vaporwave-dreams-light',
    name: 'Vaporwave Dreams (Light)',
    category: 'creative',
    variant: 'light',
    description: 'Soft vaporwave pastels with dreamy purple and cyan tones',
    colors: {
      bgPrimary: '#fff0f8',
      bgSecondary: '#ffe8f0',
      bgTertiary: '#ffd8e8',
      accent: '#d4a5ff',
      accentHover: '#c495ef',
      accentSecondary: '#a5f0ff',
      accentSecondaryHover: '#95e0ef',
      textPrimary: '#1a0f2e',
      textSecondary: '#2e2348',
      textTertiary: '#4a3a68',
      recordColor: '#e4b5ff',
      recordHover: '#d4a5ff',
      success: '#a5f0ff',
      border: '#f0d0e8',
      shadow: 'rgba(26, 15, 46, 0.1)'
    }
  },
  {
    id: 'winter-wonderland-light',
    name: 'Winter Wonderland (Light)',
    category: 'calm',
    variant: 'light',
    description: 'Pure white snow with cool silver and icy blue accents',
    colors: {
      bgPrimary: '#fdfefe',
      bgSecondary: '#f5f7f9',
      bgTertiary: '#edf0f3',
      accent: '#87b5d1',
      accentHover: '#77a5c1',
      accentSecondary: '#a0b8c8',
      accentSecondaryHover: '#90a8b8',
      textPrimary: '#1a2028',
      textSecondary: '#2e3640',
      textTertiary: '#454e58',
      recordColor: '#97c5e1',
      recordHover: '#87b5d1',
      success: '#a0b8c8',
      border: '#dde4e8',
      shadow: 'rgba(26, 32, 40, 0.08)'
    }
  }
];
