# 🎨 StudyQuest UI Theme Integration Guide

## Quick Overview

You have **8 beautiful UI sprite sheets** ready to integrate into StudyQuest!

| Theme | File | Perfect For |
|-------|------|-------------|
| 🐱 Cat | catUI.png | **DEFAULT** - It's a cat game! |
| 🌸 Pastel | PastelUi.png | Cozy, relaxing study sessions |
| 🌲 Fairytale | FairytaleUI.png | Forest dungeons |
| ✨ Magic | UImAGIC.png | Scholar class, magic theme |
| 🖤 Minimal | BlackandWhiteUI.png | Accessibility, clean look |
| 🍫 Brown | UI.png | Classic RPG warmth |
| 👑 Royal | UiElegant.png | Premium, elegant feel |
| 💀 Horror | UiHorror.png | Halloween, spooky dungeons |

---

## Step 1: Add Sprite Sheets to Your Repo

Copy your UI sprite sheets to:
```
assets/sprites/studyquest/ui/
```

Files to copy:
- `catUI.png`
- `PastelUi.png`
- `FairytaleUI.png`
- `UImAGIC.png`
- `BlackandWhiteUI.png`
- `UI.png`
- `UiElegant.png`
- `UiHorror.png`

---

## Step 2: Replace Theme Configuration

Replace the contents of:
```
src/renderer/components/studyquest/StudyQuestThemes.ts
```

With the new `StudyQuestUIThemes.ts` file I created.

---

## Step 3: Update Theme Manager (if needed)

Your existing `StudyQuestThemeManager.ts` should mostly work, but you may need to update it to use the new sprite regions.

**Key changes to look for:**

1. Import the new types:
```typescript
import { 
  ALL_THEMES, 
  DEFAULT_THEME, 
  getThemeById,
  type StudyQuestTheme,
  type SpriteRegion 
} from './StudyQuestThemes.js';
```

2. Update `applySprite()` to use the new region format:
```typescript
private applySprite(el: HTMLElement, region: SpriteRegion): void {
  const scale = 2; // Pixel art scaling
  el.style.backgroundImage = `url("${this.currentTheme.spriteSheet}")`;
  el.style.backgroundPosition = `-${region.x * scale}px -${region.y * scale}px`;
  el.style.backgroundSize = 'auto';
  el.style.backgroundRepeat = 'no-repeat';
  el.style.imageRendering = 'pixelated';
  el.style.width = `${region.width * scale}px`;
  el.style.height = `${region.height * scale}px`;
}
```

---

## Step 4: Add Theme Selector to Settings

In `StudyQuestSettingsPanel.ts`, add a theme dropdown:

```typescript
// Get available themes
import { ALL_THEMES, getThemeById } from './StudyQuestThemes.js';

// In render method, add:
<div class="setting-row">
  <label>UI Theme</label>
  <select id="theme-select" class="pixel-select">
    ${ALL_THEMES.map(t => `
      <option value="${t.id}" ${currentThemeId === t.id ? 'selected' : ''}>
        ${t.name}
      </option>
    `).join('')}
  </select>
</div>

// Handle change:
document.getElementById('theme-select')?.addEventListener('change', (e) => {
  const themeId = (e.target as HTMLSelectElement).value;
  themeManager.setTheme(themeId);
  localStorage.setItem('studyquest-theme', themeId);
});
```

---

## Step 5: Apply Sprites to Elements

Update `StudyQuestModal.ts` to apply sprites to the right elements:

```typescript
// In applySpritesToUI():
const sprites = theme.sprites;

// Panels
this.container.querySelectorAll('.studyquest-town-building').forEach(el => {
  applySprite(el, sprites.panelMedium);
});

this.container.querySelectorAll('.pixel-card').forEach(el => {
  applySprite(el, sprites.panelSmall);
});

this.container.querySelectorAll('.studyquest-dungeon-card').forEach(el => {
  applySprite(el, sprites.panelLarge);
});

// Buttons
this.container.querySelectorAll('.pixel-btn').forEach(el => {
  applySprite(el, sprites.buttonNormal);
});

this.container.querySelectorAll('.pixel-btn-success').forEach(el => {
  applySprite(el, sprites.buttonSuccess);
});

// Inventory
this.container.querySelectorAll('.studyquest-inventory-slot').forEach(el => {
  applySprite(el, sprites.inventorySlot);
});
```

---

## Using in Claude Code

Since you use Claude Code for agentic development, you can say:

> "Read the StudyQuestUIThemes.ts file and integrate it into StudyQuest. 
> Copy the UI sprite sheets from my New Assets folder to assets/sprites/studyquest/ui/.
> Update StudyQuestThemes.ts with the new theme definitions.
> Add a theme selector to the settings panel."

---

## Notes on Sprite Regions

The sprite regions I mapped are **approximate** based on visual inspection. You may need to fine-tune the x, y, width, height values for pixel-perfect alignment.

**Tip:** Open each sprite sheet in an image editor that shows coordinates (like Aseprite or GIMP) to verify exact pixel positions.

---

## What Each Sprite Region Is Used For

| Region | Used By |
|--------|---------|
| `panelSmall` | Shop items, class cards, small info boxes |
| `panelMedium` | Town buildings, quest cards, medium dialogs |
| `panelLarge` | Character sheet, dungeon complete screen |
| `panelMenu` | Main menu overlays |
| `buttonNormal/Hover/Pressed` | All .pixel-btn elements |
| `buttonSuccess` | Confirm buttons, green actions |
| `buttonDanger` | Cancel, flee, red actions |
| `healthBarBg/Fill` | Header HP bar, battle HP bars |
| `heartFull/Half/Empty` | Alternative heart-based HP display |
| `inventorySlot` | Each inventory grid slot |
| `inventoryGrid` | Full inventory background |
| `icon*` | Various UI icons |

---

## Enjoy your themed StudyQuest! 🐱✨
