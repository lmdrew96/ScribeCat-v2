/**
 * ColorPicker
 *
 * Theme-aware color picker for editor text and background colors.
 * Provides professional color palettes that work with both dark and light themes.
 */

/**
 * Professional color palettes that work well with dark themes
 */
export const EditorColorPalettes = {
  textColors: [
    { name: 'White', value: '#FFFFFF' },
    { name: 'Light Gray', value: '#E0E0E0' },
    { name: 'Gray', value: '#9E9E9E' },
    { name: 'Dark Gray', value: '#616161' },
    { name: 'Red', value: '#EF5350' },
    { name: 'Pink', value: '#EC407A' },
    { name: 'Purple', value: '#AB47BC' },
    { name: 'Deep Purple', value: '#7E57C2' },
    { name: 'Indigo', value: '#5C6BC0' },
    { name: 'Blue', value: '#42A5F5' },
    { name: 'Light Blue', value: '#29B6F6' },
    { name: 'Cyan', value: '#26C6DA' },
    { name: 'Teal', value: '#26A69A' },
    { name: 'Green', value: '#66BB6A' },
    { name: 'Light Green', value: '#9CCC65' },
    { name: 'Lime', value: '#D4E157' },
    { name: 'Yellow', value: '#FFEE58' },
    { name: 'Amber', value: '#FFCA28' },
    { name: 'Orange', value: '#FFA726' },
    { name: 'Deep Orange', value: '#FF7043' },
  ],

  highlightColors: [
    { name: 'Yellow Highlight', value: '#FFF59D' },
    { name: 'Lime Highlight', value: '#E6EE9C' },
    { name: 'Green Highlight', value: '#C5E1A5' },
    { name: 'Teal Highlight', value: '#B2DFDB' },
    { name: 'Cyan Highlight', value: '#B2EBF2' },
    { name: 'Blue Highlight', value: '#B3E5FC' },
    { name: 'Indigo Highlight', value: '#C5CAE9' },
    { name: 'Purple Highlight', value: '#E1BEE7' },
    { name: 'Pink Highlight', value: '#F8BBD0' },
    { name: 'Red Highlight', value: '#FFCDD2' },
    { name: 'Orange Highlight', value: '#FFCCBC' },
    { name: 'Amber Highlight', value: '#FFE082' },
  ],
} as const;

export interface ColorSwatchOptions {
  value: string;
  name: string;
  onClick: (color: string) => void;
  isActive?: boolean;
}

/**
 * Create a color swatch element
 */
export function createColorSwatch(options: ColorSwatchOptions): HTMLElement {
  const { value, name, onClick, isActive = false } = options;

  const swatch = document.createElement('div');
  swatch.className = 'editor-color-swatch';
  swatch.setAttribute('data-color', value);
  swatch.setAttribute('title', name);
  swatch.style.backgroundColor = value;

  if (isActive) {
    swatch.classList.add('active');
  }

  // Add border for very light colors to make them visible
  const rgb = hexToRgb(value);
  if (rgb && isColorLight(rgb)) {
    swatch.style.border = '2px solid rgba(255, 255, 255, 0.2)';
  }

  swatch.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick(value);
  });

  return swatch;
}

/**
 * Create a color picker palette
 */
export function createColorPalette(
  colors: readonly { name: string; value: string }[],
  onColorSelect: (color: string) => void,
  options: {
    className?: string;
    columns?: number;
    currentColor?: string;
  } = {}
): HTMLElement {
  const { className = '', columns = 5, currentColor } = options;

  const palette = document.createElement('div');
  palette.className = `editor-color-palette ${className}`;
  palette.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

  colors.forEach(color => {
    const swatch = createColorSwatch({
      value: color.value,
      name: color.name,
      onClick: (value) => {
        onColorSelect(value);
        // Close palette after selection
        palette.classList.remove('show');
      },
      isActive: currentColor === color.value,
    });

    palette.appendChild(swatch);
  });

  return palette;
}

/**
 * Create a color picker button with dropdown palette
 */
export function createColorPickerButton(options: {
  iconHTML: string;
  title: string;
  colors: readonly { name: string; value: string }[];
  onColorSelect: (color: string) => void;
  currentColor?: string;
  className?: string;
}): { button: HTMLElement; palette: HTMLElement } {
  const {
    iconHTML,
    title,
    colors,
    onColorSelect,
    currentColor,
    className = '',
  } = options;

  // Create button
  const button = document.createElement('button');
  button.className = `toolbar-btn editor-color-btn ${className}`;
  button.setAttribute('title', title);
  button.innerHTML = iconHTML;

  // Create palette
  const palette = createColorPalette(colors, onColorSelect, { currentColor });

  // Toggle palette on button click
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    palette.classList.toggle('show');

    // Close other palettes
    document.querySelectorAll('.editor-color-palette.show').forEach(p => {
      if (p !== palette) {
        p.classList.remove('show');
      }
    });
  });

  // Close palette when clicking outside
  const closeHandler = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!button.contains(target) && !palette.contains(target)) {
      palette.classList.remove('show');
    }
  };

  document.addEventListener('click', closeHandler);

  return { button, palette };
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Check if a color is light (for border visibility)
 */
function isColorLight(rgb: { r: number; g: number; b: number }): boolean {
  // Calculate relative luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.8;
}

/**
 * Get text color that contrasts with background
 */
export function getContrastColor(backgroundColor: string): string {
  const rgb = hexToRgb(backgroundColor);
  if (!rgb) return '#000000';

  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Generate CSS for color picker
 */
export function getColorPickerCSS(): string {
  return `
    .editor-color-palette {
      position: absolute;
      top: 100%;
      left: 0;
      margin-top: 4px;
      padding: 12px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
      display: none;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      z-index: 2000; /* Above floating toolbar (1500), below modals (10000) */
      min-width: 200px;
    }

    .editor-color-palette.show {
      display: grid;
    }

    .editor-color-swatch {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      cursor: pointer;
      border: 2px solid transparent;
      transition: all 0.2s ease;
      position: relative;
    }

    .editor-color-swatch:hover {
      transform: scale(1.15);
      border-color: var(--accent);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 1;
    }

    .editor-color-swatch.active {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(var(--accent-rgb, 0, 122, 204), 0.2);
    }

    .editor-color-swatch.active::after {
      content: '\\2713';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: var(--text-primary);
      font-weight: 700;
      font-size: 14px;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    }

    .toolbar-dropdown {
      position: relative;
      display: inline-block;
    }
  `;
}
