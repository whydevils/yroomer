# yroomer

A lightweight, browser-based 2D room furniture planner. No backend, no build step — just open `index.html`.

## Features

### Room
- **Freeform polygon editor** — click on the canvas to place wall corners; click the first corner again to close the room
- **Rectangle shortcut** — enter width × height in the sidebar to instantly generate a rectangular room
- Walls render with proper thickness; room interior is filled

### Doors & Windows
- Arm `+ Door` or `+ Window` in the sidebar, then click any wall segment to place an opening
- **Door** renders as a wall gap with a quarter-circle arc (standard floor-plan symbol)
- **Window** renders as a double line across the wall gap
- Click a placed opening to select it and edit its width, offset, hinge side, and swing direction
- Drag a selected opening along its wall to reposition it

### Furniture
- Six categories with color coding:
  | Category | Color |
  |---|---|
  | Bed | Muted blue `#7EB8D4` |
  | Seating | Teal `#5BA8A0` |
  | Table | Warm amber `#E8B84B` |
  | Storage | Warm brown `#C4956A` |
  | Other | Grey `#9E9E9E` |
- Built-in default items per category
- Add custom furniture with any name, category, width, and depth (in cm)
- Drag to move (mouse + touch)
- **Edge resize handles** — drag the midpoint handle on any side to resize in place
- Rotate in 90° steps (`R` key or button); labels stay upright regardless of rotation
- Per-piece custom color with reset-to-category button
- Edit name, dimensions (W/D), position (X/Y), and category in the selection panel
- Delete selected item (`Delete` key or button)
- Highlights red when overlapping another piece; cannot be dropped in an overlapping position

### Canvas
- Zoom with scroll wheel or pinch gesture
- Pan by right-dragging empty canvas space
- Zoom reset button
- Scale bar showing real-world cm
- Collapsible sidebar (hide/show with the `‹ ›` button)

### Grid & Snap
- Configurable grid step (default 10 cm), toggleable
- Furniture snaps to grid when enabled
- Arrow keys move selected item by one grid step

### Measurements
- Toggle wall-length measurements on/off

### Export / Import
- **Export** — downloads the current layout as `layout.json`
- **Import** — load a previously exported JSON to restore a full layout

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `R` | Rotate selected furniture 90° |
| `Del` / `Backspace` | Delete selected item |
| `↑ ↓ ← →` | Move selected item (one grid step) |
| `Esc` | Deselect / cancel placement mode |
| Scroll | Zoom in / out |
| Right-drag | Pan the canvas |

## JSON Format

```json
{
  "room": {
    "vertices": [[0,0],[500,0],[500,400],[0,400]],
    "openings": [
      { "type": "door", "wall": 0, "offset": 120, "width": 90, "flip": false, "side": 1 },
      { "type": "window", "wall": 1, "offset": 80, "width": 140, "flip": false, "side": 1 }
    ]
  },
  "furniture": [
    { "id": "abc123", "category": "bed", "name": "Double Bed", "width": 160, "depth": 200, "x": 50, "y": 50, "rotation": 0, "color": null }
  ],
  "grid": { "size": 10, "enabled": true }
}
```

## Tech Stack

- HTML5 + CSS3 + vanilla JavaScript
- HTML5 Canvas for rendering
- No frameworks, no build step, no dependencies

## Design

Plain CSS with an MD3-inspired design system (tonal surfaces, elevation shadows, proper contrast ratios). Color roles defined as CSS custom properties. Fonts: [Poppins](https://fonts.google.com/specimen/Poppins) and [DM Mono](https://fonts.google.com/specimen/DM+Mono) via Google Fonts.
