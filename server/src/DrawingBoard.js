// Server-side record of what is drawn in a room.
//
// Data model:
//   stroke = { color: '#rrggbb', size: number, points: [{x, y}, ...] }
//   x and y are NORMALIZED (0..1), i.e. a fraction of canvas width/height.
//   That makes drawings resolution-independent: a phone and a 4K monitor agree.
//
// Why store strokes on the server at all?
//   1. Undo = remove the last stroke (needs a history).
//   2. Late joiners / reconnecting players can be sent the full drawing.
//   3. The server is the authority: it validates everything before relaying.

const MAX_STROKES = 500;
const MAX_POINTS_PER_STROKE = 5000;
const MAX_POINTS_PER_MESSAGE = 100;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function sanitizePoint(p) {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  return { x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1) };
}

export class DrawingBoard {
  constructor() {
    this.strokes = []; // finished strokes
    this.current = null; // stroke currently being drawn
  }

  // Returns the sanitized payload to broadcast, or null if invalid.
  start({ x, y, color, size } = {}) {
    const pt = sanitizePoint({ x, y });
    if (!pt || !COLOR_RE.test(color) || !Number.isFinite(size)) return null;
    if (this.current) this.end(); // a missed draw_end must not lose the old stroke
    this.current = { color, size: clamp(size, 1, 50), points: [pt] };
    return { ...pt, color: this.current.color, size: this.current.size };
  }

  // points: array of {x, y}. Returns the sanitized points to broadcast, or null.
  move(points) {
    if (!this.current || !Array.isArray(points)) return null;
    const clean = [];
    for (const raw of points.slice(0, MAX_POINTS_PER_MESSAGE)) {
      const pt = sanitizePoint(raw);
      if (pt) clean.push(pt);
    }
    // Memory guard: a malicious client can't grow one stroke forever.
    const room = MAX_POINTS_PER_STROKE - this.current.points.length;
    const accepted = clean.slice(0, Math.max(0, room));
    if (accepted.length === 0) return null;
    this.current.points.push(...accepted);
    return accepted;
  }

  end() {
    if (!this.current) return false;
    this.strokes.push(this.current);
    if (this.strokes.length > MAX_STROKES) this.strokes.shift();
    this.current = null;
    return true;
  }

  undo() {
    this.end(); // commit any in-progress stroke first, then remove the last one
    this.strokes.pop();
  }

  clear() {
    this.strokes = [];
    this.current = null;
  }
}
