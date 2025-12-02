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
    description: 'Pacific Northwest forest with morning fog and moss accents',
    colors: {
      bgPrimary: '#1a2e1e',
      bgSecondary: '#243a28',
      bgTertiary: '#2e4832',
      accent: '#c3a9e8',
      accentHover: '#b399d8',
      accentSecondary: '#9eb3a8',
      accentSecondaryHover: '#8ea398',
      textPrimary: '#e8f0ea',
      textSecondary: '#c8d8cc',
      textTertiary: '#a0b8a8',
      recordColor: '#d3b9f8',
      recordHover: '#c3a9e8',
      success: '#7cb88c',
      border: '#3a5840',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },
  {
    id: 'lavender-dreams',
    name: 'Lavender Dreams',
    category: 'calm',
    variant: 'dark',
    description: 'Soft purples with warm gold for elegant creativity',
    colors: {
      bgPrimary: '#2a2440',
      bgSecondary: '#3a3450',
      bgTertiary: '#4a4460',
      accent: '#d4af37',
      accentHover: '#c49f27',
      accentSecondary: '#c8a8e8',
      accentSecondaryHover: '#b898d8',
      textPrimary: '#f4ecff',
      textSecondary: '#e0d0f0',
      textTertiary: '#c8b0e0',
      recordColor: '#e4bf47',
      recordHover: '#d4af37',
      success: '#a8c8a8',
      border: '#504468',
      shadow: 'rgba(212, 175, 55, 0.15)'
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
    id: 'coffee-shop',
    name: 'Coffee Shop',
    category: 'focus',
    variant: 'dark',
    description: 'Warm espresso browns and copper tones for cozy productivity',
    colors: {
      bgPrimary: '#1a1512',
      bgSecondary: '#241e18',
      bgTertiary: '#2e2620',
      accent: '#d4915a',
      accentHover: '#c4814a',
      accentSecondary: '#f5e6d3',
      accentSecondaryHover: '#e5d6c3',
      textPrimary: '#f5efe8',
      textSecondary: '#d8cfc4',
      textTertiary: '#b8a898',
      recordColor: '#e4a16a',
      recordHover: '#d4915a',
      success: '#8fb574',
      border: '#3e352c',
      shadow: 'rgba(0, 0, 0, 0.5)'
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
    description: 'Cyberpunk chrome with electric cyan grid and hot pink highlights',
    colors: {
      bgPrimary: '#0a0c10',
      bgSecondary: '#12161c',
      bgTertiary: '#1a2028',
      accent: '#00f5ff',
      accentHover: '#00e5ef',
      accentSecondary: '#ff2a6d',
      accentSecondaryHover: '#ef1a5d',
      textPrimary: '#e8ecf0',
      textSecondary: '#c0c8d0',
      textTertiary: '#909aa8',
      recordColor: '#ff3a7d',
      recordHover: '#ff2a6d',
      success: '#00ff9f',
      border: '#2a3040',
      shadow: 'rgba(0, 245, 255, 0.15)'
    }
  },

  // ===== BALANCED & HARMONIOUS (2 themes) =====
  {
    id: 'sakura-blossom',
    name: 'Sakura Blossom',
    category: 'balanced',
    variant: 'dark',
    description: 'Elegant cherry blossom pink with cool teal accents',
    colors: {
      bgPrimary: '#2e2428',
      bgSecondary: '#3e2e32',
      bgTertiary: '#4e383c',
      accent: '#f0b0c8',
      accentHover: '#e0a0b8',
      accentSecondary: '#4ecdc4',
      accentSecondaryHover: '#3ebdb4',
      textPrimary: '#fff4f8',
      textSecondary: '#f8d8e4',
      textTertiary: '#e0c0d0',
      recordColor: '#ffc0d8',
      recordHover: '#f0b0c8',
      success: '#4ecdc4',
      border: '#5e4450',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },
  {
    id: 'jade-garden',
    name: 'Jade Garden',
    category: 'balanced',
    variant: 'dark',
    description: 'Asian-inspired jade green with imperial gold accents',
    colors: {
      bgPrimary: '#1a2820',
      bgSecondary: '#24342a',
      bgTertiary: '#2e4034',
      accent: '#d4a537',
      accentHover: '#c49527',
      accentSecondary: '#7cb89d',
      accentSecondaryHover: '#6ca88d',
      textPrimary: '#f0f8f4',
      textSecondary: '#d0e8dc',
      textTertiary: '#a8d0b8',
      recordColor: '#e4b547',
      recordHover: '#d4a537',
      success: '#7cb89d',
      border: '#3a5240',
      shadow: 'rgba(212, 165, 55, 0.15)'
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
    description: '80s Miami Vice sunset with coral orange and teal palm vibes',
    colors: {
      bgPrimary: '#1f0a2e',
      bgSecondary: '#2a1438',
      bgTertiary: '#351e44',
      accent: '#ff6b35',
      accentHover: '#ef5b25',
      accentSecondary: '#00d4aa',
      accentSecondaryHover: '#00c49a',
      textPrimary: '#fff5f0',
      textSecondary: '#f0d8d0',
      textTertiary: '#d8b8b0',
      recordColor: '#ff7b45',
      recordHover: '#ff6b35',
      success: '#00d4aa',
      border: '#4a2858',
      shadow: 'rgba(255, 107, 53, 0.2)'
    }
  },
  {
    id: 'cosmic-void',
    name: 'Cosmic Void',
    category: 'creative',
    variant: 'dark',
    description: 'Deep space darkness with nebula purples and starlight accents',
    colors: {
      bgPrimary: '#0a0810',
      bgSecondary: '#12101a',
      bgTertiary: '#1a1824',
      accent: '#9d4edd',
      accentHover: '#8d3ecd',
      accentSecondary: '#e0e7ff',
      accentSecondaryHover: '#d0d7ef',
      textPrimary: '#f0f0ff',
      textSecondary: '#d0d0e8',
      textTertiary: '#a8a8c8',
      recordColor: '#ad5eed',
      recordHover: '#9d4edd',
      success: '#7dd3fc',
      border: '#2a2840',
      shadow: 'rgba(157, 78, 221, 0.2)'
    }
  }
];
