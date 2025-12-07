# 🐛 SPRITE SHEET TILING BUG FIX

## What's Happening

The town building cards show the ENTIRE sprite sheet as a repeating pattern instead of showing just one panel sprite.

**Root Cause:** The `applySpriteToElement()` method uses `background-position` to offset into the sprite sheet, but:

1. The panel regions are small (80x112px) while the cards are large (~200x150px)
2. When the element is bigger than the sprite region, you see OTHER parts of the sprite sheet
3. The current approach only works for FIXED-SIZE elements, not flexible containers

## The Fix (Choose ONE approach)

### Option A: Extract Sprites to Data URLs (Recommended - Simplest)

Modify `StudyQuestSpriteRenderer.ts` to extract panel regions to standalone data URLs instead of using background-position offset:

```typescript
/**
 * Apply a sprite region as a background that STRETCHES to fit the element
 * Use for panels/cards that need to contain content
 */
applySpriteAsBackground(
  element: HTMLElement,
  spriteSheet: string,
  region: SpriteRegion
): void {
  const img = this.spriteCache.get(spriteSheet);
  if (!img) {
    console.warn(`Sprite sheet not loaded: ${spriteSheet}`);
    return;
  }
  
  // Extract just this region to a canvas
  const canvas = document.createElement('canvas');
  canvas.width = region.width;
  canvas.height = region.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    img,
    region.x, region.y, region.width, region.height,
    0, 0, region.width, region.height
  );
  
  // Convert to data URL and use as background
  const dataUrl = canvas.toDataURL('image/png');
  
  element.style.backgroundImage = `url("${dataUrl}")`;
  element.style.backgroundSize = '100% 100%';  // Stretch to fit element
  element.style.backgroundRepeat = 'no-repeat';
  element.style.imageRendering = 'pixelated';
}
```

Then in `StudyQuestThemeManager.ts`, use this new method for panels:

```typescript
applyThemeToElement(
  element: HTMLElement,
  spriteKey: keyof ThemeSpriteMap,
  scale: number = 2
): void {
  const theme = this.currentTheme;

  if (theme.sprites && theme.spriteSheet) {
    const region = theme.sprites[spriteKey];
    if (region) {
      // Use different methods based on element type
      const isPanelKey = ['panelSmall', 'panelMedium', 'panelLarge', 'panelMenu'].includes(spriteKey);
      
      if (isPanelKey) {
        // Panels should stretch to fit their content
        spriteRenderer.applySpriteAsBackground(element, theme.spriteSheet, region);
      } else {
        // Icons, buttons use fixed sizing
        spriteRenderer.applySpriteToElement(element, theme.spriteSheet, region, scale);
      }
    }
  }
}
```

### Option B: Pre-cache Panel Images

For better performance, extract panel images once when the theme loads:

```typescript
// In StudyQuestSpriteRenderer.ts - add to class
private panelCache: Map<string, string> = new Map();

// Call after loadSpriteSheet()
async cachePanelImages(theme: StudyQuestTheme): Promise<void> {
  const img = this.spriteCache.get(theme.spriteSheet);
  if (!img) return;
  
  const panelKeys = ['panelSmall', 'panelMedium', 'panelLarge', 'panelMenu'] as const;
  
  for (const key of panelKeys) {
    const region = theme.sprites[key];
    if (!region) continue;
    
    const canvas = document.createElement('canvas');
    canvas.width = region.width;
    canvas.height = region.height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      img,
      region.x, region.y, region.width, region.height,
      0, 0, region.width, region.height
    );
    
    this.panelCache.set(`${theme.id}-${key}`, canvas.toDataURL('image/png'));
  }
}

// Use cached image
applyPanelBackground(element: HTMLElement, themeId: string, panelKey: string): void {
  const dataUrl = this.panelCache.get(`${themeId}-${panelKey}`);
  if (!dataUrl) return;
  
  element.style.backgroundImage = `url("${dataUrl}")`;
  element.style.backgroundSize = '100% 100%';
  element.style.backgroundRepeat = 'no-repeat';
  element.style.imageRendering = 'pixelated';
}
```

### Option C: Use CSS border-image for True 9-Slice

For the most authentic pixel-art look with proper corner preservation:

```typescript
applySpriteAsBorderImage(
  element: HTMLElement,
  spriteSheet: string,
  region: SpriteRegion,
  sliceInset: number  // Use theme.sliceInset, usually 8 or 16
): void {
  const img = this.spriteCache.get(spriteSheet);
  if (!img) return;
  
  // Extract region
  const canvas = document.createElement('canvas');
  canvas.width = region.width;
  canvas.height = region.height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height);
  const dataUrl = canvas.toDataURL('image/png');
  
  // Apply as border-image
  element.style.borderImageSource = `url("${dataUrl}")`;
  element.style.borderImageSlice = `${sliceInset} fill`;
  element.style.borderImageWidth = `${sliceInset}px`;
  element.style.borderImageRepeat = 'stretch';
  element.style.borderStyle = 'solid';
  element.style.borderWidth = `${sliceInset}px`;
  element.style.backgroundColor = 'transparent';
  element.style.imageRendering = 'pixelated';
}
```

## Quick Fix Summary

**For Claude Code:**

1. Open `src/renderer/components/studyquest/StudyQuestSpriteRenderer.ts`

2. Add the `applySpriteAsBackground()` method from Option A above

3. In `applyThemeToElement()`, check if the sprite key is a panel type and use `applySpriteAsBackground()` for those instead of `applySpriteToElement()`

4. The key insight: **Panels need `backgroundSize: '100% 100%'` to stretch, NOT fixed dimensions**

## Test It

After the fix, town building cards should show the actual panel sprite (a simple bordered frame) stretched to fit, not the tiled icons pattern.
