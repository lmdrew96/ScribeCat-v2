/**
 * ToolbarButton
 *
 * Reusable toolbar button component with icon support, tooltips, and state management.
 * Eliminates duplication between main editor and study mode editor toolbars.
 */

import { createIcon, type EditorIconName } from './EditorIcons.js';
import type { Editor } from '@tiptap/core';

export interface ToolbarButtonOptions {
  icon: EditorIconName;
  title: string;
  onClick: () => void;
  className?: string;
  isActive?: () => boolean;
  isDisabled?: () => boolean;
  shortcut?: string;
}

/**
 * Create a professional toolbar button
 */
export function createToolbarButton(options: ToolbarButtonOptions): HTMLButtonElement {
  const {
    icon,
    title,
    onClick,
    className = '',
    isActive,
    isDisabled,
    shortcut,
  } = options;

  const button = document.createElement('button');
  button.className = `toolbar-btn ${className}`;
  button.type = 'button';

  // Set tooltip with optional keyboard shortcut
  const tooltipText = shortcut ? `${title} • ${shortcut}` : title;
  button.setAttribute('title', tooltipText);

  // Add icon
  const iconElement = createIcon(icon, { size: 18, strokeWidth: 2 });
  button.appendChild(iconElement);

  // Handle click
  button.addEventListener('click', (e) => {
    e.preventDefault();
    onClick();
  });

  // Update active state if provided
  if (isActive) {
    const updateState = () => {
      if (isActive()) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    };
    // Store update function for external access
    (button as any)._updateState = updateState;
  }

  // Update disabled state if provided
  if (isDisabled) {
    const updateDisabled = () => {
      button.disabled = isDisabled();
    };
    (button as any)._updateDisabled = updateDisabled;
  }

  return button;
}

/**
 * Create a toolbar button group (visually grouped buttons)
 */
export function createToolbarGroup(buttons: HTMLElement[]): HTMLElement {
  const group = document.createElement('div');
  group.className = 'toolbar-group';

  buttons.forEach(button => {
    group.appendChild(button);
  });

  return group;
}

/**
 * Create a toolbar divider
 */
export function createToolbarDivider(): HTMLElement {
  const divider = document.createElement('div');
  divider.className = 'toolbar-divider';
  return divider;
}

/**
 * Common toolbar button configurations for both editors
 */
export function getCommonToolbarButtons(editor: Editor) {
  return {
    // Text formatting
    bold: createToolbarButton({
      icon: 'bold',
      title: 'Bold',
      shortcut: 'Ctrl+B',
      onClick: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive('bold'),
    }),

    code: createToolbarButton({
      icon: 'code',
      title: 'Inline Code',
      shortcut: 'Ctrl+E',
      onClick: () => editor.chain().focus().toggleCode().run(),
      isActive: () => editor.isActive('code'),
    }),

    italic: createToolbarButton({
      icon: 'italic',
      title: 'Italic',
      shortcut: 'Ctrl+I',
      onClick: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive('italic'),
    }),

    underline: createToolbarButton({
      icon: 'underline',
      title: 'Underline',
      shortcut: 'Ctrl+U',
      onClick: () => editor.chain().focus().toggleUnderline().run(),
      isActive: () => editor.isActive('underline'),
    }),

    strike: createToolbarButton({
      icon: 'strike',
      title: 'Strikethrough',
      shortcut: 'Ctrl+Shift+S',
      onClick: () => editor.chain().focus().toggleStrike().run(),
      isActive: () => editor.isActive('strike'),
    }),

    superscript: createToolbarButton({
      icon: 'superscript',
      title: 'Superscript',
      onClick: () => editor.chain().focus().toggleSuperscript().run(),
      isActive: () => editor.isActive('superscript'),
    }),

    subscript: createToolbarButton({
      icon: 'subscript',
      title: 'Subscript',
      onClick: () => editor.chain().focus().toggleSubscript().run(),
      isActive: () => editor.isActive('subscript'),
    }),

    // Alignment
    alignLeft: createToolbarButton({
      icon: 'alignLeft',
      title: 'Align Left',
      onClick: () => editor.chain().focus().setTextAlign('left').run(),
      isActive: () => editor.isActive({ textAlign: 'left' }),
    }),

    alignCenter: createToolbarButton({
      icon: 'alignCenter',
      title: 'Align Center',
      onClick: () => editor.chain().focus().setTextAlign('center').run(),
      isActive: () => editor.isActive({ textAlign: 'center' }),
    }),

    alignRight: createToolbarButton({
      icon: 'alignRight',
      title: 'Align Right',
      onClick: () => editor.chain().focus().setTextAlign('right').run(),
      isActive: () => editor.isActive({ textAlign: 'right' }),
    }),

    alignJustify: createToolbarButton({
      icon: 'alignJustify',
      title: 'Justify',
      onClick: () => editor.chain().focus().setTextAlign('justify').run(),
      isActive: () => editor.isActive({ textAlign: 'justify' }),
    }),

    // Headings
    heading1: createToolbarButton({
      icon: 'heading1',
      title: 'Heading 1',
      shortcut: 'Ctrl+Shift+H',
      onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: () => editor.isActive('heading', { level: 1 }),
    }),

    heading2: createToolbarButton({
      icon: 'heading2',
      title: 'Heading 2',
      shortcut: 'Ctrl+Alt+H',
      onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: () => editor.isActive('heading', { level: 2 }),
    }),

    // Lists
    bulletList: createToolbarButton({
      icon: 'bulletList',
      title: 'Bullet List',
      shortcut: 'Ctrl+Shift+8',
      onClick: () => editor.chain().focus().toggleBulletList().run(),
      isActive: () => editor.isActive('bulletList'),
    }),

    numberedList: createToolbarButton({
      icon: 'numberedList',
      title: 'Numbered List',
      shortcut: 'Ctrl+Shift+7',
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: () => editor.isActive('orderedList'),
    }),

    // History
    undo: createToolbarButton({
      icon: 'undo',
      title: 'Undo',
      shortcut: 'Ctrl+Z',
      onClick: () => editor.chain().focus().undo().run(),
      isDisabled: () => !editor.can().undo(),
    }),

    redo: createToolbarButton({
      icon: 'redo',
      title: 'Redo',
      shortcut: 'Ctrl+Y',
      onClick: () => editor.chain().focus().redo().run(),
      isDisabled: () => !editor.can().redo(),
    }),

    // Clear formatting
    clearFormat: createToolbarButton({
      icon: 'clearFormat',
      title: 'Clear Formatting',
      onClick: () => editor.chain().focus().clearNodes().unsetAllMarks().run(),
    }),

    // Enhanced content
    blockquote: createToolbarButton({
      icon: 'quote',
      title: 'Blockquote',
      shortcut: 'Ctrl+Shift+B',
      onClick: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: () => editor.isActive('blockquote'),
    }),

    codeBlock: createToolbarButton({
      icon: 'code',
      title: 'Code Block',
      shortcut: 'Ctrl+Alt+C',
      onClick: () => editor.chain().focus().toggleCodeBlock().run(),
      isActive: () => editor.isActive('codeBlock'),
    }),

    divider: createToolbarButton({
      icon: 'divider',
      title: 'Horizontal Rule',
      onClick: () => editor.chain().focus().setHorizontalRule().run(),
    }),
  };
}

/**
 * Update all button states in a toolbar
 */
export function updateToolbarButtonStates(buttons: Record<string, HTMLButtonElement>): void {
  Object.values(buttons).forEach(button => {
    // Update active state
    if ((button as any)._updateState) {
      (button as any)._updateState();
    }

    // Update disabled state
    if ((button as any)._updateDisabled) {
      (button as any)._updateDisabled();
    }
  });
}

/**
 * Create font size selector
 */
export function createFontSizeSelect(
  editor: Editor,
  options: {
    className?: string;
    sizes?: string[];
  } = {}
): HTMLSelectElement {
  const {
    className = '',
    sizes = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'],
  } = options;

  const select = document.createElement('select');
  select.className = `font-size-select ${className}`;
  select.setAttribute('title', 'Font Size');

  // Add default option
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Size';
  select.appendChild(defaultOption);

  // Add size options
  sizes.forEach(size => {
    const option = document.createElement('option');
    option.value = size;
    option.textContent = size;
    select.appendChild(option);
  });

  // Handle change
  select.addEventListener('change', (e) => {
    const size = (e.target as HTMLSelectElement).value;
    if (size) {
      editor.chain().focus().setFontSize(size).run();
    } else {
      editor.chain().focus().unsetFontSize().run();
    }
  });

  // Update on editor selection change
  editor.on('selectionUpdate', () => {
    const currentFontSize = editor.getAttributes('textStyle').fontSize || '';
    select.value = currentFontSize;
  });

  editor.on('update', () => {
    const currentFontSize = editor.getAttributes('textStyle').fontSize || '';
    select.value = currentFontSize;
  });

  return select;
}
