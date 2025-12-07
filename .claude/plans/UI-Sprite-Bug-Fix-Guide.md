# UI Sprite Rendering Bug Fix

## The Problem
UI sprites show the entire PNG sheet instead of the correct cropped region.

## Root Cause
In `StudyQuestModal.ts`, the `applySpritesToUI()` method has an inline `applySprite` helper that **doesn't set `background-size`**:

```typescript
// CURRENT (BROKEN):
const applySprite = (el: HTMLElement, region: { x: number; y: number; width: number; height: number }) => {
  if (region.width <= 1 || region.height <= 1) return;

  el.style.backgroundImage = `url("${spriteSheet}")`;
  el.style.backgroundPosition = `-${region.x * scale}px -${region.y * scale}px`;
  el.style.backgroundRepeat = 'no-repeat';
  el.style.imageRendering = 'pixelated';
  // ❌ MISSING: background-size!
};
```

When you scale the `background-position` by 2x but don't scale the image itself, the offset is wrong and you see the whole sheet or the wrong part.

## The Fix

### Option 1: Preload and use spriteRenderer (Recommended)

The `StudyQuestSpriteRenderer` class already has this logic, but it requires the image to be preloaded first.

**Step 1:** Preload the sprite sheet before applying:

```typescript
private async applySpritesToUI(): Promise<void> {
  if (!this.container) return;

  const theme = themeManager.getTheme();
  const sprites = theme.sprites;
  const spriteSheet = theme.spriteSheet;

  if (!spriteSheet || !sprites) {
    this.clearSpriteStyles();
    return;
  }

  // ✅ PRELOAD the sprite sheet first!
  await spriteRenderer.loadSpriteSheet(spriteSheet);

  const scale = 2;

  // Now apply to elements...
}
```

**Step 2:** Use `spriteRenderer.applySpriteToElement()` instead of inline helper:

```typescript
this.container.querySelectorAll('.studyquest-town-building').forEach((el) => {
  spriteRenderer.applySpriteToElement(el as HTMLElement, spriteSheet, sprites.panelMedium, scale);
});
```

### Option 2: Fix the inline helper directly

If you want to keep the inline approach, add `background-size`:

```typescript
const applySprite = (el: HTMLElement, region: { x: number; y: number; width: number; height: number }) => {
  if (region.width <= 1 || region.height <= 1) return;

  // Get the cached image to calculate scaled size
  const cachedImg = spriteRenderer.getCachedImage(spriteSheet);
  
  el.style.backgroundImage = `url("${spriteSheet}")`;
  el.style.backgroundPosition = `-${region.x * scale}px -${region.y * scale}px`;
  el.style.backgroundRepeat = 'no-repeat';
  el.style.imageRendering = 'pixelated';
  
  // ✅ ADD THIS: Scale the background to match the position offset
  if (cachedImg) {
    el.style.backgroundSize = `${cachedImg.width * scale}px ${cachedImg.height * scale}px`;
  }
};
```

### Option 3: Hardcode the sprite sheet dimensions

If you know the sprite sheet size ahead of time:

```typescript
// If the sprite sheet is 512x512 pixels:
const SPRITE_SHEET_WIDTH = 512;
const SPRITE_SHEET_HEIGHT = 512;

const applySprite = (el: HTMLElement, region: { x: number; y: number; width: number; height: number }) => {
  if (region.width <= 1 || region.height <= 1) return;

  el.style.backgroundImage = `url("${spriteSheet}")`;
  el.style.backgroundPosition = `-${region.x * scale}px -${region.y * scale}px`;
  el.style.backgroundRepeat = 'no-repeat';
  el.style.imageRendering = 'pixelated';
  
  // ✅ Hardcoded scaled size
  el.style.backgroundSize = `${SPRITE_SHEET_WIDTH * scale}px ${SPRITE_SHEET_HEIGHT * scale}px`;
};
```

## Additional Issue: Element Sizing

The elements also need to be sized to match the sprite region! Otherwise the sprite shows but the element is the wrong size.

```typescript
const applySprite = (el: HTMLElement, region: { x: number; y: number; width: number; height: number }) => {
  if (region.width <= 1 || region.height <= 1) return;

  el.style.backgroundImage = `url("${spriteSheet}")`;
  el.style.backgroundPosition = `-${region.x * scale}px -${region.y * scale}px`;
  el.style.backgroundRepeat = 'no-repeat';
  el.style.imageRendering = 'pixelated';
  
  // Scale the background
  const cachedImg = spriteRenderer.getCachedImage(spriteSheet);
  if (cachedImg) {
    el.style.backgroundSize = `${cachedImg.width * scale}px ${cachedImg.height * scale}px`;
  }
  
  // ✅ OPTIONAL: Set element dimensions to match sprite
  // Only do this if you want fixed-size elements
  // el.style.width = `${region.width * scale}px`;
  // el.style.height = `${region.height * scale}px`;
};
```

## Complete Fixed Method

Here's the full corrected `applySpritesToUI`:

```typescript
private async applySpritesToUI(): Promise<void> {
  if (!this.container) return;

  const theme = themeManager.getTheme();
  const sprites = theme.sprites;
  const spriteSheet = theme.spriteSheet;

  if (!spriteSheet || !sprites) {
    this.clearSpriteStyles();
    return;
  }

  const scale = 2;

  // ✅ Preload sprite sheet to cache
  try {
    await spriteRenderer.loadSpriteSheet(spriteSheet);
  } catch (error) {
    logger.error('Failed to load sprite sheet:', error);
    return;
  }

  // Get cached image for size calculation
  const cachedImg = spriteRenderer.getCachedImage(spriteSheet);
  if (!cachedImg) {
    logger.warn('Sprite sheet not in cache after loading');
    return;
  }

  const bgSize = `${cachedImg.width * scale}px ${cachedImg.height * scale}px`;

  // Helper with background-size included
  const applySprite = (el: HTMLElement, region: { x: number; y: number; width: number; height: number }) => {
    if (region.width <= 1 || region.height <= 1) return;

    el.style.backgroundImage = `url("${spriteSheet}")`;
    el.style.backgroundPosition = `-${region.x * scale}px -${region.y * scale}px`;
    el.style.backgroundSize = bgSize;  // ✅ THE FIX
    el.style.backgroundRepeat = 'no-repeat';
    el.style.imageRendering = 'pixelated';
  };

  // Apply to elements
  this.container.querySelectorAll('.studyquest-town-building').forEach((el) => {
    applySprite(el as HTMLElement, sprites.panelMedium);
  });

  this.container.querySelectorAll('.pixel-card').forEach((el) => {
    applySprite(el as HTMLElement, sprites.panelSmall);
  });

  // ... rest of element applications

  logger.info(`Theme applied: ${theme.name} (sprites + CSS colors)`);
}
```

## Also Update the `open()` Method

Since `applySpritesToUI` is now async, update the call in `open()`:

```typescript
public async open(): Promise<void> {
  // ... existing code ...

  if (this.container) {
    await themeManager.initialize(this.container);
    await this.applySpritesToUI();  // ✅ Add await
    this.themeUnsubscribe = themeManager.subscribe(() => this.applySpritesToUI());
  }

  // ... rest of method
}
```

## Summary

| What Was Wrong | The Fix |
|----------------|---------|
| `background-size` not set | Add `background-size: ${width * scale}px ${height * scale}px` |
| Sprite sheet not preloaded | Call `await spriteRenderer.loadSpriteSheet()` first |
| Position/size mismatch | Both position AND size must be scaled by the same factor |

The key insight: **CSS background sprites require THREE things to work together:**
1. `background-image` — the sprite sheet
2. `background-position` — negative offset to the sprite region
3. `background-size` — scaled to match the position offset

If you scale position but not size (or vice versa), the math breaks and you see the wrong part of the sheet.
