/**
 * Dark Theme Presets - Redesigned with Color Psychology
 *
 * 16 intentionally distinct dark themes organized by emotional impact.
 * Each theme uses color psychology principles for its intended effect.
 */

import { Theme } from './types.js';

export const darkThemes: Theme[] = [
  // ===== CALM & PEACEFUL (3 themes) =====
  // Psychology: Lower arousal, trust, tranquility. Cool temperatures, lower saturation.
  {
    id: 'deep-ocean',
    name: 'Deep Ocean',
    category: 'calm',
    variant: 'dark',
    description: 'Abyssal blues evoke infinite calm and trustworthy depth',
    colors: {
      bgPrimary: '#0d1b2a',
      bgSecondary: '#1b263b',
      bgTertiary: '#274060',
      accent: '#3d9be9',
      accentHover: '#2d8bd9',
      accentSecondary: '#48cae4',
      accentSecondaryHover: '#38bad4',
      textPrimary: '#e8f1f8',
      textSecondary: '#c0d4e4',
      textTertiary: '#90b0cc',
      recordColor: '#4dabf9',
      recordHover: '#3d9be9',
      success: '#48cae4',
      border: '#384d68',
      shadow: 'rgba(0, 0, 0, 0.5)'
    }
  },
  {
    id: 'moss-garden',
    name: 'Moss Garden',
    category: 'calm',
    variant: 'dark',
    description: 'Earthy forest greens bring grounded, nurturing peace',
    colors: {
      bgPrimary: '#1a2e1c',
      bgSecondary: '#243826',
      bgTertiary: '#2e4830',
      accent: '#7cb69d',
      accentHover: '#6ca68d',
      accentSecondary: '#d4a574',
      accentSecondaryHover: '#c49564',
      textPrimary: '#e8f0ea',
      textSecondary: '#c8d8cc',
      textTertiary: '#a0b8a8',
      recordColor: '#8cc6ad',
      recordHover: '#7cb69d',
      success: '#7cb69d',
      border: '#3a5840',
      shadow: 'rgba(0, 0, 0, 0.45)'
    }
  },
  {
    id: 'twilight-mist',
    name: 'Twilight Mist',
    category: 'calm',
    variant: 'dark',
    description: 'Soft lavender and slate for gentle contemplation',
    colors: {
      bgPrimary: '#1e1e2e',
      bgSecondary: '#282838',
      bgTertiary: '#313145',
      accent: '#b4a7d6',
      accentHover: '#a497c6',
      accentSecondary: '#89b4fa',
      accentSecondaryHover: '#79a4ea',
      textPrimary: '#f0ecf8',
      textSecondary: '#d8d0e8',
      textTertiary: '#b8b0d0',
      recordColor: '#c4b7e6',
      recordHover: '#b4a7d6',
      success: '#89b4fa',
      border: '#45455a',
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },

  // ===== ENERGETIC & MOTIVATED (3 themes) =====
  // Psychology: High arousal, motivation, action. Warm temperatures, high saturation.
  {
    id: 'solar-flare',
    name: 'Solar Flare',
    category: 'energetic',
    variant: 'dark',
    description: 'Blazing oranges and yellows ignite motivation and optimism',
    colors: {
      bgPrimary: '#1a1205',
      bgSecondary: '#261c0a',
      bgTertiary: '#332610',
      accent: '#ff9500',
      accentHover: '#ef8500',
      accentSecondary: '#ffcc00',
      accentSecondaryHover: '#efbc00',
      textPrimary: '#fff8e8',
      textSecondary: '#f0e0c8',
      textTertiary: '#d8c8a0',
      recordColor: '#ffa510',
      recordHover: '#ff9500',
      success: '#ffcc00',
      border: '#4a3820',
      shadow: 'rgba(255, 149, 0, 0.2)'
    }
  },
  {
    id: 'cherry-bomb',
    name: 'Cherry Bomb',
    category: 'energetic',
    variant: 'dark',
    description: 'Bold reds spark passion and drive action',
    colors: {
      bgPrimary: '#1f0a0a',
      bgSecondary: '#2d1414',
      bgTertiary: '#3d1e1e',
      accent: '#ef4444',
      accentHover: '#df3434',
      accentSecondary: '#fbbf24',
      accentSecondaryHover: '#ebaf14',
      textPrimary: '#fef2f2',
      textSecondary: '#f0d0d0',
      textTertiary: '#d8b0b0',
      recordColor: '#ff5454',
      recordHover: '#ef4444',
      success: '#fbbf24',
      border: '#5a2828',
      shadow: 'rgba(239, 68, 68, 0.2)'
    }
  },
  {
    id: 'electric-lime',
    name: 'Electric Lime',
    category: 'energetic',
    variant: 'dark',
    description: 'Vibrant chartreuse energizes with youthful vigor',
    colors: {
      bgPrimary: '#0f1a0a',
      bgSecondary: '#182610',
      bgTertiary: '#223318',
      accent: '#a3e635',
      accentHover: '#93d625',
      accentSecondary: '#22d3ee',
      accentSecondaryHover: '#12c3de',
      textPrimary: '#f4ffe8',
      textSecondary: '#d8f0c8',
      textTertiary: '#b8d8a0',
      recordColor: '#b3f645',
      recordHover: '#a3e635',
      success: '#22d3ee',
      border: '#3a5028',
      shadow: 'rgba(163, 230, 53, 0.15)'
    }
  },

  // ===== FOCUS & PRODUCTIVITY (3 themes) =====
  // Psychology: Minimal distraction, professional, sustained attention. Muted, strategic.
  {
    id: 'graphite',
    name: 'Graphite',
    category: 'focus',
    variant: 'dark',
    description: 'Neutral grays with minimal accent for zero distraction',
    colors: {
      bgPrimary: '#18181b',
      bgSecondary: '#27272a',
      bgTertiary: '#3f3f46',
      accent: '#a1a1aa',
      accentHover: '#91919a',
      accentSecondary: '#3b82f6',
      accentSecondaryHover: '#2b72e6',
      textPrimary: '#fafafa',
      textSecondary: '#d4d4d8',
      textTertiary: '#a1a1aa',
      recordColor: '#b1b1ba',
      recordHover: '#a1a1aa',
      success: '#3b82f6',
      border: '#52525b',
      shadow: 'rgba(0, 0, 0, 0.5)'
    }
  },
  {
    id: 'espresso',
    name: 'Espresso',
    category: 'focus',
    variant: 'dark',
    description: 'Rich coffee browns create cozy productive warmth',
    colors: {
      bgPrimary: '#1c1410',
      bgSecondary: '#2a1f18',
      bgTertiary: '#382a20',
      accent: '#c4a77d',
      accentHover: '#b4976d',
      accentSecondary: '#a8763e',
      accentSecondaryHover: '#98662e',
      textPrimary: '#f8f0e8',
      textSecondary: '#e0d0c0',
      textTertiary: '#c0a890',
      recordColor: '#d4b78d',
      recordHover: '#c4a77d',
      success: '#a8763e',
      border: '#4a3828',
      shadow: 'rgba(0, 0, 0, 0.5)'
    }
  },
  {
    id: 'ink-paper',
    name: 'Ink & Paper',
    category: 'focus',
    variant: 'dark',
    description: 'Classic high-contrast for serious writing sessions',
    colors: {
      bgPrimary: '#0a0a0a',
      bgSecondary: '#141414',
      bgTertiary: '#1f1f1f',
      accent: '#f5f5f5',
      accentHover: '#e5e5e5',
      accentSecondary: '#fcd34d',
      accentSecondaryHover: '#ecc33d',
      textPrimary: '#fafafa',
      textSecondary: '#d4d4d4',
      textTertiary: '#a3a3a3',
      recordColor: '#ffffff',
      recordHover: '#f5f5f5',
      success: '#fcd34d',
      border: '#404040',
      shadow: 'rgba(0, 0, 0, 0.6)'
    }
  },

  // ===== CREATIVE & INSPIRED (4 themes) =====
  // Psychology: Inspiration, imagination, playfulness. Unexpected combinations, artistic.
  {
    id: 'synthwave',
    name: 'Synthwave',
    category: 'creative',
    variant: 'dark',
    description: 'Retro neon with hot pink and electric cyan',
    colors: {
      bgPrimary: '#0f0a1a',
      bgSecondary: '#1a1428',
      bgTertiary: '#261e38',
      accent: '#ff2a6d',
      accentHover: '#ef1a5d',
      accentSecondary: '#05d9e8',
      accentSecondaryHover: '#00c9d8',
      textPrimary: '#f8f0ff',
      textSecondary: '#e0d0f0',
      textTertiary: '#c0a8d8',
      recordColor: '#ff3a7d',
      recordHover: '#ff2a6d',
      success: '#05d9e8',
      border: '#3a2858',
      shadow: 'rgba(255, 42, 109, 0.2)'
    }
  },
  {
    id: 'aurora',
    name: 'Aurora',
    category: 'creative',
    variant: 'dark',
    description: 'Northern lights with shifting greens and purples',
    colors: {
      bgPrimary: '#020617',
      bgSecondary: '#0f172a',
      bgTertiary: '#1e293b',
      accent: '#4ade80',
      accentHover: '#3ace70',
      accentSecondary: '#a855f7',
      accentSecondaryHover: '#9845e7',
      textPrimary: '#f0fdf4',
      textSecondary: '#d0e8d8',
      textTertiary: '#a0c8b0',
      recordColor: '#5aee90',
      recordHover: '#4ade80',
      success: '#a855f7',
      border: '#334155',
      shadow: 'rgba(74, 222, 128, 0.15)'
    }
  },
  {
    id: 'candy-pop',
    name: 'Candy Pop',
    category: 'creative',
    variant: 'dark',
    description: 'Playful pastels that spark joy and whimsy',
    colors: {
      bgPrimary: '#1a1625',
      bgSecondary: '#252030',
      bgTertiary: '#302a3d',
      accent: '#f472b6',
      accentHover: '#e462a6',
      accentSecondary: '#a78bfa',
      accentSecondaryHover: '#977bea',
      textPrimary: '#fef7ff',
      textSecondary: '#f0d8f0',
      textTertiary: '#d8b8d8',
      recordColor: '#ff82c6',
      recordHover: '#f472b6',
      success: '#a78bfa',
      border: '#4a4060',
      shadow: 'rgba(244, 114, 182, 0.15)'
    }
  },
  {
    id: 'sunset-gradient',
    name: 'Sunset Gradient',
    category: 'creative',
    variant: 'dark',
    description: 'Warm oranges melting into cool purples',
    colors: {
      bgPrimary: '#1a0f1e',
      bgSecondary: '#28182c',
      bgTertiary: '#36213a',
      accent: '#fb923c',
      accentHover: '#eb822c',
      accentSecondary: '#c084fc',
      accentSecondaryHover: '#b074ec',
      textPrimary: '#fff8f0',
      textSecondary: '#f0d8d0',
      textTertiary: '#d8b0b8',
      recordColor: '#ffa24c',
      recordHover: '#fb923c',
      success: '#c084fc',
      border: '#4a3050',
      shadow: 'rgba(251, 146, 60, 0.2)'
    }
  },

  // ===== BALANCED & HARMONIOUS (3 themes) =====
  // Psychology: Harmony, versatility, sophistication. Complementary pairs, earth tones.
  {
    id: 'terra',
    name: 'Terra',
    category: 'balanced',
    variant: 'dark',
    description: 'Earth tones of sand, sage, and terracotta',
    colors: {
      bgPrimary: '#1c1917',
      bgSecondary: '#292524',
      bgTertiary: '#3a3534',
      accent: '#d97706',
      accentHover: '#c96600',
      accentSecondary: '#84cc16',
      accentSecondaryHover: '#74bc06',
      textPrimary: '#faf5f0',
      textSecondary: '#e0d8d0',
      textTertiary: '#b8a898',
      recordColor: '#e98716',
      recordHover: '#d97706',
      success: '#84cc16',
      border: '#4a4540',
      shadow: 'rgba(0, 0, 0, 0.45)'
    }
  },
  {
    id: 'coastal',
    name: 'Coastal',
    category: 'balanced',
    variant: 'dark',
    description: 'Sandy beige meets ocean teal for beach serenity',
    colors: {
      bgPrimary: '#0f1419',
      bgSecondary: '#1a2228',
      bgTertiary: '#263038',
      accent: '#2dd4bf',
      accentHover: '#1dc4af',
      accentSecondary: '#f59e0b',
      accentSecondaryHover: '#e58e00',
      textPrimary: '#f0f8f8',
      textSecondary: '#d0e0e0',
      textTertiary: '#a0c0c0',
      recordColor: '#3de4cf',
      recordHover: '#2dd4bf',
      success: '#f59e0b',
      border: '#3a4850',
      shadow: 'rgba(0, 0, 0, 0.45)'
    }
  },
  {
    id: 'sakura',
    name: 'Sakura',
    category: 'balanced',
    variant: 'dark',
    description: 'Cherry blossom pink balanced with jade green',
    colors: {
      bgPrimary: '#1a1518',
      bgSecondary: '#282024',
      bgTertiary: '#362a30',
      accent: '#f9a8d4',
      accentHover: '#e998c4',
      accentSecondary: '#34d399',
      accentSecondaryHover: '#24c389',
      textPrimary: '#fff4f8',
      textSecondary: '#f0d8e0',
      textTertiary: '#d8b0c0',
      recordColor: '#ffb8e4',
      recordHover: '#f9a8d4',
      success: '#34d399',
      border: '#4a3840',
      shadow: 'rgba(249, 168, 212, 0.15)'
    }
  },

  // ===== SPECIAL THEMED (3 themes) =====
  {
    id: 'ghibli-spirit',
    name: 'Ghibli Spirit',
    category: 'special',
    variant: 'dark',
    description: 'Bathhouse gold and spirit-world blue from anime magic',
    colors: {
      bgPrimary: '#1a1830',
      bgSecondary: '#252240',
      bgTertiary: '#302d50',
      accent: '#fbbf24',
      accentHover: '#ebaf14',
      accentSecondary: '#38bdf8',
      accentSecondaryHover: '#28ade8',
      textPrimary: '#f8f4e8',
      textSecondary: '#e0d8c8',
      textTertiary: '#c0b0a0',
      recordColor: '#ffcf34',
      recordHover: '#fbbf24',
      success: '#38bdf8',
      border: '#3a3860',
      shadow: 'rgba(251, 191, 36, 0.2)'
    }
  },
  {
    id: 'hyrule',
    name: 'Hyrule',
    category: 'special',
    variant: 'dark',
    description: 'Sheikah blue tech against Korok forest green',
    colors: {
      bgPrimary: '#14261a',
      bgSecondary: '#1e3424',
      bgTertiary: '#28422e',
      accent: '#06b6d4',
      accentHover: '#00a6c4',
      accentSecondary: '#84cc16',
      accentSecondaryHover: '#74bc06',
      textPrimary: '#ecfdf5',
      textSecondary: '#d0e8d8',
      textTertiary: '#a0c8b0',
      recordColor: '#16c6e4',
      recordHover: '#06b6d4',
      success: '#84cc16',
      border: '#3a5240',
      shadow: 'rgba(6, 182, 212, 0.15)'
    }
  },
  {
    id: 'void-walker',
    name: 'Void Walker',
    category: 'special',
    variant: 'dark',
    description: 'Deep space purple with distant starlight and nebula pink',
    colors: {
      bgPrimary: '#09090b',
      bgSecondary: '#121218',
      bgTertiary: '#1c1c24',
      accent: '#a855f7',
      accentHover: '#9845e7',
      accentSecondary: '#f472b6',
      accentSecondaryHover: '#e462a6',
      textPrimary: '#f4f0ff',
      textSecondary: '#d8d0e8',
      textTertiary: '#b0a0c8',
      recordColor: '#b865ff',
      recordHover: '#a855f7',
      success: '#f472b6',
      border: '#302840',
      shadow: 'rgba(168, 85, 247, 0.2)'
    }
  }
];
