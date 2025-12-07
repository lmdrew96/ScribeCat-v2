/**
 * FIXES for StudyQuestSpriteRenderer.ts
 * 
 * Replace the applySpriteToElement method and add the new applySpriteAsBackground method
 */

/**
 * Apply a sprite region as CSS background to a FIXED-SIZE element
 * Use this for icons, buttons, fixed panels
 * 
 * This sets the element's width and height to match the sprite!
 */
applySpriteToElement(
  element: HTMLElement,
  spriteSheet: string,
  region: SpriteRegion,
  scale: number = 2
): void {
  const img = this.spriteCache.get(spriteSheet);
  if (!img) {
    // Sprite sheet not loaded yet - defer or use fallback
    console.warn(`Sprite sheet not loaded: ${spriteSheet}`);
    return;
  }

  const scaledWidth = region.width * scale;
  const scaledHeight = region.height * scale;
  const sheetWidth = img.width * scale;
  const sheetHeight = img.height * scale;

  element.style.backgroundImage = `url("${spriteSheet}")`;
  element.style.backgroundPosition = `-${region.x * scale}px -${region.y * scale}px`;
  element.style.backgroundSize = `${sheetWidth}px ${sheetHeight}px`;
  element.style.backgroundRepeat = 'no-repeat';
  element.style.width = `${scaledWidth}px`;
  element.style.height = `${scaledHeight}px`;
  element.style.imageRendering = 'pixelated';
}

/**
 * Apply a sprite region as a STRETCHED background for flexible containers
 * Use this for panels, cards, dialogs that need to contain content
 * 
 * This does NOT set width/height - the element keeps its natural size
 * The sprite is stretched to cover the element
 */
applySpriteAsBackground(
  element: HTMLElement,
  spriteSheet: string,
  region: SpriteRegion,
  scale: number = 2
): void {
  const img = this.spriteCache.get(spriteSheet);
  if (!img) {
    console.warn(`Sprite sheet not loaded: ${spriteSheet}`);
    return;
  }

  // Calculate what percentage of the sprite sheet this region represents
  const sheetWidth = img.width;
  const sheetHeight = img.height;
  
  // We need to use a canvas to extract just this region as a separate image
  // For now, we'll use a CSS approach with object-fit
  
  // Create a data URL for just this region
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
  
  const dataUrl = canvas.toDataURL('image/png');
  
  element.style.backgroundImage = `url("${dataUrl}")`;
  element.style.backgroundSize = '100% 100%'; // Stretch to fill
  element.style.backgroundRepeat = 'no-repeat';
  element.style.backgroundPosition = 'center';
  element.style.imageRendering = 'pixelated';
}

/**
 * Apply sprite as a border-image for true 9-slice scaling
 * This is the proper way to handle resizable pixel art panels
 */
applySpriteAsBorderImage(
  element: HTMLElement,
  spriteSheet: string,
  region: SpriteRegion,
  sliceInset: number,
  scale: number = 2
): void {
  const img = this.spriteCache.get(spriteSheet);
  if (!img) {
    console.warn(`Sprite sheet not loaded: ${spriteSheet}`);
    return;
  }
  
  // Extract the region to a data URL
  const canvas = document.createElement('canvas');
  canvas.width = region.width * scale;
  canvas.height = region.height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    img,
    region.x, region.y, region.width, region.height,
    0, 0, region.width * scale, region.height * scale
  );
  
  const dataUrl = canvas.toDataURL('image/png');
  const scaledSlice = sliceInset * scale;
  
  // Use CSS border-image for true 9-slice
  element.style.borderImageSource = `url("${dataUrl}")`;
  element.style.borderImageSlice = `${scaledSlice} fill`;
  element.style.borderImageWidth = `${scaledSlice}px`;
  element.style.borderImageRepeat = 'stretch';
  element.style.borderStyle = 'solid';
  element.style.borderWidth = `${scaledSlice}px`;
  element.style.backgroundColor = 'transparent';
  element.style.imageRendering = 'pixelated';
}


// =============================================================================
// SIMPLER ALTERNATIVE: Pre-extract panel backgrounds on theme load
// =============================================================================

/**
 * Cache of extracted panel images
 */
private panelCache: Map<string, string> = new Map();

/**
 * Pre-extract all panel regions from a sprite sheet
 * Call this after loading a sprite sheet
 */
async extractPanelBackgrounds(theme: StudyQuestTheme): Promise<void> {
  const img = this.spriteCache.get(theme.spriteSheet);
  if (!img) return;
  
  const sprites = theme.sprites;
  const panelKeys: (keyof ThemeSpriteConfig)[] = [
    'panelSmall', 'panelMedium', 'panelLarge', 'panelMenu'
  ];
  
  for (const key of panelKeys) {
    const region = sprites[key];
    if (!region) continue;
    
    const canvas = document.createElement('canvas');
    canvas.width = region.width;
    canvas.height = region.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      img,
      region.x, region.y, region.width, region.height,
      0, 0, region.width, region.height
    );
    
    const dataUrl = canvas.toDataURL('image/png');
    const cacheKey = `${theme.id}-${key}`;
    this.panelCache.set(cacheKey, dataUrl);
  }
}

/**
 * Apply a pre-extracted panel background
 */
applyPanelBackground(
  element: HTMLElement,
  themeId: string,
  panelKey: 'panelSmall' | 'panelMedium' | 'panelLarge' | 'panelMenu'
): void {
  const cacheKey = `${themeId}-${panelKey}`;
  const dataUrl = this.panelCache.get(cacheKey);
  
  if (!dataUrl) {
    console.warn(`Panel not cached: ${cacheKey}`);
    return;
  }
  
  element.style.backgroundImage = `url("${dataUrl}")`;
  element.style.backgroundSize = '100% 100%';
  element.style.backgroundRepeat = 'no-repeat';
  element.style.imageRendering = 'pixelated';
}
