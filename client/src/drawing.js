// Pure drawing logic, no React. Used for BOTH the drawer's local drawing and
// for replaying what the server relays from the drawer. One code path = both
// sides always look identical.
//
// Coordinates arrive normalized (0..1); we multiply by the canvas size to get pixels.

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;
export const BACKGROUND = '#ffffff';

export class CanvasBoard {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.lineCap = 'round'; // round ends => smooth joins and visible dots
    this.ctx.lineJoin = 'round';
    this.strokes = []; // finished strokes (needed to redraw after undo)
    this.current = null; // stroke being drawn right now
    this.clearPixels();
  }

  clearPixels() {
    this.ctx.fillStyle = BACKGROUND;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // --- incremental drawing: only paint the NEW part, never the whole canvas ---

  begin(x, y, color, size) {
    this.end(); // finish any stroke that never got an end
    this.current = { color, size, points: [{ x, y }] };
    // A click without movement should leave a dot.
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x * CANVAS_WIDTH, y * CANVAS_HEIGHT, size / 2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  extend(points) {
    if (!this.current) return;
    const { color, size } = this.current;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = size;
    for (const p of points) {
      const last = this.current.points[this.current.points.length - 1];
      this.ctx.beginPath();
      this.ctx.moveTo(last.x * CANVAS_WIDTH, last.y * CANVAS_HEIGHT);
      this.ctx.lineTo(p.x * CANVAS_WIDTH, p.y * CANVAS_HEIGHT);
      this.ctx.stroke();
      this.current.points.push(p);
    }
  }

  end() {
    if (!this.current) return;
    this.strokes.push(this.current);
    this.current = null;
  }

  // --- whole-canvas operations ---

  undo() {
    this.end();
    this.strokes.pop();
    this.redraw();
  }

  clear() {
    this.strokes = [];
    this.current = null;
    this.clearPixels();
  }

  // Wipe and replay every stroke from history. Needed for undo, because
  // pixels can't be "un-drawn": we re-render everything except the last stroke.
  redraw() {
    this.clearPixels();
    for (const stroke of this.strokes) this.paintStroke(stroke);
  }

  paintStroke({ color, size, points }) {
    const [first, ...rest] = points;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(first.x * CANVAS_WIDTH, first.y * CANVAS_HEIGHT, size / 2, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = size;
    this.ctx.beginPath();
    this.ctx.moveTo(first.x * CANVAS_WIDTH, first.y * CANVAS_HEIGHT);
    for (const p of rest) this.ctx.lineTo(p.x * CANVAS_WIDTH, p.y * CANVAS_HEIGHT);
    this.ctx.stroke();
  }
}
