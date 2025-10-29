# Rich Text Editor Enhancement Implementation

## Overview
Enhance the existing EditorManager with advanced formatting capabilities including font selection, highlight colors, lists, alignment, undo/redo, and clear formatting.

## Current State
- ✅ Basic formatting: Bold, Italic, Underline
- ✅ Font size selection (12-24px)
- ✅ Text color picker
- ✅ Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U)
- ✅ Character and word count

## Features to Add

### 1. Font Family Selection (30 Fonts)
**Fonts to Include:**
- **Serif Fonts:** Georgia, Times New Roman, Garamond, Palatino, Baskerville
- **Sans-Serif Fonts:** Arial, Helvetica, Verdana, Tahoma, Trebuchet MS, Calibri, Segoe UI, Open Sans, Roboto, Lato
- **Monospace Fonts:** Courier New, Consolas, Monaco, Menlo, Source Code Pro
- **Display Fonts:** Impact, Comic Sans MS, Brush Script MT
- **System Fonts:** -apple-system, BlinkMacSystemFont
- **Academic Fonts:** Cambria, Book Antiqua, Century Gothic, Franklin Gothic

### 2. Highlight Color Picker
- Background color for selected text
- Separate from text color
- Color picker input similar to existing text color

### 3. List Controls
- Bullet list (unordered list)
- Numbered list (ordered list)
- Toggle on/off functionality

### 4. Text Alignment
- Left align (default)
- Center align
- Right align
- Justify

### 5. Undo/Redo
- Undo last action (Ctrl+Z)
- Redo last undone action (Ctrl+Y or Ctrl+Shift+Z)

### 6. Clear Formatting
- Remove all formatting from selected text
- Return to plain text

## Implementation Plan

### Phase 1: HTML Structure Updates
Add new toolbar elements to `index.html`:
```html
<!-- Font Family Selector -->
<select id="font-family-select" class="toolbar-select" title="Font Family">
  <!-- 30 font options -->
</select>

<!-- Highlight Color Picker -->
<input type="color" id="highlight-color-picker" class="color-picker" value="#ffff00" title="Highlight Color">

<div class="toolbar-divider"></div>

<!-- List Controls -->
<button id="bullet-list-btn" class="toolbar-btn" title="Bullet List">
  • List
</button>
<button id="numbered-list-btn" class="toolbar-btn" title="Numbered List">
  1. List
</button>

<div class="toolbar-divider"></div>

<!-- Alignment Controls -->
<button id="align-left-btn" class="toolbar-btn" title="Align Left">
  ⬅
</button>
<button id="align-center-btn" class="toolbar-btn" title="Align Center">
  ↔
</button>
<button id="align-right-btn" class="toolbar-btn" title="Align Right">
  ➡
</button>
<button id="align-justify-btn" class="toolbar-btn" title="Justify">
  ⬌
</button>

<div class="toolbar-divider"></div>

<!-- Undo/Redo -->
<button id="undo-btn" class="toolbar-btn" title="Undo (Ctrl+Z)">
  ↶
</button>
<button id="redo-btn" class="toolbar-btn" title="Redo (Ctrl+Y)">
  ↷
</button>

<div class="toolbar-divider"></div>

<!-- Clear Formatting -->
<button id="clear-format-btn" class="toolbar-btn" title="Clear Formatting">
  ✕
</button>
```

### Phase 2: EditorManager Updates
Extend `EditorManager.ts` with new functionality:

```typescript
export class EditorManager {
  // Add new element references
  private fontFamilySelect: HTMLSelectElement;
  private highlightColorPicker: HTMLInputElement;
  private bulletListBtn: HTMLButtonElement;
  private numberedListBtn: HTMLButtonElement;
  private alignLeftBtn: HTMLButtonElement;
  private alignCenterBtn: HTMLButtonElement;
  private alignRightBtn: HTMLButtonElement;
  private alignJustifyBtn: HTMLButtonElement;
  private undoBtn: HTMLButtonElement;
  private redoBtn: HTMLButtonElement;
  private clearFormatBtn: HTMLButtonElement;

  constructor() {
    // Initialize all elements
  }

  initialize(): void {
    // Add event listeners for all new controls
    this.fontFamilySelect.addEventListener('change', () => this.applyFontFamily());
    this.highlightColorPicker.addEventListener('change', () => this.applyHighlight());
    this.bulletListBtn.addEventListener('click', () => this.toggleList('unordered'));
    this.numberedListBtn.addEventListener('click', () => this.toggleList('ordered'));
    this.alignLeftBtn.addEventListener('click', () => this.applyAlignment('left'));
    this.alignCenterBtn.addEventListener('click', () => this.applyAlignment('center'));
    this.alignRightBtn.addEventListener('click', () => this.applyAlignment('right'));
    this.alignJustifyBtn.addEventListener('click', () => this.applyAlignment('justify'));
    this.undoBtn.addEventListener('click', () => this.undo());
    this.redoBtn.addEventListener('click', () => this.redo());
    this.clearFormatBtn.addEventListener('click', () => this.clearFormatting());

    // Add keyboard shortcuts
    this.notesEditor.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            if (e.shiftKey) {
              e.preventDefault();
              this.redo();
            } else {
              e.preventDefault();
              this.undo();
            }
            break;
          case 'y':
            e.preventDefault();
            this.redo();
            break;
        }
      }
    });
  }

  private applyFontFamily(): void {
    const font = this.fontFamilySelect.value;
    this.applyFormat('fontName', font);
  }

  private applyHighlight(): void {
    const color = this.highlightColorPicker.value;
    this.applyFormat('backColor', color);
  }

  private toggleList(type: 'ordered' | 'unordered'): void {
    const command = type === 'ordered' ? 'insertOrderedList' : 'insertUnorderedList';
    this.applyFormat(command);
  }

  private applyAlignment(align: 'left' | 'center' | 'right' | 'justify'): void {
    const commands = {
      left: 'justifyLeft',
      center: 'justifyCenter',
      right: 'justifyRight',
      justify: 'justifyFull'
    };
    this.applyFormat(commands[align]);
  }

  private undo(): void {
    document.execCommand('undo', false);
    this.notesEditor.focus();
  }

  private redo(): void {
    document.execCommand('redo', false);
    this.notesEditor.focus();
  }

  private clearFormatting(): void {
    this.applyFormat('removeFormat');
  }
}
```

### Phase 3: CSS Updates
Add styles for new toolbar elements in `styles.css`:

```css
/* Wider toolbar to accommodate new controls */
.formatting-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap; /* Allow wrapping if needed */
}

/* Font family selector - wider than font size */
#font-family-select {
  min-width: 150px;
}

/* List button styling */
.toolbar-btn {
  font-size: 12px;
  white-space: nowrap;
}

/* Active state for list and alignment buttons */
.toolbar-btn.active {
  background-color: var(--accent);
  border-color: var(--accent);
  color: white;
}
```

### Phase 4: Testing Checklist
- [ ] Font family changes apply correctly
- [ ] Highlight color works independently from text color
- [ ] Bullet lists toggle on/off
- [ ] Numbered lists toggle on/off
- [ ] All four alignment options work
- [ ] Undo/Redo work correctly
- [ ] Keyboard shortcuts (Ctrl+Z, Ctrl+Y) function
- [ ] Clear formatting removes all styles
- [ ] All buttons show active state when applicable
- [ ] Toolbar wraps gracefully on smaller screens
- [ ] Character/word count still updates correctly

## Font List (30 Fonts)

### Serif (5)
1. Georgia
2. Times New Roman
3. Garamond
4. Palatino
5. Baskerville

### Sans-Serif (10)
6. Arial
7. Helvetica
8. Verdana
9. Tahoma
10. Trebuchet MS
11. Calibri
12. Segoe UI
13. Open Sans
14. Roboto
15. Lato

### Monospace (5)
16. Courier New
17. Consolas
18. Monaco
19. Menlo
20. Source Code Pro

### Display (3)
21. Impact
22. Comic Sans MS
23. Brush Script MT

### System (2)
24. -apple-system
25. BlinkMacSystemFont

### Academic (5)
26. Cambria
27. Book Antiqua
28. Century Gothic
29. Franklin Gothic
30. Bookman

## Implementation Steps

1. **Update HTML** - Add all new toolbar elements
2. **Update EditorManager** - Add element references and event handlers
3. **Update CSS** - Style new elements and ensure responsive design
4. **Test Each Feature** - Verify all formatting options work
5. **Document** - Update README with new features

## Notes
- Use `document.execCommand()` for all formatting (consistent with existing code)
- Maintain keyboard shortcut support
- Ensure all buttons have proper tooltips
- Keep toolbar organized with dividers between logical groups
- Test on both macOS and Windows for keyboard shortcuts
