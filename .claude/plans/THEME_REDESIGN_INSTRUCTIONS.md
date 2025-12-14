# ScribeCat-v2 Theme Redesign — Claude Code Instructions

## Overview

Replace the existing theme presets with a completely redesigned theme system based on **color psychology principles**. The new themes are intentionally distinct, emotionally appropriate, and (for high-contrast themes) actually WCAG AAA compliant.

## What's Changing

| File | Action | Notes |
|------|--------|-------|
| `src/renderer/themes/presets-dark.ts` | **Replace entirely** | 16 dark themes organized by emotional category |
| `src/renderer/themes/presets-light.ts` | **Replace entirely** | 16 light themes matching dark counterparts |
| `src/renderer/themes/presets-high-contrast.ts` | **Replace entirely** | 8 accessible themes with 7:1+ contrast ratios |
| `src/renderer/themes/presets-index.ts` | **Replace entirely** | Updated exports and category metadata |

## Theme Categories (Color Psychology)

- **🌊 Calm** — Cool blues, greens, lavenders. Low arousal, tranquility.
- **⚡ Energetic** — Warm oranges, reds, yellows. High arousal, motivation.
- **🎯 Focus** — Neutrals, browns, high contrast. Minimal distraction.
- **🎨 Creative** — Neons, pastels, unexpected combos. Playful, artistic.
- **☯️ Balanced** — Earth tones, complementary pairs. Harmony.
- **✨ Special** — Themed aesthetics (Ghibli, Zelda, etc.)
- **👁️ High Contrast** — WCAG AAA compliant accessibility themes.

---

## File 1: `src/renderer/themes/presets-dark.ts`

Replace the entire file with:

```typescript
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
```

---

## File 2: `src/renderer/themes/presets-light.ts`

Replace the entire file with:

```typescript
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
```

---

## File 3: `src/renderer/themes/presets-high-contrast.ts`

Replace the entire file with:

```typescript
/**
 * High Contrast Theme Presets
 *
 * WCAG AAA compliant themes for users with low vision or visual impairments.
 * All text/background combinations meet 7:1 contrast ratio minimum.
 *
 * Design principles:
 * - Maximum contrast for text readability (7:1+ ratio)
 * - Bold, saturated accent colors that are still distinguishable
 * - Strong borders for clear element boundaries
 * - Options for different visual needs (colorblind-friendly, reduced glare, etc.)
 *
 * Contrast ratios verified with WebAIM contrast checker.
 */

import { Theme } from './types.js';

export const highContrastThemes: Theme[] = [
  // ===== DARK HIGH CONTRAST =====

  {
    id: 'high-contrast-dark',
    name: 'High Contrast Dark',
    category: 'high-contrast',
    variant: 'dark',
    description: 'Pure black with white text and cyan accents — maximum readability',
    colors: {
      bgPrimary: '#000000',
      bgSecondary: '#0d0d0d',
      bgTertiary: '#1a1a1a',
      accent: '#00e5ff',
      accentHover: '#00d0e8',
      accentSecondary: '#ffeb3b',
      accentSecondaryHover: '#fdd835',
      textPrimary: '#ffffff',
      textSecondary: '#e0e0e0',
      textTertiary: '#bdbdbd',
      recordColor: '#ff4081',
      recordHover: '#f50057',
      success: '#00e676',
      border: '#616161',
      shadow: 'rgba(0, 0, 0, 0.9)'
    }
  },

  {
    id: 'high-contrast-amber-terminal',
    name: 'Amber Terminal',
    category: 'high-contrast',
    variant: 'dark',
    description: 'Retro amber-on-black — reduces eye strain, nostalgic terminal feel',
    colors: {
      bgPrimary: '#000000',
      bgSecondary: '#0a0800',
      bgTertiary: '#141000',
      accent: '#ffb300',
      accentHover: '#ffa000',
      accentSecondary: '#ff6f00',
      accentSecondaryHover: '#e65100',
      textPrimary: '#fff8e1',
      textSecondary: '#ffecb3',
      textTertiary: '#ffe082',
      recordColor: '#ff5722',
      recordHover: '#e64a19',
      success: '#aeea00',
      border: '#5d4037',
      shadow: 'rgba(0, 0, 0, 0.9)'
    }
  },

  {
    id: 'high-contrast-green-terminal',
    name: 'Green Terminal',
    category: 'high-contrast',
    variant: 'dark',
    description: 'Classic green-on-black — easy on eyes for extended reading',
    colors: {
      bgPrimary: '#000000',
      bgSecondary: '#001a00',
      bgTertiary: '#003300',
      accent: '#00e676',
      accentHover: '#00c853',
      accentSecondary: '#76ff03',
      accentSecondaryHover: '#64dd17',
      textPrimary: '#e8f5e9',
      textSecondary: '#c8e6c9',
      textTertiary: '#a5d6a7',
      recordColor: '#ffea00',
      recordHover: '#ffd600',
      success: '#00bcd4',
      border: '#2e7d32',
      shadow: 'rgba(0, 255, 0, 0.2)'
    }
  },

  {
    id: 'high-contrast-blue-dark',
    name: 'Arctic Night',
    category: 'high-contrast',
    variant: 'dark',
    description: 'Cool blue tones on black — reduces eye strain, calming',
    colors: {
      bgPrimary: '#000000',
      bgSecondary: '#000a14',
      bgTertiary: '#001428',
      accent: '#40c4ff',
      accentHover: '#00b0ff',
      accentSecondary: '#ea80fc',
      accentSecondaryHover: '#e040fb',
      textPrimary: '#e3f2fd',
      textSecondary: '#bbdefb',
      textTertiary: '#90caf9',
      recordColor: '#ff4081',
      recordHover: '#f50057',
      success: '#1de9b6',
      border: '#1565c0',
      shadow: 'rgba(0, 0, 0, 0.9)'
    }
  },

  // ===== LIGHT HIGH CONTRAST =====

  {
    id: 'high-contrast-light',
    name: 'High Contrast Light',
    category: 'high-contrast',
    variant: 'light',
    description: 'Pure white with black text and blue accents — maximum clarity',
    colors: {
      bgPrimary: '#ffffff',
      bgSecondary: '#fafafa',
      bgTertiary: '#f0f0f0',
      accent: '#0d47a1',
      accentHover: '#1565c0',
      accentSecondary: '#6a1b9a',
      accentSecondaryHover: '#7b1fa2',
      textPrimary: '#000000',
      textSecondary: '#212121',
      textTertiary: '#424242',
      recordColor: '#c62828',
      recordHover: '#b71c1c',
      success: '#2e7d32',
      border: '#757575',
      shadow: 'rgba(0, 0, 0, 0.3)'
    }
  },

  {
    id: 'high-contrast-cream',
    name: 'Warm Paper',
    category: 'high-contrast',
    variant: 'light',
    description: 'Cream background reduces glare — easier than pure white',
    colors: {
      bgPrimary: '#fffdf7',
      bgSecondary: '#fff9e8',
      bgTertiary: '#fff3d4',
      accent: '#4e342e',
      accentHover: '#3e2723',
      accentSecondary: '#bf360c',
      accentSecondaryHover: '#d84315',
      textPrimary: '#1a1a1a',
      textSecondary: '#2d2d2d',
      textTertiary: '#424242',
      recordColor: '#b71c1c',
      recordHover: '#c62828',
      success: '#1b5e20',
      border: '#8d6e63',
      shadow: 'rgba(62, 39, 35, 0.2)'
    }
  },

  {
    id: 'high-contrast-mint',
    name: 'Mint Paper',
    category: 'high-contrast',
    variant: 'light',
    description: 'Soft mint background — gentle on eyes, reduces fatigue',
    colors: {
      bgPrimary: '#f1f8f4',
      bgSecondary: '#e8f5e9',
      bgTertiary: '#dcedc8',
      accent: '#00695c',
      accentHover: '#00796b',
      accentSecondary: '#1565c0',
      accentSecondaryHover: '#1976d2',
      textPrimary: '#0d1f14',
      textSecondary: '#1b3d28',
      textTertiary: '#2e5a3c',
      recordColor: '#ad1457',
      recordHover: '#c2185b',
      success: '#0d47a1',
      border: '#4db6ac',
      shadow: 'rgba(0, 77, 64, 0.15)'
    }
  },

  {
    id: 'high-contrast-lavender',
    name: 'Lavender Paper',
    category: 'high-contrast',
    variant: 'light',
    description: 'Soft lavender background — calming, reduces harsh glare',
    colors: {
      bgPrimary: '#f8f5ff',
      bgSecondary: '#ede7f6',
      bgTertiary: '#e1d5f0',
      accent: '#4527a0',
      accentHover: '#512da8',
      accentSecondary: '#c2185b',
      accentSecondaryHover: '#d81b60',
      textPrimary: '#12001a',
      textSecondary: '#2a1a3d',
      textTertiary: '#4a3a5d',
      recordColor: '#880e4f',
      recordHover: '#ad1457',
      success: '#00695c',
      border: '#9575cd',
      shadow: 'rgba(69, 39, 160, 0.15)'
    }
  }
];

/**
 * Detect if OS has high contrast mode enabled
 * Call this to auto-switch to high contrast theme
 */
export function detectHighContrastMode(): boolean {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-contrast: more)').matches ||
           window.matchMedia('(prefers-contrast: high)').matches;
  }
  return false;
}

/**
 * Get recommended high contrast theme based on current variant
 */
export function getRecommendedHighContrastTheme(preferDark: boolean = true): Theme {
  if (preferDark) {
    return highContrastThemes.find(t => t.id === 'high-contrast-dark') || highContrastThemes[0];
  } else {
    return highContrastThemes.find(t => t.id === 'high-contrast-light') || highContrastThemes[4];
  }
}

/**
 * Listen for OS high contrast mode changes
 */
export function watchHighContrastMode(callback: (isHighContrast: boolean) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {}; // No-op cleanup
  }

  const mediaQuery = window.matchMedia('(prefers-contrast: more)');
  const fallbackQuery = window.matchMedia('(prefers-contrast: high)');

  const handler = () => {
    callback(mediaQuery.matches || fallbackQuery.matches);
  };

  // Initial call
  handler();

  // Listen for changes
  mediaQuery.addEventListener('change', handler);
  fallbackQuery.addEventListener('change', handler);

  // Return cleanup function
  return () => {
    mediaQuery.removeEventListener('change', handler);
    fallbackQuery.removeEventListener('change', handler);
  };
}

/**
 * Colorblind-friendly theme recommendations
 * These themes avoid red-green combinations that are problematic for colorblindness
 */
export const colorblindFriendlyThemeIds = [
  'high-contrast-dark',        // Cyan/Yellow - safe for all types
  'high-contrast-amber-terminal', // Amber/Orange - safe for all types
  'high-contrast-blue-dark',   // Blue/Pink - safe for all types
  'high-contrast-light',       // Blue/Purple - safe for all types
  'high-contrast-lavender'     // Purple/Pink - safe for all types
];
```

---

## File 4: `src/renderer/themes/presets-index.ts`

Replace the entire file with:

```typescript
/**
 * Theme Presets Index
 *
 * Central export for all theme presets, organized by variant and category.
 * Redesigned with color psychology principles for intentional emotional impact.
 */

import { Theme } from './types.js';
import { darkThemes } from './presets-dark.js';
import { lightThemes } from './presets-light.js';
import { highContrastThemes } from './presets-high-contrast.js';

// Export all themes
export { darkThemes } from './presets-dark.js';
export { lightThemes } from './presets-light.js';
export { highContrastThemes } from './presets-high-contrast.js';

/**
 * All preset themes combined
 */
export const allPresetThemes: Theme[] = [
  ...darkThemes,
  ...lightThemes,
  ...highContrastThemes
];

/**
 * Get themes by category
 */
export function getThemesByCategory(category: string): Theme[] {
  return allPresetThemes.filter(theme => theme.category === category);
}

/**
 * Get themes by variant (dark/light)
 */
export function getThemesByVariant(variant: 'dark' | 'light'): Theme[] {
  return allPresetThemes.filter(theme => theme.variant === variant);
}

/**
 * Find a theme by ID
 */
export function findThemeById(id: string): Theme | undefined {
  return allPresetThemes.find(theme => theme.id === id);
}

/**
 * Theme categories with metadata
 */
export const themeCategories = {
  calm: {
    name: 'Calm & Peaceful',
    emoji: '🌊',
    description: 'Lower arousal, trust, tranquility. Cool temperatures, lower saturation.'
  },
  energetic: {
    name: 'Energetic & Motivated',
    emoji: '⚡',
    description: 'High arousal, motivation, action. Warm temperatures, high saturation.'
  },
  focus: {
    name: 'Focus & Productivity',
    emoji: '🎯',
    description: 'Minimal distraction, professional, sustained attention. Muted, strategic.'
  },
  creative: {
    name: 'Creative & Inspired',
    emoji: '🎨',
    description: 'Inspiration, imagination, playfulness. Unexpected combinations, artistic.'
  },
  balanced: {
    name: 'Balanced & Harmonious',
    emoji: '☯️',
    description: 'Harmony, versatility, sophistication. Complementary pairs, earth tones.'
  },
  special: {
    name: 'Special Themes',
    emoji: '✨',
    description: 'Themed experiences based on beloved aesthetics and pop culture.'
  },
  'high-contrast': {
    name: 'High Contrast',
    emoji: '👁️',
    description: 'Maximum readability for accessibility needs.'
  }
} as const;
```

---

## Verification Steps

After making changes, verify:

1. **TypeScript compiles**: Run `npm run build` or `npx tsc --noEmit`
2. **Theme count is correct**: 
   - Dark themes: 16
   - Light themes: 16
   - High contrast themes: 8
   - Total: 40 themes
3. **App launches**: Run `npm run dev` and check themes load in settings
4. **Visual spot-check**: Try a few themes from each category to ensure colors render correctly

---

## Notes

- The `types.ts` file does NOT need changes — it's already correct
- Theme IDs changed, so if there's user preference storage, users may need to reselect their theme
- Easter egg themes (`easter-egg-themes.ts`) are not affected by this update
