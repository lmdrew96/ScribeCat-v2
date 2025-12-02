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
    description: 'Pacific Northwest morning mist with soft fog gray and moss',
    colors: {
      bgPrimary: '#f4f8f5',
      bgSecondary: '#e8f0ea',
      bgTertiary: '#dce8de',
      accent: '#9377c8',
      accentHover: '#8366b8',
      accentSecondary: '#7a9888',
      accentSecondaryHover: '#6a8878',
      textPrimary: '#1a2e1e',
      textSecondary: '#2e4832',
      textTertiary: '#4a6650',
      recordColor: '#a388d8',
      recordHover: '#9377c8',
      success: '#5a9868',
      border: '#c8d8cc',
      shadow: 'rgba(26, 46, 30, 0.1)'
    }
  },
  {
    id: 'lavender-dreams-light',
    name: 'Lavender Dreams (Light)',
    category: 'calm',
    variant: 'light',
    description: 'Soft purples with warm gold for elegant creativity',
    colors: {
      bgPrimary: '#faf8fc',
      bgSecondary: '#f0e8f8',
      bgTertiary: '#e8d8f0',
      accent: '#b8962e',
      accentHover: '#a8861e',
      accentSecondary: '#9888b8',
      accentSecondaryHover: '#8878a8',
      textPrimary: '#2a2438',
      textSecondary: '#4a4458',
      textTertiary: '#6a6478',
      recordColor: '#c8a63e',
      recordHover: '#b8962e',
      success: '#6a9868',
      border: '#d8c8e8',
      shadow: 'rgba(184, 150, 46, 0.1)'
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
    id: 'coffee-shop-light',
    name: 'Coffee Shop (Light)',
    category: 'focus',
    variant: 'light',
    description: 'Creamy latte tones with rich espresso accents for cozy focus',
    colors: {
      bgPrimary: '#faf6f1',
      bgSecondary: '#f5ede4',
      bgTertiary: '#ebe0d4',
      accent: '#6b4423',
      accentHover: '#5b3413',
      accentSecondary: '#c47d4a',
      accentSecondaryHover: '#b46d3a',
      textPrimary: '#2a1f14',
      textSecondary: '#4a3828',
      textTertiary: '#6a5040',
      recordColor: '#7b5433',
      recordHover: '#6b4423',
      success: '#6b8c4a',
      border: '#e0d4c4',
      shadow: 'rgba(42, 31, 20, 0.1)'
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
    description: 'Light chrome with electric cyan and hot pink cyberpunk accents',
    colors: {
      bgPrimary: '#f5f8fa',
      bgSecondary: '#eef2f6',
      bgTertiary: '#e4eaef',
      accent: '#00c8d4',
      accentHover: '#00b8c4',
      accentSecondary: '#e0246a',
      accentSecondaryHover: '#d0145a',
      textPrimary: '#0a1018',
      textSecondary: '#1e2830',
      textTertiary: '#3a4450',
      recordColor: '#f0347a',
      recordHover: '#e0246a',
      success: '#00b87a',
      border: '#d0d8e0',
      shadow: 'rgba(0, 200, 212, 0.12)'
    }
  },

  // ===== BALANCED & HARMONIOUS - LIGHT (2 themes) =====
  {
    id: 'sakura-blossom-light',
    name: 'Sakura Blossom (Light)',
    category: 'balanced',
    variant: 'light',
    description: 'Elegant cherry blossom pink with cool teal accents',
    colors: {
      bgPrimary: '#fffafc',
      bgSecondary: '#fff0f4',
      bgTertiary: '#ffe8f0',
      accent: '#c890a0',
      accentHover: '#b88090',
      accentSecondary: '#5fb3aa',
      accentSecondaryHover: '#4fa39a',
      textPrimary: '#2a2428',
      textSecondary: '#4a383c',
      textTertiary: '#6a5558',
      recordColor: '#d8a0b0',
      recordHover: '#c890a0',
      success: '#5fb3aa',
      border: '#f0d0d8',
      shadow: 'rgba(42, 36, 40, 0.1)'
    }
  },
  {
    id: 'jade-garden-light',
    name: 'Jade Garden (Light)',
    category: 'balanced',
    variant: 'light',
    description: 'Asian-inspired pale jade with deep gold and emerald accents',
    colors: {
      bgPrimary: '#f4faf6',
      bgSecondary: '#e8f5ec',
      bgTertiary: '#dceee2',
      accent: '#b8860b',
      accentHover: '#a87600',
      accentSecondary: '#50a878',
      accentSecondaryHover: '#409868',
      textPrimary: '#1a2e22',
      textSecondary: '#2e4a38',
      textTertiary: '#4a6650',
      recordColor: '#c8961b',
      recordHover: '#b8860b',
      success: '#50a878',
      border: '#c8e0d0',
      shadow: 'rgba(184, 134, 11, 0.1)'
    }
  },

  // ===== SPECIAL THEMES - LIGHT (5 themes) =====
  {
    id: 'spirited-away-light',
    name: 'Spirited Away (Light)',
    category: 'creative',
    variant: 'light',
    description: 'Daytime spirit world with magical sky blue and Yubaba gold',
    colors: {
      bgPrimary: '#f0f5ff',
      bgSecondary: '#e8efff',
      bgTertiary: '#dfe8ff',
      accent: '#d4a537',
      accentHover: '#c49527',
      accentSecondary: '#5fb3b3',
      accentSecondaryHover: '#4fa3a3',
      textPrimary: '#1a1e30',
      textSecondary: '#2e3448',
      textTertiary: '#4a5068',
      recordColor: '#e4b547',
      recordHover: '#d4a537',
      success: '#5fb3b3',
      border: '#c8d8f0',
      shadow: 'rgba(212, 165, 55, 0.12)'
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
    description: '80s Miami sunrise with pastel coral pink and baby blue',
    colors: {
      bgPrimary: '#fff0f5',
      bgSecondary: '#ffe8ef',
      bgTertiary: '#ffdce8',
      accent: '#ff7b5c',
      accentHover: '#ef6b4c',
      accentSecondary: '#7fdbff',
      accentSecondaryHover: '#6fcbef',
      textPrimary: '#2e1020',
      textSecondary: '#4a2838',
      textTertiary: '#6a4050',
      recordColor: '#ff8b6c',
      recordHover: '#ff7b5c',
      success: '#00b89c',
      border: '#f0d0e0',
      shadow: 'rgba(255, 123, 92, 0.12)'
    }
  },
  {
    id: 'cosmic-void-light',
    name: 'Cosmic Void (Light)',
    category: 'creative',
    variant: 'light',
    description: 'Pale nebula clouds with deep purple and cosmic pink accents',
    colors: {
      bgPrimary: '#f8f5ff',
      bgSecondary: '#f0eaff',
      bgTertiary: '#e8e0ff',
      accent: '#7b2cbf',
      accentHover: '#6b1caf',
      accentSecondary: '#ff6b9d',
      accentSecondaryHover: '#ef5b8d',
      textPrimary: '#1a1028',
      textSecondary: '#2e2440',
      textTertiary: '#4a3a60',
      recordColor: '#8b3ccf',
      recordHover: '#7b2cbf',
      success: '#0ea5e9',
      border: '#d8d0f0',
      shadow: 'rgba(123, 44, 191, 0.1)'
    }
  }
];
