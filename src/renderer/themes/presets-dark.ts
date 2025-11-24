/**
 * Dark Theme Presets
 *
 * 15 carefully designed dark themes using color theory to evoke positive emotions.
 * Includes unique emotional categories and special themed variants.
 * Organized into 5 categories: Calm, Energetic, Focus, Creative, and Balanced.
 */

import { Theme } from './types.js';

export const darkThemes: Theme[] = [
  // ===== CALM & PEACEFUL (3 themes) =====
  {
    id: 'ocean-serenity',
    name: 'Ocean Serenity',
    category: 'calm',
    variant: 'dark',
    description: 'Deep blues evoke tranquility and trust, with warm coral accents',
    colors: {
      bgPrimary: '#1a2840',
      bgSecondary: '#243854',
      bgTertiary: '#2e4868',
      accent: '#ff9977',
      accentHover: '#ff8866',
      accentSecondary: '#7bd4b6',
      accentSecondaryHover: '#6bc4a6',
      textPrimary: '#ecf8ff',
      textSecondary: '#c8e0f0',
      textTertiary: '#a8c8e0',
      recordColor: '#ffaa88',
      recordHover: '#ff9977',
      success: '#7bd4b6',
      border: '#3a5878',
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
      bgPrimary: '#1a321a',
      bgSecondary: '#244024',
      bgTertiary: '#2e502e',
      accent: '#c3a9e8',
      accentHover: '#b399d8',
      accentSecondary: '#8bd48b',
      accentSecondaryHover: '#7bc47b',
      textPrimary: '#ecf8ec',
      textSecondary: '#d0e8d0',
      textTertiary: '#a8d0a8',
      recordColor: '#d3b9f8',
      recordHover: '#c3a9e8',
      success: '#8bd48b',
      border: '#3a603a',
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
      bgPrimary: '#2a2440',
      bgSecondary: '#3a3450',
      bgTertiary: '#4a4460',
      accent: '#a896d8',
      accentHover: '#9886c8',
      accentSecondary: '#e8b8d8',
      accentSecondaryHover: '#d8a8c8',
      textPrimary: '#f4ecff',
      textSecondary: '#e0d0f0',
      textTertiary: '#c8b0e0',
      recordColor: '#b8a6e8',
      recordHover: '#a896d8',
      success: '#b8a6e8',
      border: '#504468',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },

  // ===== ENERGETIC & MOTIVATED (1 theme) =====
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
      accent: '#ff5577',
      accentHover: '#ff4466',
      accentSecondary: '#4ecdc4',
      accentSecondaryHover: '#3ebdb4',
      textPrimary: '#ffe8ec',
      textSecondary: '#f0c8d0',
      textTertiary: '#d8b0c0',
      recordColor: '#ff6688',
      recordHover: '#ff5577',
      success: '#4ecdc4',
      border: '#5a2e38',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },

  // ===== FOCUS & PRODUCTIVITY (2 themes) =====
  {
    id: 'midnight-focus',
    name: 'Midnight Focus',
    category: 'focus',
    variant: 'dark',
    description: 'Deep navy promotes intense concentration with warm amber highlights',
    colors: {
      bgPrimary: '#0f1828',
      bgSecondary: '#1a2438',
      bgTertiary: '#253048',
      accent: '#ffa742',
      accentHover: '#ff9732',
      accentSecondary: '#6aafcc',
      accentSecondaryHover: '#5a9fbc',
      textPrimary: '#e8f4ff',
      textSecondary: '#c8dcf0',
      textTertiary: '#a8c8e0',
      recordColor: '#ffb85c',
      recordHover: '#ffa742',
      success: '#6aafcc',
      border: '#2a3c58',
      shadow: 'rgba(0, 0, 0, 0.5)'
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
      accentSecondary: '#b8e6ff',
      accentSecondaryHover: '#a8d6ef',
      textPrimary: '#e8f8f8',
      textSecondary: '#c8e8e8',
      textTertiary: '#a8d8d8',
      recordColor: '#6faeb0',
      recordHover: '#5f9ea0',
      success: '#7abec0',
      border: '#3a5a5a',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },

  // ===== CREATIVE & INSPIRED (2 themes) =====
  {
    id: 'sunset-canvas',
    name: 'Sunset Canvas',
    category: 'creative',
    variant: 'dark',
    description: 'Purple and orange blend for artistic imagination',
    colors: {
      bgPrimary: '#2e1e32',
      bgSecondary: '#3e2840',
      bgTertiary: '#4e3250',
      accent: '#ff9c52',
      accentHover: '#ff8c42',
      accentSecondary: '#c89fe8',
      accentSecondaryHover: '#b88fd8',
      textPrimary: '#fff4ec',
      textSecondary: '#f0d8cc',
      textTertiary: '#d8bca8',
      recordColor: '#ffac66',
      recordHover: '#ff9c52',
      success: '#c89fe8',
      border: '#5e4260',
      shadow: 'rgba(0, 0, 0, 0.4)'
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
      accentSecondary: '#ff00ff',
      accentSecondaryHover: '#ef00ef',
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

  // ===== BALANCED & HARMONIOUS (2 themes) =====
  {
    id: 'sakura-blossom',
    name: 'Sakura Blossom',
    category: 'balanced',
    variant: 'dark',
    description: 'Elegant pink and gray for gentle sophistication',
    colors: {
      bgPrimary: '#2e2428',
      bgSecondary: '#3e2e32',
      bgTertiary: '#4e383c',
      accent: '#f0b0c8',
      accentHover: '#e0a0b8',
      accentSecondary: '#ffc0d8',
      accentSecondaryHover: '#f0b0c8',
      textPrimary: '#fff4f8',
      textSecondary: '#f8d8e4',
      textTertiary: '#e0c0d0',
      recordColor: '#ffc0d8',
      recordHover: '#f0b0c8',
      success: '#d8b0c8',
      border: '#5e4450',
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
      accentSecondary: '#9cd8bd',
      accentSecondaryHover: '#8cc8ad',
      textPrimary: '#e8f8f0',
      textSecondary: '#c8e8d8',
      textTertiary: '#a8d8c0',
      recordColor: '#8cc8ad',
      recordHover: '#7cb89d',
      success: '#9cd8bd',
      border: '#3e5a48',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },

  // ===== SPECIAL THEMES (5 themes) =====
  {
    id: 'spirited-away',
    name: 'Spirited Away',
    category: 'creative',
    variant: 'dark',
    description: 'Deep bathhouse night with spirit world glow inspired by Studio Ghibli',
    colors: {
      bgPrimary: '#1a1834',
      bgSecondary: '#252244',
      bgTertiary: '#302c54',
      accent: '#ffd700',
      accentHover: '#ffc700',
      accentSecondary: '#6eb5c0',
      accentSecondaryHover: '#5ea5b0',
      textPrimary: '#f0e8ff',
      textSecondary: '#d8c8e8',
      textTertiary: '#c0b0d8',
      recordColor: '#ffe84d',
      recordHover: '#ffd700',
      success: '#6eb5c0',
      border: '#3e3a68',
      shadow: 'rgba(255, 215, 0, 0.2)'
    }
  },
  {
    id: 'aurora-borealis',
    name: 'Aurora Borealis',
    category: 'creative',
    variant: 'dark',
    description: 'Northern lights dancing over night sky with ethereal greens and purples',
    colors: {
      bgPrimary: '#0a0e1a',
      bgSecondary: '#141824',
      bgTertiary: '#1e2230',
      accent: '#00ff88',
      accentHover: '#00ef78',
      accentSecondary: '#b668ff',
      accentSecondaryHover: '#a658ef',
      textPrimary: '#f0f8ff',
      textSecondary: '#d0e0f0',
      textTertiary: '#b0c8e0',
      recordColor: '#00ffaa',
      recordHover: '#00ef9a',
      success: '#b668ff',
      border: '#2e3a48',
      shadow: 'rgba(0, 255, 136, 0.15)'
    }
  },
  {
    id: 'zelda-botw',
    name: 'Zelda: Breath of the Wild',
    category: 'balanced',
    variant: 'dark',
    description: 'Nighttime Hyrule field with glowing Sheikah shrine technology',
    colors: {
      bgPrimary: '#1a2618',
      bgSecondary: '#243224',
      bgTertiary: '#2e3e30',
      accent: '#00d9ff',
      accentHover: '#00c9ef',
      accentSecondary: '#6fc276',
      accentSecondaryHover: '#5fb266',
      textPrimary: '#e8f8e8',
      textSecondary: '#c8e0c8',
      textTertiary: '#a8d0a8',
      recordColor: '#00e9ff',
      recordHover: '#00d9ff',
      success: '#6fc276',
      border: '#3a4a38',
      shadow: 'rgba(0, 217, 255, 0.15)'
    }
  },
  {
    id: 'vaporwave-dreams',
    name: 'Vaporwave Dreams',
    category: 'creative',
    variant: 'dark',
    description: 'Retro 80s/90s aesthetic with hot pink and cyan vibes',
    colors: {
      bgPrimary: '#1a0f2e',
      bgSecondary: '#24193a',
      bgTertiary: '#2e2348',
      accent: '#ff10f0',
      accentHover: '#ef00e0',
      accentSecondary: '#00ffff',
      accentSecondaryHover: '#00efef',
      textPrimary: '#fff0ff',
      textSecondary: '#f0d0f0',
      textTertiary: '#d8b0e8',
      recordColor: '#ff30ff',
      recordHover: '#ff10f0',
      success: '#00ffff',
      border: '#3e2e58',
      shadow: 'rgba(255, 16, 240, 0.2)'
    }
  },
  {
    id: 'winter-wonderland',
    name: 'Winter Wonderland',
    category: 'calm',
    variant: 'dark',
    description: 'Snowy night with ice crystal blues and northern light glow',
    colors: {
      bgPrimary: '#0f1820',
      bgSecondary: '#19222c',
      bgTertiary: '#232c38',
      accent: '#b8e6ff',
      accentHover: '#a8d6ef',
      accentSecondary: '#9dd0e8',
      accentSecondaryHover: '#8dc0d8',
      textPrimary: '#fafcff',
      textSecondary: '#e8f4ff',
      textTertiary: '#d0e0f0',
      recordColor: '#c8f6ff',
      recordHover: '#b8e6ff',
      success: '#9dd0e8',
      border: '#334a5a',
      shadow: 'rgba(184, 230, 255, 0.15)'
    }
  }
];
