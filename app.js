'use strict';

// ============================================================
// CONSTANTS & CONFIG
// ============================================================

const CATEGORIES = {
  bed:      { label: 'Bed',               color: '#7EB8D4' },
  sofa:     { label: 'Seating',           color: '#5BA8A0' },
  table:    { label: 'Table',             color: '#E8B84B' },
  wardrobe: { label: 'Storage',           color: '#C4956A' },
  other:    { label: 'Other',             color: '#9E9E9E' },
};

const COLORS = {
  primary:        '#B5506B',  // --color-primary (vertex dots, selected stroke, scale bar, preview line)
  firstVertex:    '#FF6B35',  // distinctive orange for first polygon vertex
  wallStroke:     '#606060',  // closed wall segments
  doorStop:       '#8A8078',  // thin stop lines at door jambs
  openingDefault: '#888',     // unselected door/window stroke
  windowBlue:     '#5B9BD5',  // unselected window stroke + label
  overlapFill:    '#FFEBEE',  // furniture fill when overlapping
  overlapBorder:  '#C62828',  // furniture border + text when overlapping
  textDark:       '#1C1B1A',  // --color-on-surface (furniture labels, scale bar text)
  textDim:        '#555',     // subdued dimension text on furniture
  dimensionAnnot: '#605850',  // wall dimension annotation lines/text
  roomFill:       'rgba(250, 250, 248, 0.2)',
  scaleBarBg:     'rgba(255,255,255,0.85)',
  measurementBg:  'rgba(255,252,247,0.95)',
};

const FONTS = {
  body: "'Poppins', system-ui, sans-serif",  // matches --font-body in CSS
  mono: "'DM Mono', monospace",               // matches --font-mono in CSS
};

const DEFAULT_FURNITURE = [
  { category: 'bed',      name: 'Double Bed',      width: 160, depth: 200 },
  { category: 'bed',      name: 'Single Bed',       width: 90,  depth: 200 },
  { category: 'bed',      name: 'King Bed',         width: 180, depth: 200 },
  { category: 'sofa',     name: 'Sofa',             width: 220, depth: 90  },
  { category: 'sofa',     name: 'Armchair',         width: 90,  depth: 85  },
  { category: 'sofa',     name: 'Chair',            width: 50,  depth: 50  },
  { category: 'sofa',     name: 'Corner Sofa',      width: 250, depth: 180 },
  { category: 'table',    name: 'Dining Table',     width: 120, depth: 80  },
  { category: 'table',    name: 'Coffee Table',     width: 110, depth: 60  },
  { category: 'table',    name: 'Round Table',      width: 100, depth: 100 },
  { category: 'table',    name: 'Desk',             width: 140, depth: 70  },
  { category: 'table',    name: 'Corner Desk',      width: 160, depth: 120 },
  { category: 'wardrobe', name: 'Wardrobe',         width: 120, depth: 60  },
  { category: 'wardrobe', name: 'Bookshelf',        width: 80,  depth: 30  },
  { category: 'wardrobe', name: 'Chest of Drawers', width: 80,  depth: 50  },
  { category: 'other',    name: 'Bathtub',          width: 170, depth: 75  },
  { category: 'other',    name: 'Toilet',           width: 40,  depth: 65  },
  { category: 'other',    name: 'Washing Machine',  width: 60,  depth: 60  },
];

const WALL_WIDTH = 6;   // px at scale=1 (visual; actual thickness = WALL_WIDTH px always)
const SCALE_DEFAULT = 4; // px per cm
const CLOSE_RADIUS = 14; // px — click radius to close polygon
const MIN_ZOOM = 0.02;
const MAX_ZOOM = 5;
const MIN_RESIZE_SIZE = 20; // cm — minimum furniture dimension when dragging resize handles
const CENTER_PADDING  = 60; // px — canvas padding when fitting room to view

// ============================================================
// STATE
// ============================================================

let state = {
  // Room
  vertices: [],        // [{x, y}] in cm
  roomClosed: false,
  openings: [],        // {type, wall, offset, width} — wall = index of first vertex

  // Furniture
  furniture: [],       // {id, category, name, width, depth, x, y, rotation}

  // Interaction
  mode: 'draw',        // 'draw' | 'rect' | 'place-opening' | 'normal'
  selectedId: null,

  // Drag
  dragging: false,
  dragOffsetX: 0,
  dragOffsetY: 0,
  dragFurnitureId: null,

  // Resize
  resizing: false,
  resizeHandle: null,   // 'e' | 'w' | 'n' | 's'
  resizeStart: null,    // { roomX, roomY, width, depth, x, y }

  // Vertex drag
  dragVertexIndex: -1,

  // Opening drag
  dragOpeningIndex: -1,
  dragOpeningOffsetDelta: 0,
  selectedOpeningIndex: -1,

  // Pan
  panning: false,
  panStartX: 0,
  panStartY: 0,

  // View transform
  viewX: 0,    // canvas pixels
  viewY: 0,
  zoom: 1,

  // Grid
  gridEnabled: true,
  gridSize: 10, // cm

  // Measurements
  showMeasurements: true,

  // Opening placement
  openingType: 'door',
  openingWidth: 90,
  openingArmed: false,  // User has clicked "+ Door" or "+ Window"
};

// ============================================================
// DOM REFS
// ============================================================

const canvas = document.getElementById('room-canvas');
const ctx = canvas.getContext('2d');
const wrapper = document.getElementById('canvas-wrapper');
const hint = document.getElementById('canvas-hint');

function setRoomSectionState(roomExists) {
  const detailsRoom      = document.getElementById('details-room');
  const detailsOpenings  = document.getElementById('details-openings');
  const detailsFurniture = document.getElementById('details-furniture');
  if (roomExists) {
    detailsRoom.removeAttribute('open');
    detailsOpenings.setAttribute('open', '');
    detailsFurniture.setAttribute('open', '');
  } else {
    detailsOpenings.removeAttribute('open');
    detailsFurniture.removeAttribute('open');
  }
}

const tabDraw     = document.getElementById('tab-draw');
const tabRect     = document.getElementById('tab-rect');
const panelDraw   = document.getElementById('panel-draw');
const panelRect   = document.getElementById('panel-rect');

const btnUndoVertex  = document.getElementById('btn-undo-vertex');
const btnClearRoom   = document.getElementById('btn-clear-room');
const btnMakeRect    = document.getElementById('btn-make-rect');
const rectWidthEl    = document.getElementById('rect-width');
const rectDepthEl    = document.getElementById('rect-depth');

const openingWidthEl  = document.getElementById('opening-width');

const sectionSelected = document.getElementById('section-selected');
const selectedLabel   = document.getElementById('selected-label');
const btnRotate       = document.getElementById('btn-rotate');
const btnDelete       = document.getElementById('btn-delete');

const toggleGrid         = document.getElementById('toggle-grid');
const toggleMeasurements = document.getElementById('toggle-measurements');
const gridSizeEl         = document.getElementById('grid-size');
const btnZoomReset       = document.getElementById('btn-zoom-reset');

const btnExport     = document.getElementById('btn-export');
const importFile    = document.getElementById('import-file');

const furnitureCatalog = document.getElementById('furniture-catalog');
const sidebar = document.getElementById('sidebar');
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
const btnShowSidebar = document.getElementById('btn-show-sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');

// ============================================================
// UTILS
// ============================================================

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function snap(val, grid) {
  if (!state.gridEnabled || grid === 0) return val;
  return Math.round(val / grid) * grid;
}

/** Convert screen px → room cm */
function screenToRoom(sx, sy) {
  return {
    x: (sx - state.viewX) / state.zoom / SCALE_DEFAULT,
    y: (sy - state.viewY) / state.zoom / SCALE_DEFAULT,
  };
}

/** Convert room cm → screen px */
function roomToScreen(rx, ry) {
  return {
    x: rx * SCALE_DEFAULT * state.zoom + state.viewX,
    y: ry * SCALE_DEFAULT * state.zoom + state.viewY,
  };
}

function scale(cm) {
  return cm * SCALE_DEFAULT * state.zoom;
}

function resizeCanvas() {
  canvas.width  = wrapper.clientWidth;
  canvas.height = wrapper.clientHeight;
  draw();
}

// ============================================================
// POLYGON HELPERS
// ============================================================

/** Point-in-polygon (ray casting) */
function pointInPolygon(px, py, vertices) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

/** Get the 4 corners of a furniture item in room cm, accounting for rotation */
function furnitureCorners(f) {
  const cx = f.x + f.width / 2;
  const cy = f.y + f.depth / 2;
  const hw = f.width / 2;
  const hd = f.depth / 2;
  const rad = (f.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const local = [[-hw, -hd],[hw, -hd],[hw, hd],[-hw, hd]];
  return local.map(([lx, ly]) => ({
    x: cx + lx * cos - ly * sin,
    y: cy + lx * sin + ly * cos,
  }));
}

/** Separating axis theorem overlap between two furniture items */
function furnitureOverlap(a, b) {
  const cornersA = furnitureCorners(a);
  const cornersB = furnitureCorners(b);
  const axes = getAxes(cornersA).concat(getAxes(cornersB));
  for (const axis of axes) {
    const [minA, maxA] = project(cornersA, axis);
    const [minB, maxB] = project(cornersB, axis);
    if (maxA <= minB || maxB <= minA) return false;
  }
  return true;
}

function getAxes(corners) {
  const axes = [];
  for (let i = 0; i < corners.length; i++) {
    const j = (i + 1) % corners.length;
    const dx = corners[j].x - corners[i].x;
    const dy = corners[j].y - corners[i].y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    axes.push({ x: -dy / len, y: dx / len });
  }
  return axes;
}

function project(corners, axis) {
  const dots = corners.map(c => c.x * axis.x + c.y * axis.y);
  return [Math.min(...dots), Math.max(...dots)];
}

function anyOverlap(target, excludeId) {
  return state.furniture.some(f => {
    if (f.id === excludeId) return false;
    return furnitureOverlap(target, f);
  });
}

// ============================================================
// WALL / OPENING HELPERS
// ============================================================

function getWalls() {
  const verts = state.vertices;
  const walls = [];
  for (let i = 0; i < verts.length; i++) {
    const j = (i + 1) % verts.length;
    walls.push({ i, j, a: verts[i], b: verts[j] });
  }
  return walls;
}

/**
 * Find the closest wall to a room-space point.
 * Returns { wallIndex, offset (cm along wall), dist (screen px) }
 */
function closestWall(roomX, roomY) {
  const walls = getWalls();
  let best = null;
  for (const wall of walls) {
    const ax = wall.a.x, ay = wall.a.y;
    const bx = wall.b.x, by = wall.b.y;
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;
    let t = ((roomX - ax) * dx + (roomY - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const nx = ax + t * dx - roomX;
    const ny = ay + t * dy - roomY;
    const dist = Math.sqrt(nx * nx + ny * ny);
    if (!best || dist < best.dist) {
      const wallLen = Math.sqrt(lenSq);
      best = { wallIndex: wall.i, offset: t * wallLen, dist };
    }
  }
  return best;
}

// ============================================================
// GRID BACKGROUND
// ============================================================

function drawGrid() {
  if (!state.gridEnabled) return;
  const cellPx = state.gridSize * SCALE_DEFAULT * state.zoom;

  // Keep doubling the visual step until dots are at least 24 px apart.
  // Always a power-of-2 multiple of the base grid unit, so dots stay meaningful.
  const MIN_DOT_SPACING = 20;
  let step = cellPx;
  while (step < MIN_DOT_SPACING) step *= 2;

  const w = canvas.width, h = canvas.height;
  const startX = ((state.viewX % step) + step) % step;
  const startY = ((state.viewY % step) + step) % step;

  ctx.save();
  ctx.fillStyle = '#EAE3D9'; // --color-outline-variant
  for (let x = startX; x < w; x += step) {
    for (let y = startY; y < h; y += step) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ============================================================
// DRAW
// ============================================================

function draw() {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  drawGrid();

  // Cursor preview in draw mode — shown even before the first vertex is placed
  if (!state.roomClosed && state.mode === 'draw' && state._cursorRoom) {
    drawDrawingPreview();
  }

  if (state.vertices.length === 0) return;

  ctx.save();
  ctx.translate(state.viewX, state.viewY);
  ctx.scale(state.zoom * SCALE_DEFAULT, state.zoom * SCALE_DEFAULT);

  drawRoom();
  drawFurniture();
  if (state.showMeasurements) {
    drawRoomDimensions();
    drawScaleBar();
  }

  ctx.restore();
}

function drawRoom() {
  if (state.vertices.length < 2) {
    // Just dots
    ctx.fillStyle = COLORS.primary;
    for (const v of state.vertices) {
      ctx.beginPath();
      ctx.arc(v.x, v.y, 4 / (state.zoom * SCALE_DEFAULT), 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  const verts = state.vertices;
  const wallW = WALL_WIDTH / (state.zoom * SCALE_DEFAULT);

  // --- Clip mask: fill interior ---
  ctx.beginPath();
  ctx.moveTo(verts[0].x, verts[0].y);
  for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
  if (state.roomClosed) ctx.closePath();

  if (state.roomClosed) {
    ctx.fillStyle = COLORS.roomFill;
    ctx.fill();
  }

  // --- Walls ---
  if (state.roomClosed) {
    const walls = getWalls();
    for (let wi = 0; wi < walls.length; wi++) {
      const wall = walls[wi];
      const openingIndices = state.openings
        .map((o, i) => (o.wall === wi ? i : -1))
        .filter(i => i >= 0);
      const openingsOnWall = openingIndices.map(i => state.openings[i]);
      drawWallWithOpenings(wall.a, wall.b, openingsOnWall, wallW, openingIndices);
    }
  } else {
    // Partial wall (still drawing)
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
    ctx.strokeStyle = COLORS.primary;
    ctx.lineWidth = wallW;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // --- Vertex dots ---
  if (!state.roomClosed) {
    for (let i = 0; i < verts.length; i++) {
      const v = verts[i];
      ctx.beginPath();
      ctx.arc(v.x, v.y, 5 / (state.zoom * SCALE_DEFAULT), 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? COLORS.firstVertex : COLORS.primary;
      ctx.fill();
    }
  } else {
    // Show draggable vertex handles on closed room
    const r = 5 / (state.zoom * SCALE_DEFAULT);
    for (let i = 0; i < verts.length; i++) {
      const v = verts[i];
      const isDragging = i === state.dragVertexIndex;
      ctx.beginPath();
      ctx.arc(v.x, v.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isDragging ? COLORS.primary : COLORS.scaleBarBg;
      ctx.fill();
      ctx.strokeStyle = COLORS.primary;
      ctx.lineWidth = (isDragging ? 2 : 1.5) / (state.zoom * SCALE_DEFAULT);
      ctx.stroke();
    }
  }
}

function drawWallWithOpenings(a, b, openings, wallW, openingIndices = []) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const wallLen = Math.sqrt(dx * dx + dy * dy);
  if (wallLen === 0) return;
  const ux = dx / wallLen, uy = dy / wallLen; // unit along wall
  const nx = -uy, ny = ux;                    // unit normal (inward)

  // Sort openings by offset, preserving original indices
  const sorted = openings
    .map((op, idx) => ({ op, opIndex: openingIndices[idx] }))
    .sort((p, q) => p.op.offset - q.op.offset);

  // Build segments between openings
  const segments = [];
  let cur = 0;
  for (const item of sorted) {
    const op = item.op;
    const opIndex = item.opIndex;
    const start = op.offset;
    const end   = op.offset + op.width;
    if (cur < start) segments.push({ from: cur, to: start, type: 'wall' });
    segments.push({ from: start, to: Math.min(end, wallLen), type: op.type, op, opIndex });
    cur = Math.min(end, wallLen);
  }
  if (cur < wallLen) segments.push({ from: cur, to: wallLen, type: 'wall' });

  for (const seg of segments) {
    const p1 = { x: a.x + ux * seg.from, y: a.y + uy * seg.from };
    const p2 = { x: a.x + ux * seg.to,   y: a.y + uy * seg.to   };
    const isSelected = seg.opIndex === state.selectedOpeningIndex;

    if (seg.type === 'wall') {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = COLORS.wallStroke;
      ctx.lineWidth = wallW;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    } else if (seg.type === 'door') {
      const radius = seg.to - seg.from;
      const op = seg.op;

      // Hinge at p1 (flip=false) or p2 (flip=true)
      const hingePoint = op.flip ? p2 : p1;
      const tipPoint   = op.flip ? p1 : p2;

      // Angle from hinge toward tip (along the wall)
      const leafAngle = Math.atan2(tipPoint.y - hingePoint.y, tipPoint.x - hingePoint.x);

      // When hinge flips, leafAngle rotates 180°, which would push the arc to the
      // opposite side of the wall. Compensate by negating side so the arc stays
      // on the same wall-side regardless of which end the hinge is on.
      const effectiveSide = op.flip ? -op.side : op.side;
      const arcEndAngle   = leafAngle + (effectiveSide * Math.PI / 2);
      const anticlockwise = effectiveSide < 0;

      // Stop lines at both ends of the opening
      ctx.strokeStyle = COLORS.doorStop;
      ctx.lineWidth = wallW * 0.25;
      for (const pt of [p1, p2]) {
        ctx.beginPath();
        ctx.moveTo(pt.x - nx * wallW * 0.5, pt.y - ny * wallW * 0.5);
        ctx.lineTo(pt.x + nx * wallW * 0.5, pt.y + ny * wallW * 0.5);
        ctx.stroke();
      }

      // Door leaf (closed position — line from hinge to tip)
      ctx.beginPath();
      ctx.moveTo(hingePoint.x, hingePoint.y);
      ctx.lineTo(tipPoint.x, tipPoint.y);
      ctx.strokeStyle = isSelected ? COLORS.primary : COLORS.openingDefault;
      ctx.lineWidth = wallW * 0.25;
      ctx.setLineDash([]);
      ctx.stroke();

      // Swing arc (quarter circle) — always exactly PI/2, direction via anticlockwise flag
      ctx.beginPath();
      ctx.arc(hingePoint.x, hingePoint.y, radius, leafAngle, arcEndAngle, anticlockwise);
      ctx.strokeStyle = isSelected ? COLORS.primary : COLORS.openingDefault;
      ctx.lineWidth = isSelected ? (wallW * 0.4) : (wallW * 0.2);
      ctx.setLineDash([4 / (state.zoom * SCALE_DEFAULT), 3 / (state.zoom * SCALE_DEFAULT)]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (seg.type === 'window') {
      const inset = wallW * 0.25;
      // Double line
      for (const sign of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(p1.x + nx * inset * sign, p1.y + ny * inset * sign);
        ctx.lineTo(p2.x + nx * inset * sign, p2.y + ny * inset * sign);
        ctx.strokeStyle = isSelected ? COLORS.primary : COLORS.windowBlue;
        ctx.lineWidth = wallW * (isSelected ? 0.4 : 0.2);
        ctx.stroke();
      }

      // Selection highlight box — aligned with the wall direction
      if (isSelected) {
        const m = wallW * 0.3;   // margin along wall
        const t = wallW * 0.3;   // half-thickness across wall
        ctx.beginPath();
        ctx.moveTo(p1.x - ux * m - nx * t, p1.y - uy * m - ny * t);
        ctx.lineTo(p2.x + ux * m - nx * t, p2.y + uy * m - ny * t);
        ctx.lineTo(p2.x + ux * m + nx * t, p2.y + uy * m + ny * t);
        ctx.lineTo(p1.x - ux * m + nx * t, p1.y - uy * m + ny * t);
        ctx.closePath();
        ctx.strokeStyle = COLORS.primary;
        ctx.lineWidth = wallW * 0.3;
        ctx.stroke();
      }
    }

    // Opening width label (offset along wall normal so it sits outside the wall)
    if (state.showMeasurements && (seg.type === 'door' || seg.type === 'window')) {
      const px = 1 / (state.zoom * SCALE_DEFAULT);
      const fs = 9 * px;
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const label = `${Math.round(seg.op.width)}`;
      ctx.font = `500 ${fs}px ${FONTS.mono}`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      const off = wallW * 2;
      const lx = midX - nx * off;
      const ly = midY - ny * off;
      ctx.fillStyle = seg.type === 'door' ? COLORS.openingDefault : COLORS.windowBlue;
      ctx.fillText(label, lx, ly);
    }
  }
}

function drawFurniture() {
  for (const f of state.furniture) {
    const isSelected = f.id === state.selectedId;
    const overlap    = anyOverlap(f, f.id);

    ctx.save();
    ctx.globalAlpha = 0.7;

    const cx = f.x + f.width / 2;
    const cy = f.y + f.depth / 2;
    ctx.translate(cx, cy);
    ctx.rotate((f.rotation * Math.PI) / 180);

    const hw = f.width / 2, hd = f.depth / 2;
    const r  = 3 / (state.zoom * SCALE_DEFAULT);

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur  = 6 / (state.zoom * SCALE_DEFAULT);
    ctx.shadowOffsetY = 2 / (state.zoom * SCALE_DEFAULT);

    // Fill
    const cat = CATEGORIES[f.category] || CATEGORIES.other;
    const baseColor = f.color || cat.color;
    ctx.fillStyle = overlap ? COLORS.overlapFill : baseColor + 'CC';
    roundRect(ctx, -hw, -hd, f.width, f.depth, r);
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // Border
    ctx.strokeStyle = overlap ? COLORS.overlapBorder : (isSelected ? COLORS.textDark : baseColor);
    ctx.lineWidth = (isSelected ? 2.5 : 1.5) / (state.zoom * SCALE_DEFAULT);
    roundRect(ctx, -hw, -hd, f.width, f.depth, r);
    ctx.stroke();

    // Label (counter-rotate so text stays horizontal)
    const fontSize = Math.max(6, Math.min(9, f.width * 0.07));
    // Clip label to box
    ctx.save();
    roundRect(ctx, -hw, -hd, f.width, f.depth, r);
    ctx.clip();
    // Counter-rotate for text — after this, drawing coords are in furniture-local space.
    ctx.rotate(-(f.rotation * Math.PI) / 180);
    // Compute available horizontal span for text in the counter-rotated (local) frame.
    const cosA = Math.abs(Math.cos(f.rotation * Math.PI / 180));
    const sinA = Math.abs(Math.sin(f.rotation * Math.PI / 180));
    let availW;
    if (sinA < 1e-6)      availW = f.width;
    else if (cosA < 1e-6) availW = f.depth;
    else                  availW = Math.min(hw / cosA, hd / sinA) * 2;
    const textMaxW = availW * 0.88; // slight inner margin
    ctx.fillStyle = overlap ? COLORS.overlapBorder : COLORS.textDark;
    ctx.font = `500 ${fontSize}px ${FONTS.body}`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    const nameLines = wrapText(ctx, f.name, textMaxW);
    const lineH = fontSize * 1.25;
    const dimSize = 6; // fixed size for all furniture
    const hasDim = state.showMeasurements;
    const totalH = nameLines.length * lineH + (hasDim ? dimSize * 1.4 : 0);
    let yOff = -totalH / 2 + lineH / 2;
    for (const ln of nameLines) {
      ctx.fillText(ln, 0, yOff);
      yOff += lineH;
    }
    if (hasDim) {
      yOff += dimSize * 0.1;
      ctx.font = `400 ${dimSize}px ${FONTS.mono}`;
      ctx.fillStyle = overlap ? COLORS.overlapBorder : COLORS.textDim;
      const fmt = v => parseFloat(v.toFixed(2));
      ctx.fillText(`${fmt(f.width)}×${fmt(f.depth)}`, 0, yOff);
    }
    ctx.restore();

    // Resize handles (edge midpoints)
    if (isSelected) {
      const hSize = 6 / (state.zoom * SCALE_DEFAULT);
      ctx.fillStyle = COLORS.primary;
      // East (right edge midpoint)
      ctx.beginPath();
      ctx.arc(hw, 0, hSize, 0, Math.PI * 2);
      ctx.fill();
      // West (left edge midpoint)
      ctx.beginPath();
      ctx.arc(-hw, 0, hSize, 0, Math.PI * 2);
      ctx.fill();
      // South (bottom edge midpoint)
      ctx.beginPath();
      ctx.arc(0, hd, hSize, 0, Math.PI * 2);
      ctx.fill();
      // North (top edge midpoint)
      ctx.beginPath();
      ctx.arc(0, -hd, hSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawScaleBar() {
  if (!state.roomClosed) return;
  // Draw in canvas-space (not room-space), so we undo the transform temporarily
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const barCm   = 100;
  const barPx   = barCm * SCALE_DEFAULT * state.zoom;
  const x       = 20;
  const y       = canvas.height - 24;
  const h       = 5;

  ctx.fillStyle = COLORS.scaleBarBg;
  ctx.fillRect(x - 4, y - 10, barPx + 8, 20);

  ctx.fillStyle   = COLORS.primary;
  ctx.fillRect(x, y, barPx, h);

  ctx.font        = `11px ${FONTS.body}`;
  ctx.fillStyle   = COLORS.textDark;
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${barCm} cm`, x + barPx / 2, y - 2);

  ctx.restore();
}

function drawDrawingPreview() {
  const cur = state._cursorRoom;
  if (!cur) return;

  const cs = roomToScreen(cur.x, cur.y);

  ctx.save();

  // Snapped cursor dot
  ctx.beginPath();
  ctx.arc(cs.x, cs.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.primary;
  ctx.fill();

  if (state.vertices.length === 0) {
    ctx.restore();
    return;
  }

  const last = state.vertices[state.vertices.length - 1];
  const ls   = roomToScreen(last.x, last.y);

  // Preview line
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = COLORS.primary;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(ls.x, ls.y);
  ctx.lineTo(cs.x, cs.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Wall length label at midpoint
  if (state.showMeasurements) {
    const dx   = cur.x - last.x, dy = cur.y - last.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      const mx = (ls.x + cs.x) / 2;
      const my = (ls.y + cs.y) / 2;
      const label = `${Math.round(dist)} cm`;
      ctx.font = `600 11px ${FONTS.mono}`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = COLORS.measurementBg;
      ctx.fillRect(mx - tw / 2 - 5, my - 9, tw + 10, 18);
      ctx.fillStyle = COLORS.primary;
      ctx.fillText(label, mx, my);
    }
  }

  ctx.restore();
}

function drawRoomDimensions() {
  if (state.vertices.length < 2) return;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const v of state.vertices) {
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
  }
  const W = maxX - minX, H = maxY - minY;
  if (W < 1 && H < 1) return;

  const px  = 1 / (state.zoom * SCALE_DEFAULT); // 1 screen-px in room-cm
  const gap  = 22 * px;
  const tick = 4 * px;

  ctx.save();
  ctx.lineWidth   = px;
  ctx.strokeStyle = 'rgba(140,130,120,0.7)';
  ctx.fillStyle   = COLORS.dimensionAnnot;
  ctx.font        = `500 ${11 * px}px ${FONTS.mono}`;

  // Width annotation (above bounding box)
  if (W > 1) {
    const wY = minY - gap;
    ctx.setLineDash([3 * px, 3 * px]);
    ctx.beginPath();
    ctx.moveTo(minX, wY); ctx.lineTo(maxX, wY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(minX, wY - tick); ctx.lineTo(minX, wY + tick);
    ctx.moveTo(maxX, wY - tick); ctx.lineTo(maxX, wY + tick);
    ctx.stroke();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${Math.round(W)}`, (minX + maxX) / 2, wY - 2 * px);
  }

  // Height annotation (right of bounding box)
  if (H > 1) {
    const hX = maxX + gap;
    ctx.setLineDash([3 * px, 3 * px]);
    ctx.beginPath();
    ctx.moveTo(hX, minY); ctx.lineTo(hX, maxY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(hX - tick, minY); ctx.lineTo(hX + tick, minY);
    ctx.moveTo(hX - tick, maxY); ctx.lineTo(hX + tick, maxY);
    ctx.stroke();
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(H)}`, hX + tick + 3 * px, (minY + maxY) / 2);
  }

  ctx.restore();
}

/** Split `text` into lines that fit within `maxWidth` in the current ctx font. */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ============================================================
// CATALOG UI
// ============================================================

function buildCatalog() {
  furnitureCatalog.innerHTML = '';
  for (const [catKey, catInfo] of Object.entries(CATEGORIES)) {
    const items = DEFAULT_FURNITURE.filter(f => f.category === catKey);

    const catEl = document.createElement('div');
    catEl.className = 'catalog-category';

    const header = document.createElement('div');
    header.className = 'catalog-category-header';
    header.innerHTML = `
      <span class="category-dot" style="background:${catInfo.color}"></span>
      <span class="catalog-category-name">${catInfo.label}</span>
      <span class="catalog-category-arrow">▶</span>
    `;
    header.addEventListener('click', () => catEl.classList.toggle('open'));

    const list = document.createElement('div');
    list.className = 'catalog-items';

    for (const item of items) {
      const el = document.createElement('div');
      el.className = 'catalog-item';
      el.innerHTML = `
        <span class="catalog-item-name">${item.name}</span>
        <span class="catalog-item-size">${item.width}×${item.depth}</span>
      `;
      el.addEventListener('click', () => addFurnitureToRoom(item.category, item.name, item.width, item.depth));
      list.appendChild(el);
    }

    catEl.appendChild(header);
    catEl.appendChild(list);
    furnitureCatalog.appendChild(catEl);
  }
}

function addFurnitureToRoom(category, name, width, depth) {
  if (!state.roomClosed) {
    alert('Please draw and close a room first.');
    return;
  }
  // Place at centre of room bounding box
  let cx = 0, cy = 0;
  for (const v of state.vertices) { cx += v.x; cy += v.y; }
  cx = Math.round(cx / state.vertices.length - width / 2);
  cy = Math.round(cy / state.vertices.length - depth / 2);

  const f = { id: uid(), category, name, width, depth, x: snap(cx, state.gridSize), y: snap(cy, state.gridSize), rotation: 0 };
  state.furniture.push(f);
  selectFurniture(f.id);
  draw();
}

// ============================================================
// SELECTION
// ============================================================

function selectFurniture(id) {
  state.selectedId = id;
  state.selectedOpeningIndex = -1;
  sidebar.scrollTop = 0;
  const f = state.furniture.find(f => f.id === id);
  if (f) {
    sectionSelected.classList.remove('hidden');
    selectedLabel.textContent = f.name;
    furnitureControls.classList.remove('hidden');
    openingControlsSelected.classList.add('hidden');
    populateFurnitureInputs(f);
  } else {
    sectionSelected.classList.add('hidden');
    state.selectedId = null;
  }
  draw();
}

function selectOpening(oi) {
  state.selectedOpeningIndex = oi;
  state.selectedId = null;
  sidebar.scrollTop = 0;
  const op = state.openings[oi];
  if (op) {
    sectionSelected.classList.remove('hidden');
    selectedLabel.textContent = (op.type === 'door' ? '🚪 ' : '🪟 ') + (op.type.charAt(0).toUpperCase() + op.type.slice(1));
    furnitureControls.classList.add('hidden');
    openingControlsSelected.classList.remove('hidden');
    // Populate inputs
    openingTypeSelect.value = op.type;
    openingWidthSelected.value = op.width;
    openingOffsetSelected.value = Math.round(op.offset);
    btnFlipDoor.style.display = op.type === 'door' ? 'inline-flex' : 'none';
    btnSwingDoor.style.display = op.type === 'door' ? 'inline-flex' : 'none';
  }
  draw();
}

function deselectAllFurniture() {
  state.selectedId = null;
}

function deselectAll() {
  state.selectedId = null;
  state.selectedOpeningIndex = -1;
  sectionSelected.classList.add('hidden');
  draw();
}

// ============================================================
// HIT TESTING
// ============================================================

function furnitureAt(rx, ry) {
  // Reverse order so top-most is picked first
  for (let i = state.furniture.length - 1; i >= 0; i--) {
    const f = state.furniture[i];
    const cx = f.x + f.width / 2;
    const cy = f.y + f.depth / 2;
    const dx = rx - cx, dy = ry - cy;
    const rad = -(f.rotation * Math.PI) / 180;
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
    if (Math.abs(lx) <= f.width / 2 && Math.abs(ly) <= f.depth / 2) return f;
  }
  return null;
}

/**
 * Check if a room point is near a resize handle of the selected furniture.
 * Returns handle name ('e', 'w', 'n', 's') or null.
 */
function resizeHandleAt(rx, ry) {
  if (!state.selectedId) return null;
  const f = state.furniture.find(f => f.id === state.selectedId);
  if (!f) return null;

  const tolerance = 15 / (state.zoom * SCALE_DEFAULT); // ~15 screen-px
  const cx = f.x + f.width / 2;
  const cy = f.y + f.depth / 2;
  const dx = rx - cx, dy = ry - cy;
  const rad = -(f.rotation * Math.PI) / 180;
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
  const hw = f.width / 2, hd = f.depth / 2;

  const handles = [
    { name: 'e', x: hw, y: 0 },
    { name: 'w', x: -hw, y: 0 },
    { name: 's', x: 0, y: hd },
    { name: 'n', x: 0, y: -hd },
  ];

  for (const h of handles) {
    const dist = Math.sqrt((lx - h.x) ** 2 + (ly - h.y) ** 2);
    if (dist < tolerance) return h.name;
  }
  return null;
}

/** Returns index into state.vertices within ~10 screen-px, or -1 */
function vertexAt(rx, ry) {
  const tolerance = 10 / (state.zoom * SCALE_DEFAULT);
  for (let i = 0; i < state.vertices.length; i++) {
    const v = state.vertices[i];
    if (Math.sqrt((rx - v.x) ** 2 + (ry - v.y) ** 2) < tolerance) return i;
  }
  return -1;
}

/** Returns index into state.openings, or -1 */
function openingAt(rx, ry) {
  const walls = getWalls();
  const tolerance = 30 / (state.zoom * SCALE_DEFAULT); // 30 screen-px expressed in room-cm
  for (let oi = 0; oi < state.openings.length; oi++) {
    const op = state.openings[oi];
    const wall = walls[op.wall];
    if (!wall) continue;
    const dx = wall.b.x - wall.a.x;
    const dy = wall.b.y - wall.a.y;
    const wallLen = Math.sqrt(dx * dx + dy * dy);
    if (wallLen === 0) continue;
    const ux = dx / wallLen, uy = dy / wallLen;
    // Signed distance along wall
    const t = (rx - wall.a.x) * ux + (ry - wall.a.y) * uy;
    if (t < op.offset - tolerance || t > op.offset + op.width + tolerance) continue;
    // Perpendicular distance from the wall line
    const cx = wall.a.x + t * ux;
    const cy = wall.a.y + t * uy;
    if (Math.sqrt((cx - rx) ** 2 + (cy - ry) ** 2) < tolerance) return oi;
  }
  return -1;
}

// ============================================================
// CANVAS EVENTS
// ============================================================

function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  if (e.touches) {
    return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
  }
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

canvas.addEventListener('mousemove', onPointerMove);
canvas.addEventListener('mousedown', onPointerDown);
canvas.addEventListener('mouseup',   onPointerUp);
let lastTouchDist = null;

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    lastTouchDist = Math.sqrt(dx * dx + dy * dy);
    onPointerUp(e); // cancel any in-progress single-finger action
  } else {
    lastTouchDist = null;
    onPointerDown(e);
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (lastTouchDist !== null && dist > 0) {
      const ratio = dist / lastTouchDist;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.zoom * ratio));
      const rect = canvas.getBoundingClientRect();
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      state.viewX = midX - (midX - state.viewX) * (newZoom / state.zoom);
      state.viewY = midY - (midY - state.viewY) * (newZoom / state.zoom);
      state.zoom  = newZoom;
      draw();
    }
    lastTouchDist = dist;
  } else {
    lastTouchDist = null;
    onPointerMove(e);
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  if (e.touches.length < 2) lastTouchDist = null;
  onPointerUp(e);
}, { passive: false });

canvas.addEventListener('touchcancel', e => {
  lastTouchDist = null;
  onPointerUp(e);
}, { passive: false });

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const pos = getCanvasPos(e);
  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.91;
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.zoom * zoomFactor));
  // Zoom toward cursor
  state.viewX = pos.x - (pos.x - state.viewX) * (newZoom / state.zoom);
  state.viewY = pos.y - (pos.y - state.viewY) * (newZoom / state.zoom);
  state.zoom  = newZoom;
  draw();
}, { passive: false });

function onPointerMove(e) {
  const pos  = getCanvasPos(e);
  const room = screenToRoom(pos.x, pos.y);

  // Drawing cursor preview — snap to grid, works before first vertex too
  if (!state.roomClosed && state.mode === 'draw') {
    state._cursorRoom = { x: snap(room.x, state.gridSize), y: snap(room.y, state.gridSize) };
    draw();
  }

  // Vertex dragging
  if (state.dragVertexIndex >= 0) {
    state.vertices[state.dragVertexIndex] = { x: snap(room.x, state.gridSize), y: snap(room.y, state.gridSize) };
    draw();
    return;
  }

  // Resizing furniture
  if (state.resizing && state.resizeHandle && state.resizeStart) {
    const f = state.furniture.find(f => f.id === state.selectedId);
    if (f) {
      const startData = state.resizeStart;
      const dx = room.x - startData.roomX;
      const dy = room.y - startData.roomY;

      // Convert delta to furniture-local space
      const rad = -(startData.rotation * Math.PI) / 180;
      const localDx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const localDy = dx * Math.sin(rad) + dy * Math.cos(rad);

      let newWidth = startData.width;
      let newDepth = startData.depth;
      let newX = startData.x;
      let newY = startData.y;

      const cosR = Math.cos(rad);
      const sinR = Math.sin(rad);

      // One-sided resize: the opposite edge is anchored in world space.
      // f.x/f.y is the top-left of the unrotated bbox; the element rotates around
      // its centre (f.x + w/2, f.y + d/2). When one edge moves, the centre shifts
      // by half the size-delta along the local axis, so f.x/f.y must be updated
      // to keep the anchored edge stationary.
      if (state.resizeHandle === 'e') {
        // west edge anchored — east edge moves
        newWidth = Math.max(MIN_RESIZE_SIZE, snap(startData.width + localDx, state.gridSize));
        const dW = newWidth - startData.width;
        newX = startData.x + dW / 2 * (cosR - 1);
        newY = startData.y - dW / 2 * sinR;
      } else if (state.resizeHandle === 'w') {
        // east edge anchored — west edge moves
        newWidth = Math.max(MIN_RESIZE_SIZE, snap(startData.width - localDx, state.gridSize));
        const dW = newWidth - startData.width;
        newX = startData.x - dW / 2 * (1 + cosR);
        newY = startData.y + dW / 2 * sinR;
      } else if (state.resizeHandle === 's') {
        // north edge anchored — south edge moves
        newDepth = Math.max(MIN_RESIZE_SIZE, snap(startData.depth + localDy, state.gridSize));
        const dD = newDepth - startData.depth;
        newX = startData.x + dD / 2 * sinR;
        newY = startData.y + dD / 2 * (cosR - 1);
      } else if (state.resizeHandle === 'n') {
        // south edge anchored — north edge moves
        newDepth = Math.max(MIN_RESIZE_SIZE, snap(startData.depth - localDy, state.gridSize));
        const dD = newDepth - startData.depth;
        newX = startData.x - dD / 2 * sinR;
        newY = startData.y - dD / 2 * (1 + cosR);
      }

      f.width = newWidth;
      f.depth = newDepth;
      f.x = newX;
      f.y = newY;
      draw();
    }
    return;
  }

  // Dragging furniture
  if (state.dragging && state.dragFurnitureId) {
    const f = state.furniture.find(f => f.id === state.dragFurnitureId);
    if (f) {
      let nx = room.x - state.dragOffsetX;
      let ny = room.y - state.dragOffsetY;
      // Snap the top-left corner to the grid.
      // This also corrects any off-grid position left by a resize operation.
      nx = snap(nx, state.gridSize);
      ny = snap(ny, state.gridSize);
      f.x = nx;
      f.y = ny;
      selectedXInput.value = Math.round(f.x);
      selectedYInput.value = Math.round(f.y);
      draw();
    }
    return;
  }

  // Dragging an opening along its wall
  if (state.dragOpeningIndex >= 0) {
    const op = state.openings[state.dragOpeningIndex];
    const wall = getWalls()[op.wall];
    if (wall) {
      const dx = wall.b.x - wall.a.x;
      const dy = wall.b.y - wall.a.y;
      const wallLen = Math.sqrt(dx * dx + dy * dy);
      if (wallLen > 0) {
        const ux = dx / wallLen, uy = dy / wallLen;
        const t = (room.x - wall.a.x) * ux + (room.y - wall.a.y) * uy;
        let newOffset = snap(t - state.dragOpeningOffsetDelta, state.gridSize);
        newOffset = Math.max(0, Math.min(wallLen - op.width, newOffset));
        op.offset = newOffset;
        if (state.selectedOpeningIndex === state.dragOpeningIndex) {
          openingOffsetSelected.value = Math.round(newOffset);
        }
        draw();
      }
    }
    return;
  }

  // Panning
  if (state.panning) {
    state.viewX += pos.x - state.panStartX;
    state.viewY += pos.y - state.panStartY;
    state.panStartX = pos.x;
    state.panStartY = pos.y;
    draw();
    return;
  }

  // Cursor style
  if (state.roomClosed) {
    const handle = resizeHandleAt(room.x, room.y);
    if (handle) {
      const selF = state.furniture.find(f => f.id === state.selectedId);
      const rotRad = selF ? (selF.rotation * Math.PI / 180) : 0;
      const cosA = Math.abs(Math.cos(rotRad));
      const sinA = Math.abs(Math.sin(rotRad));
      let resCursor;
      if (handle === 'e' || handle === 'w') {
        resCursor = cosA >= sinA ? 'cursor-ew-resize' : 'cursor-ns-resize';
      } else {
        resCursor = sinA >= cosA ? 'cursor-ew-resize' : 'cursor-ns-resize';
      }
      canvas.className = resCursor;
    } else if (vertexAt(room.x, room.y) >= 0) {
      canvas.className = 'cursor-move';
    } else {
      const f  = furnitureAt(room.x, room.y);
      const oi = openingAt(room.x, room.y);
      canvas.className = (f || oi >= 0) ? 'cursor-move' : 'cursor-default';
    }
  }
}

function onPointerDown(e) {
  const pos  = getCanvasPos(e);
  const room = screenToRoom(pos.x, pos.y);

  // --- Drawing mode ---
  if (!state.roomClosed && state.mode === 'draw') {
    const verts = state.vertices;
    if (verts.length >= 3) {
      // Check if clicking near the first vertex
      const first = roomToScreen(verts[0].x, verts[0].y);
      const dx = pos.x - first.x, dy = pos.y - first.y;
      if (Math.sqrt(dx * dx + dy * dy) < CLOSE_RADIUS) {
        state.roomClosed = true;
        hint.classList.add('hidden');
        setRoomSectionState(true);
        setMode('normal');
        draw();
        return;
      }
    }
    const snapped = { x: snap(room.x, state.gridSize), y: snap(room.y, state.gridSize) };
    state.vertices.push(snapped);
    draw();
    return;
  }

  // --- Opening placement / drag mode ---
  if ((state.mode === 'place-opening' || state.mode === 'normal') && state.roomClosed) {
    // First check if clicking on an existing opening → select and/or drag it
    const oi = openingAt(room.x, room.y);
    if (oi >= 0) {
      // Select the opening
      if (state.mode === 'normal') {
        selectOpening(oi);
      }
      // Start dragging in both modes
      const op = state.openings[oi];
      const wall = getWalls()[op.wall];
      if (wall) {
        const dx = wall.b.x - wall.a.x;
        const dy = wall.b.y - wall.a.y;
        const wallLen = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / wallLen, uy = dy / wallLen;
        const t = (room.x - wall.a.x) * ux + (room.y - wall.a.y) * uy;
        state.dragOpeningIndex = oi;
        state.dragOpeningOffsetDelta = t - op.offset;
        canvas.className = 'cursor-grabbing';
      }
      return;
    }
  }

  if (state.mode === 'place-opening' && state.roomClosed) {
    const closest = closestWall(room.x, room.y);
    if (closest && closest.dist < 30 / (state.zoom * SCALE_DEFAULT)) {
      state.openings.push({
        type:   state.openingType,
        wall:   closest.wallIndex,
        offset: snap(closest.offset - state.openingWidth / 2, state.gridSize),
        width:  state.openingWidth,
        flip: false,
        side: 1,
      });
      // Auto-disarm after placing
      state.openingArmed = false;
      updateOpeningButtons();
      setMode('normal');
      draw();
    }
    return;
  }

  // --- Normal mode ---
  if (state.roomClosed) {
    // Check room vertices FIRST so they can always be adjusted
    const vi = vertexAt(room.x, room.y);
    if (vi >= 0) {
      deselectAll();
      state.dragVertexIndex = vi;
      canvas.className = 'cursor-grabbing';
      return;
    }

    // Check resize handles BEFORE furniture drag
    const handle = resizeHandleAt(room.x, room.y);
    if (handle) {
      const f = state.furniture.find(f => f.id === state.selectedId);
      if (f) {
        state.resizing = true;
        state.resizeHandle = handle;
        state.resizeStart = { roomX: room.x, roomY: room.y, width: f.width, depth: f.depth, x: f.x, y: f.y, rotation: f.rotation };
        canvas.className = 'cursor-grabbing';
        return;
      }
    }

    const f = furnitureAt(room.x, room.y);
    if (f) {
      selectFurniture(f.id);
      state.dragging = true;
      state.dragFurnitureId = f.id;
      state.dragOffsetX = room.x - f.x;
      state.dragOffsetY = room.y - f.y;
      canvas.className = 'cursor-grabbing';
      return;
    }
    // Only deselect if clicking empty space
    const oi = openingAt(room.x, room.y);
    if (oi < 0) {
      deselectAll();
    }
  }

  // Start pan
  state.panning   = true;
  state.panStartX = pos.x;
  state.panStartY = pos.y;
  canvas.className = 'cursor-grabbing';
}

function onPointerUp(_e) {
  if (state.dragVertexIndex >= 0) {
    state.dragVertexIndex = -1;
    draw();
  }
  if (state.resizing) {
    state.resizing = false;
    state.resizeHandle = null;
    state.resizeStart = null;
    canvas.className = 'cursor-move';
    draw();
  }
  if (state.dragging && state.dragFurnitureId) {
    const f = state.furniture.find(f => f.id === state.dragFurnitureId);
    if (f && anyOverlap(f, f.id)) {
      // Snap back — not ideal without history, just highlight for now
      // (Full undo is out of scope)
    }
    state.dragging        = false;
    state.dragFurnitureId = null;
    canvas.className      = 'cursor-move';
    draw();
  }
  if (state.dragOpeningIndex >= 0) {
    state.dragOpeningIndex = -1;
    state.dragOpeningOffsetDelta = 0;
    draw();
  }
  state.panning = false;
  canvas.className = state.roomClosed ? 'cursor-default' : 'cursor-crosshair';
}

// ============================================================
// MODE MANAGEMENT
// ============================================================

function setMode(mode) {
  state.mode = mode;
  if (mode === 'draw') {
    canvas.className = 'cursor-crosshair';
  } else if (mode === 'place-opening') {
    canvas.className = 'cursor-crosshair';
  } else {
    canvas.className = 'cursor-default';
  }
}

// ============================================================
// SIDEBAR CONTROLS
// ============================================================

tabDraw.addEventListener('click', () => {
  tabDraw.classList.add('active');
  tabRect.classList.remove('active');
  panelDraw.classList.remove('hidden');
  panelRect.classList.add('hidden');
  if (!state.roomClosed) setMode('draw');
});

tabRect.addEventListener('click', () => {
  tabRect.classList.add('active');
  tabDraw.classList.remove('active');
  panelRect.classList.remove('hidden');
  panelDraw.classList.add('hidden');
  setMode('rect');
});

btnUndoVertex.addEventListener('click', () => {
  if (!state.roomClosed && state.vertices.length > 0) {
    state.vertices.pop();
    draw();
  }
});

btnClearRoom.addEventListener('click', () => {
  if (!confirm('Clear the room and all furniture?')) return;
  state.vertices  = [];
  state.roomClosed = false;
  state.openings  = [];
  state.furniture = [];
  state.selectedId = null;
  state.selectedOpeningIndex = -1;
  state.resizing = false;
  state.dragging = false;
  state.dragOpeningIndex = -1;
  sectionSelected.classList.add('hidden');
  hint.classList.remove('hidden');
  setRoomSectionState(false);
  setMode('draw');
  draw();
});

btnMakeRect.addEventListener('click', () => {
  const w = parseFloat(rectWidthEl.value);
  const d = parseFloat(rectDepthEl.value);
  if (!w || !d || w < 10 || d < 10) return;
  state.vertices   = [{ x:0, y:0 }, { x:w, y:0 }, { x:w, y:d }, { x:0, y:d }];
  state.roomClosed = true;
  state.openings   = [];
  hint.classList.add('hidden');
  setRoomSectionState(true);
  setMode('normal');
  centerRoom();
  draw();
});

// Opening width input
openingWidthEl.addEventListener('input', () => {
  state.openingWidth = parseFloat(openingWidthEl.value) || 90;
});

// Door/Window buttons
const btnAddDoor = document.getElementById('btn-add-door');
const btnAddWindow = document.getElementById('btn-add-window');

btnAddDoor.addEventListener('click', () => {
  if (!state.roomClosed) { alert('Please draw and close a room first.'); return; }
  state.openingType = 'door';
  state.openingArmed = !state.openingArmed;
  updateOpeningButtons();
  setMode(state.openingArmed ? 'place-opening' : 'normal');
});

btnAddWindow.addEventListener('click', () => {
  if (!state.roomClosed) { alert('Please draw and close a room first.'); return; }
  state.openingType = 'window';
  state.openingArmed = !state.openingArmed;
  updateOpeningButtons();
  setMode(state.openingArmed ? 'place-opening' : 'normal');
});

function updateOpeningButtons() {
  btnAddDoor.classList.toggle('active', state.openingArmed && state.openingType === 'door');
  btnAddWindow.classList.toggle('active', state.openingArmed && state.openingType === 'window');
}

// Rotate
btnRotate.addEventListener('click', rotateSelected);
btnDelete.addEventListener('click', deleteSelected);

// Opening type select
const openingTypeSelect = document.getElementById('opening-type-select');
const openingWidthSelected = document.getElementById('opening-width-selected');
const openingOffsetSelected = document.getElementById('opening-offset-selected');
const btnFlipDoor = document.getElementById('btn-flip-door');
const btnSwingDoor = document.getElementById('btn-swing-door');
const btnDeleteOpening = document.getElementById('btn-delete-opening');
const furnitureControls = document.getElementById('furniture-controls');
const openingControlsSelected = document.getElementById('opening-controls-selected');

openingTypeSelect.addEventListener('change', () => {
  if (state.selectedOpeningIndex >= 0) {
    state.openings[state.selectedOpeningIndex].type = openingTypeSelect.value;
    draw();
  }
});

openingWidthSelected.addEventListener('input', () => {
  if (state.selectedOpeningIndex >= 0) {
    state.openings[state.selectedOpeningIndex].width = parseFloat(openingWidthSelected.value) || 90;
    draw();
  }
});

openingOffsetSelected.addEventListener('input', () => {
  if (state.selectedOpeningIndex >= 0) {
    const op = state.openings[state.selectedOpeningIndex];
    const wall = getWalls()[op.wall];
    if (wall) {
      const dx = wall.b.x - wall.a.x, dy = wall.b.y - wall.a.y;
      const wallLen = Math.sqrt(dx * dx + dy * dy);
      op.offset = Math.max(0, Math.min(wallLen - op.width, parseFloat(openingOffsetSelected.value) || 0));
    }
    draw();
  }
});

btnFlipDoor.addEventListener('click', () => {
  if (state.selectedOpeningIndex >= 0) {
    const op = state.openings[state.selectedOpeningIndex];
    op.flip = !op.flip;
    draw();
  }
});

btnSwingDoor.addEventListener('click', () => {
  if (state.selectedOpeningIndex >= 0) {
    const op = state.openings[state.selectedOpeningIndex];
    op.side = -op.side;
    draw();
  }
});

btnDeleteOpening.addEventListener('click', deleteSelected);

// Furniture metadata editing helpers
function onSelectedFurniture(callback) {
  if (!state.selectedId) return;
  const f = state.furniture.find(f => f.id === state.selectedId);
  if (!f) return;
  callback(f);
  draw();
}

function populateFurnitureInputs(f) {
  selectedNameInput.value   = f.name;
  selectedWInput.value      = f.width;
  selectedDInput.value      = f.depth;
  selectedXInput.value      = Math.round(f.x);
  selectedYInput.value      = Math.round(f.y);
  selectedCatInput.value    = f.category;
  const cat = CATEGORIES[f.category] || CATEGORIES.other;
  selectedColorInput.value  = f.color || cat.color;
}

const selectedNameInput = document.getElementById('selected-name-input');
const selectedWInput = document.getElementById('selected-w-input');
const selectedDInput = document.getElementById('selected-d-input');
const selectedXInput = document.getElementById('selected-x-input');
const selectedYInput = document.getElementById('selected-y-input');
const selectedCatInput = document.getElementById('selected-cat-input');
const selectedColorInput = document.getElementById('selected-color-input');
const btnResetColor = document.getElementById('btn-reset-color');

selectedNameInput.addEventListener('input', () => onSelectedFurniture(f => {
  f.name = selectedNameInput.value.trim() || 'Unnamed';
  selectedLabel.textContent = f.name;
}));

selectedWInput.addEventListener('input', () => onSelectedFurniture(f => {
  f.width = Math.max(10, Math.min(1000, parseFloat(selectedWInput.value) || f.width));
}));

selectedDInput.addEventListener('input', () => onSelectedFurniture(f => {
  f.depth = Math.max(10, Math.min(1000, parseFloat(selectedDInput.value) || f.depth));
}));

selectedXInput.addEventListener('input', () => onSelectedFurniture(f => {
  f.x = parseFloat(selectedXInput.value) || 0;
}));

selectedYInput.addEventListener('input', () => onSelectedFurniture(f => {
  f.y = parseFloat(selectedYInput.value) || 0;
}));

selectedCatInput.addEventListener('change', () => onSelectedFurniture(f => {
  f.category = selectedCatInput.value;
  // Update color picker to show new category color if no custom color set
  if (!f.color) {
    const cat = CATEGORIES[f.category] || CATEGORIES.other;
    selectedColorInput.value = cat.color;
  }
}));

selectedColorInput.addEventListener('input', () => onSelectedFurniture(f => {
  f.color = selectedColorInput.value;
}));

btnResetColor.addEventListener('click', () => onSelectedFurniture(f => {
  f.color = null;
  const cat = CATEGORIES[f.category] || CATEGORIES.other;
  selectedColorInput.value = cat.color;
}));

function rotateSelected() {
  if (!state.selectedId) return;
  const f = state.furniture.find(f => f.id === state.selectedId);
  if (!f) return;
  // Rotate around centre without swapping dimensions
  // The label is counter-rotated in drawFurniture to stay horizontal
  f.rotation = (f.rotation + 90) % 360;
  draw();
}

function deleteSelected() {
  // Delete furniture
  if (state.selectedId) {
    state.furniture = state.furniture.filter(f => f.id !== state.selectedId);
    deselectAll();
    return;
  }
  // Delete opening
  if (state.selectedOpeningIndex >= 0) {
    state.openings.splice(state.selectedOpeningIndex, 1);
    state.selectedOpeningIndex = -1;
    sectionSelected.classList.add('hidden');
    draw();
  }
}

// Grid
toggleGrid.addEventListener('change', () => {
  state.gridEnabled = toggleGrid.checked;
  draw();
});
toggleMeasurements.addEventListener('change', () => {
  state.showMeasurements = toggleMeasurements.checked;
  draw();
});
gridSizeEl.addEventListener('input', () => {
  state.gridSize = parseFloat(gridSizeEl.value) || 10;
});

btnZoomReset.addEventListener('click', () => {
  centerRoom();
  draw();
});

// Custom furniture
document.getElementById('btn-add-custom').addEventListener('click', () => {
  const name  = document.getElementById('custom-name').value.trim() || 'Custom';
  const w     = parseFloat(document.getElementById('custom-width').value) || 100;
  const d     = parseFloat(document.getElementById('custom-depth').value) || 60;
  const cat   = document.getElementById('custom-category').value;
  addFurnitureToRoom(cat, name, w, d);
});

// Keyboard
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (e.key === 'r' || e.key === 'R') rotateSelected();
  if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
  if (e.key === 'Escape') {
    deselectAll();
    setMode(state.roomClosed ? 'normal' : 'draw');
  }

  // Arrow key movement
  const ARROW_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
  if (!ARROW_KEYS.includes(e.key)) return;

  const step = state.gridEnabled ? state.gridSize : 1;

  if (state.selectedId) {
    e.preventDefault();
    const f = state.furniture.find(f => f.id === state.selectedId);
    if (!f) return;
    if (e.key === 'ArrowLeft')  f.x -= step;
    if (e.key === 'ArrowRight') f.x += step;
    if (e.key === 'ArrowUp')    f.y -= step;
    if (e.key === 'ArrowDown')  f.y += step;
    selectedXInput.value = Math.round(f.x);
    selectedYInput.value = Math.round(f.y);
    draw();
    return;
  }

  if (state.selectedOpeningIndex >= 0) {
    e.preventDefault();
    const op = state.openings[state.selectedOpeningIndex];
    const wall = getWalls()[op.wall];
    if (!wall) return;
    const dx = wall.b.x - wall.a.x, dy = wall.b.y - wall.a.y;
    const wallLen = Math.sqrt(dx * dx + dy * dy);
    // Determine which arrow moves along vs. across the wall
    const angle = Math.atan2(dy, dx); // wall direction in radians
    // Project arrow direction onto wall unit vector
    const arrows = {
      ArrowLeft:  { x: -1, y:  0 },
      ArrowRight: { x:  1, y:  0 },
      ArrowUp:    { x:  0, y: -1 },
      ArrowDown:  { x:  0, y:  1 },
    };
    const dir = arrows[e.key];
    const along = dir.x * Math.cos(angle) + dir.y * Math.sin(angle);
    if (Math.abs(along) > 0.5) {
      // Arrow is mostly along the wall — shift offset
      op.offset = Math.max(0, Math.min(wallLen - op.width, op.offset + Math.sign(along) * step));
      openingOffsetSelected.value = Math.round(op.offset);
    }
    draw();
  }
});

// ============================================================
// CENTER ROOM IN VIEW
// ============================================================

function centerRoom() {
  if (state.vertices.length === 0) return;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const v of state.vertices) {
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
  }
  const pad = CENTER_PADDING;
  const fitZoom = Math.min(
    (canvas.width  - pad * 2) / ((maxX - minX) * SCALE_DEFAULT),
    (canvas.height - pad * 2) / ((maxY - minY) * SCALE_DEFAULT),
  );
  state.zoom  = Math.max(MIN_ZOOM, fitZoom);
  const roomPxW = (maxX - minX) * SCALE_DEFAULT * state.zoom;
  const roomPxH = (maxY - minY) * SCALE_DEFAULT * state.zoom;
  state.viewX = (canvas.width  - roomPxW) / 2 - minX * SCALE_DEFAULT * state.zoom;
  state.viewY = (canvas.height - roomPxH) / 2 - minY * SCALE_DEFAULT * state.zoom;
}

// ============================================================
// EXPORT / IMPORT
// ============================================================

btnExport.addEventListener('click', () => {
  const data = {
    room: {
      vertices: state.vertices.map(v => [v.x, v.y]),
      openings: state.openings,
    },
    furniture: state.furniture,
    grid: { size: state.gridSize, enabled: state.gridEnabled, showMeasurements: state.showMeasurements },
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'layout.json';
  a.click();
  URL.revokeObjectURL(url);
});

importFile.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      loadState(JSON.parse(ev.target.result));
    } catch {
      alert('Invalid JSON file.');
    }
  };
  reader.readAsText(file);
  importFile.value = '';
});

function loadState(data) {
  state.vertices   = (data.room?.vertices || []).map(v => ({ x: v[0], y: v[1] }));
  state.roomClosed = state.vertices.length >= 3;
  state.openings   = (data.room?.openings || []).map(op => ({
    type: op.type,
    wall: op.wall,
    offset: op.offset,
    width: op.width,
    flip: op.flip ?? false,
    side: op.side ?? 1,
  }));
  state.furniture  = data.furniture || [];
  state.gridSize   = data.grid?.size ?? 10;
  state.gridEnabled = data.grid?.enabled ?? true;
  state.showMeasurements = data.grid?.showMeasurements ?? true;
  toggleGrid.checked         = state.gridEnabled;
  toggleMeasurements.checked = state.showMeasurements;
  gridSizeEl.value           = state.gridSize;
  state.selectedId   = null;
  sectionSelected.classList.add('hidden');
  if (state.roomClosed) {
    hint.classList.add('hidden');
    setRoomSectionState(true);
    setMode('normal');
  }
  centerRoom();
  draw();
}

// ============================================================
// INIT
// ============================================================

buildCatalog();
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
window.addEventListener('resize', () => {
  if (!isMobile()) {
    sidebarBackdrop.classList.remove('visible');
    document.body.classList.remove('sidebar-open');
    if (sidebar.classList.contains('hidden')) {
      btnShowSidebar.classList.remove('hidden');
    } else {
      btnShowSidebar.classList.add('hidden');
    }
  }
});

// Initial view centred
state.viewX = canvas.width  / 2;
state.viewY = canvas.height / 2;

// Auto-hide sidebar on mobile so canvas gets full width
if (isMobile()) {
  hideSidebar();
}

// Wire up opening section to enter place-opening mode
// (already done above via openingControls click)

// Sidebar toggle
function isMobile() {
  return window.innerWidth <= 640;
}

function showSidebar() {
  sidebar.classList.remove('hidden');
  btnShowSidebar.classList.add('hidden');
  if (isMobile()) {
    sidebarBackdrop.classList.add('visible');
    document.body.classList.add('sidebar-open');
  }
}

function hideSidebar() {
  sidebar.classList.add('hidden');
  btnShowSidebar.classList.remove('hidden');
  sidebarBackdrop.classList.remove('visible');
  document.body.classList.remove('sidebar-open');
}

btnToggleSidebar.addEventListener('click', hideSidebar);
btnShowSidebar.addEventListener('click', showSidebar);
sidebarBackdrop.addEventListener('click', hideSidebar);

// ============================================================
// ABOUT OVERLAY
// ============================================================

const aboutOverlay = document.getElementById('about-overlay');
document.getElementById('btn-about').addEventListener('click', () => {
  aboutOverlay.classList.remove('hidden');
});
document.getElementById('btn-about-close').addEventListener('click', () => {
  aboutOverlay.classList.add('hidden');
});
// Close on backdrop click
aboutOverlay.addEventListener('click', e => {
  if (e.target === aboutOverlay) aboutOverlay.classList.add('hidden');
});
// Close on Escape (extend existing handler)
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !aboutOverlay.classList.contains('hidden')) {
    aboutOverlay.classList.add('hidden');
  }
});

// Default mode (rectangle)
tabRect.classList.add('active');
tabDraw.classList.remove('active');
panelRect.classList.remove('hidden');
panelDraw.classList.add('hidden');
setMode('rect');
