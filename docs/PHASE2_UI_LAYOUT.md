# Phase 2: UI Layout Documentation

## Application Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ScribeCat                          [Theme] [Settings]        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ [Start Recording]                                     │   │
│ │ Ready to record                                       │   │
│ │ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  (VU Meter)   │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                               │
│ ┌─────────────────────────────────┬──────────────────────┐  │
│ │                                 │ Recent Sessions      │  │
│ │ ┌─────────────────────────────┐ │                      │  │
│ │ │ Recording 9/30/2024 9:52PM  │ │ ┌──────────────────┐ │  │
│ │ │ Created: 9/30/2024 9:52PM   │ │ │ Recording 1      │ │  │
│ │ │ Duration: 42s               │ │ │ 9/30/2024 9:52PM │ │  │
│ │ └─────────────────────────────┘ │ │ Duration: 42s    │ │  │
│ │                                 │ │ [Load] [Delete]  │ │  │
│ │ ┌─────────────────────────────┐ │ └──────────────────┘ │  │
│ │ │                             │ │                      │  │
│ │ │                             │ │ ┌──────────────────┐ │  │
│ │ │ Start taking notes...       │ │ │ Recording 2      │ │  │
│ │ │                             │ │ │ 9/30/2024 9:40PM │ │  │
│ │ │                             │ │ │ Duration: 120s   │ │  │
│ │ │                             │ │ │ [Load] [Delete]  │ │  │
│ │ │                             │ │ └──────────────────┘ │  │
│ │ │                             │ │                      │  │
│ │ └─────────────────────────────┘ │ ┌──────────────────┐ │  │
│ │                                 │ │ Recording 3      │ │  │
│ │                                 │ │ 9/30/2024 9:30PM │ │  │
│ │                                 │ │ Duration: 85s    │ │  │
│ │                                 │ │ [Load] [Delete]  │ │  │
│ └─────────────────────────────────┴──┴──────────────────┴─┘ │
└─────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. Header
- **Application Title**: "ScribeCat"
- **Controls**: Theme toggle and Settings buttons
- **Styling**: White background with bottom border

### 2. Recording Section
- **Record Button**: Blue button that turns red when recording
- **Status Text**: Shows current recording state and duration
- **VU Meter**: Visual audio level indicator with gradient (green → yellow → red)
- **Styling**: White card with shadow, rounded corners

### 3. Content Area (Grid Layout)
Split into two columns:

#### Left Section (Main Content)
1. **Session Info Panel**
   - Display current session title
   - Show creation date
   - Show recording duration
   - White card with shadow

2. **Editor Section**
   - Toolbar area (placeholder for Phase 3)
   - Notes editor with contentEditable
   - Scrollable content area
   - White card with shadow

#### Right Section (Sidebar)
- **Session List**
  - Title: "Recent Sessions"
  - Scrollable list of sessions
  - Each session shows:
    - Title
    - Creation date
    - Duration
    - Load and Delete buttons
  - Hover effect on items
  - White card with shadow

## Color Scheme

### Primary Colors
- **Primary Blue**: `#007AFF` (buttons, links)
- **Primary Blue Hover**: `#0056CC`
- **Recording Red**: `#FF3B30` (active recording state)
- **Recording Red Hover**: `#CC2E26`

### Background Colors
- **App Background**: `#f5f5f5` (light gray)
- **Card Background**: `#ffffff` (white)
- **Surface**: `#f9f9f9` (hover states)

### Text Colors
- **Primary Text**: `#333333`
- **Secondary Text**: `#666666`
- **White Text**: `#ffffff`

### Status Colors
- **Success**: `#4CAF50` (green)
- **Error**: `#FF3B30` (red)
- **Warning**: `#FFC107` (yellow)

### Borders
- **Light Border**: `#e0e0e0`

## Responsive Behavior

### Grid Layout
- Main content area uses CSS Grid
- Left section: `1fr` (flexible)
- Right section: `300px` (fixed width)
- Gap between sections: `1rem`

### Overflow Handling
- Session list: scrollable vertically
- Notes editor: scrollable vertically
- Content areas have `overflow: hidden` to prevent layout issues

## Interactive Elements

### Buttons
- **Primary Action**: Blue background, white text
- **Destructive Action**: Red background, white text
- **Hover States**: Darker shade of base color
- **Transition**: 0.2s background-color

### VU Meter
- **Width**: 100% of container
- **Height**: 4px
- **Background**: Light gray (`#e0e0e0`)
- **Gradient**: Green → Yellow → Red
- **Transition**: 0.1s width (smooth animation)

### Session Items
- **Hover**: Light gray background
- **Click**: Load session
- **Buttons**: Inline actions (Load, Delete)

## Notifications

### Error Messages
- Position: Fixed top-right
- Background: Red
- Color: White
- Animation: Slide in from right
- Duration: 5 seconds

### Success Messages
- Position: Fixed top-right
- Background: Green
- Color: White
- Animation: Slide in from right
- Duration: 5 seconds

## Keyboard Shortcuts

### File Menu
- `Cmd/Ctrl + N`: New Session
- `Cmd/Ctrl + S`: Save Session

### Recording Menu
- `Cmd/Ctrl + R`: Start Recording
- `Cmd/Ctrl + Shift + R`: Stop Recording

### Export Menu
- Via menu: File > Export > [Format]

## Implementation Notes

1. **Layout**: Uses Flexbox and CSS Grid for responsive design
2. **Typography**: System font stack (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto)
3. **Spacing**: Consistent 1rem gaps between major sections
4. **Shadows**: Subtle `0 2px 4px rgba(0,0,0,0.1)` for depth
5. **Border Radius**: 8px for cards, 4-6px for buttons
6. **Auto-save**: Triggers every 30 seconds when a session is loaded
