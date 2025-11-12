/**
 * EditorIcons
 *
 * Professional icon system using Lucide icons for editor toolbars.
 * Provides SVG icons that work with dark/light themes.
 */

import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Superscript,
  Subscript,
  Palette,
  Highlighter,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Link,
  Image,
  Table,
  Undo2,
  Redo2,
  Eraser,
  Smile,
  Code,
  Quote,
  Minus,
  File,
  Eye,
  EyeOff,
  Move,
  GripVertical,
  Anchor,
  WrapText,
  MoreHorizontal,
  X
} from 'lucide';

/**
 * Icon registry mapping icon names to Lucide icons
 */
export const EditorIconRegistry = {
  // Text formatting
  bold: Bold,
  italic: Italic,
  underline: Underline,
  strike: Strikethrough,
  superscript: Superscript,
  subscript: Subscript,

  // Colors
  color: Palette,
  highlight: Highlighter,
  fontSize: Type,

  // Alignment
  alignLeft: AlignLeft,
  alignCenter: AlignCenter,
  alignRight: AlignRight,
  alignJustify: AlignJustify,

  // Headings
  heading1: Heading1,
  heading2: Heading2,

  // Lists
  bulletList: List,
  numberedList: ListOrdered,

  // Insert
  link: Link,
  image: Image,
  table: Table,
  emoji: Smile,
  code: Code,
  quote: Quote,
  divider: Minus,
  file: File,

  // History
  undo: Undo2,
  redo: Redo2,

  // Actions
  clearFormat: Eraser,
  preview: Eye,
  edit: EyeOff,
  move: Move,
  drag: GripVertical,
  anchor: Anchor,
  wrap: WrapText,
  more: MoreHorizontal,
  close: X,
} as const;

export type EditorIconName = keyof typeof EditorIconRegistry;

/**
 * Icon path data for manual SVG creation
 * Simplified approach - using direct SVG strings
 */
const IconPaths: Record<EditorIconName, string> = {
  // Text formatting
  bold: '<path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>',
  italic: '<line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/>',
  underline: '<path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/>',
  strike: '<path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" y1="12" x2="20" y2="12"/>',
  superscript: '<path d="m4 19 8-8"/><path d="m12 19-8-8"/><path d="M20 12h-4c0-1.5.44-2 1.5-2.5S20 8.334 20 7.002c0-.472-.17-.93-.484-1.29a2.105 2.105 0 0 0-2.617-.436c-.42.239-.738.614-.899 1.06"/>',
  subscript: '<path d="m4 5 8 8"/><path d="m12 5-8 8"/><path d="M20 19h-4c0-1.5.44-2 1.5-2.5S20 15.334 20 14.002c0-.472-.17-.93-.484-1.29a2.105 2.105 0 0 0-2.617-.436c-.42.239-.738.614-.899 1.06"/>',

  // Colors
  color: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
  highlight: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
  fontSize: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',

  // Alignment
  alignLeft: '<line x1="21" y1="6" x2="3" y2="6"/><line x1="15" y1="12" x2="3" y2="12"/><line x1="17" y1="18" x2="3" y2="18"/>',
  alignCenter: '<line x1="21" y1="6" x2="3" y2="6"/><line x1="18" y1="12" x2="6" y2="12"/><line x1="21" y1="18" x2="3" y2="18"/>',
  alignRight: '<line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="12" x2="9" y2="12"/><line x1="21" y1="18" x2="7" y2="18"/>',
  alignJustify: '<line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="12" x2="3" y2="12"/><line x1="21" y1="18" x2="3" y2="18"/>',

  // Headings
  heading1: '<path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="m17 12 3-2v8"/>',
  heading2: '<path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/>',

  // Lists
  bulletList: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  numberedList: '<line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',

  // Insert
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  table: '<path d="M12 3v18"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
  emoji: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  quote: '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>',
  divider: '<line x1="4" y1="12" x2="20" y2="12"/>',
  file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>',

  // History
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  redo: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>',

  // Actions
  clearFormat: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 3l14 18"/>',
  preview: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><path d="M12 9v6"/>',
  move: '<polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>',
  drag: '<circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>',
  anchor: '<circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/>',
  wrap: '<path d="M3 6h18"/><path d="M3 12h15a3 3 0 1 1 0 6h-4"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
};

/**
 * Create an SVG icon element
 */
export function createIcon(
  iconName: EditorIconName,
  options: {
    size?: number;
    color?: string;
    strokeWidth?: number;
    className?: string;
  } = {}
): SVGSVGElement {
  const {
    size = 18,
    color = 'currentColor',
    strokeWidth = 2,
    className = '',
  } = options;

  const pathData = IconPaths[iconName];

  // Create SVG element
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', size.toString());
  svg.setAttribute('height', size.toString());
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', color);
  svg.setAttribute('stroke-width', strokeWidth.toString());
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  if (className) {
    svg.setAttribute('class', className);
  }

  // Set innerHTML with the path data
  svg.innerHTML = pathData;

  return svg;
}

/**
 * Create an icon as an HTML string (useful for dynamic HTML generation)
 */
export function createIconHTML(
  iconName: EditorIconName,
  options: {
    size?: number;
    color?: string;
    strokeWidth?: number;
    className?: string;
  } = {}
): string {
  const {
    size = 18,
    strokeWidth = 2,
    className = '',
  } = options;

  const pathData = IconPaths[iconName];

  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" ${className ? `class="${className}"` : ''}>${pathData}</svg>`;
}

/**
 * Replace emoji icons in buttons with proper SVG icons
 */
export function upgradeButtonIcon(
  button: HTMLElement,
  iconName: EditorIconName,
  options?: Parameters<typeof createIcon>[1]
): void {
  // Clear existing content
  button.innerHTML = '';

  // Add icon
  const icon = createIcon(iconName, options);
  button.appendChild(icon);
}

/**
 * Icon size presets for consistency
 */
export const IconSizes = {
  small: 14,
  medium: 18,
  large: 22,
  xlarge: 26,
} as const;

/**
 * Icon color presets (CSS variables)
 */
export const IconColors = {
  primary: 'var(--text-primary)',
  secondary: 'var(--text-secondary)',
  accent: 'var(--accent)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  error: 'var(--error)',
} as const;
