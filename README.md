# roomer

A lightweight, browser-based 2D room furniture planner. No backend, no build step — just open `index.html`.

## Features

### Room
- **Freeform polygon editor** — click to place wall corners; click the first corner again to close the room
- **Rectangle shortcut** — enter width × height in the sidebar to generate a rectangular room
- Room vertices snap to the configurable grid and can be repositioned by dragging

### Doors & Windows
- Arm `+ Door` or `+ Window`, then click any wall to place an opening
- **Door** renders as a wall gap with a quarter-circle swing arc (standard floor-plan symbol)
- **Window** renders as a double line across the gap
- Click a placed opening to select and edit its width, position, hinge side, and swing direction
- Drag openings along their wall; placement and dragging both snap to the grid

### Furniture
- Five categories (Bed, Seating, Table, Storage, Other), each with a distinct color
- Built-in catalog of common items; add fully custom pieces with any name, size, and category
- **Custom shapes**: rectangle, oval, or freehand polygon (click to place vertices, close to finish)
- Drag to move (mouse + touch), **edge handles** to resize in place
- Rotate in 90° steps — labels stay upright regardless of rotation
- **Multi-select**: Shift+click to group items; drag, rotate, or delete the whole group at once
- Per-piece custom color with a reset-to-category button
- Selection panel: edit name, dimensions, position, and category
- Optional overlap detection highlights conflicting pieces

### Canvas
- Zoom (scroll wheel / pinch) and pan (drag empty space)
- Scale bar and optional wall-length / dimension annotations
- Collapsible sidebar

### Grid & Snap
- Configurable grid step (default 10 cm), toggleable
- Furniture, openings, and room vertices all snap to the grid when enabled
- Arrow keys nudge the selected item by one grid step

### Export / Import
- **Export** saves the current layout as JSON with a custom filename
- **Import** restores a previously exported layout

### Undo / Redo
- Full undo/redo history (up to 50 steps)
- Rapid consecutive moves are grouped into a single undo step

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `R` | Rotate selected furniture 90° |
| `Del` / `Backspace` | Delete selected item |
| `↑ ↓ ← →` | Move selected item(s) by one grid step |
| `Shift`+click | Add item to group selection |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Esc` | Deselect / exit placement mode |
| Scroll | Zoom in / out |
| Drag (empty space) | Pan |

## JSON Format

```json
{
  "room": {
    "vertices": [[0,0],[500,0],[500,400],[0,400]],
    "openings": [
      { "type": "door",   "wall": 0, "offset": 120, "width": 90,  "flip": false, "side": 1 },
      { "type": "window", "wall": 1, "offset": 80,  "width": 140, "flip": false, "side": 1 }
    ]
  },
  "furniture": [
    { "id": "abc123", "category": "bed", "name": "Double Bed", "width": 160, "depth": 200, "x": 50, "y": 50, "rotation": 0, "color": null }
  ],
  "grid": { "size": 10, "enabled": true }
}
```

## Tech Stack

- HTML5 Canvas + vanilla JS + plain CSS
- No frameworks, no build step, no dependencies

## Design

MD3-inspired design system: tonal surfaces, elevation shadows, CSS custom properties for all design tokens. Fonts: [Poppins](https://fonts.google.com/specimen/Poppins) and [DM Mono](https://fonts.google.com/specimen/DM+Mono) via Google Fonts.
