import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket.js';
import { CanvasBoard, CANVAS_WIDTH, CANVAS_HEIGHT, BACKGROUND } from '../drawing.js';

const COLORS = ['#000000', '#ffffff', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#6d4c41', '#ec407a'];
const SIZES = [
  { label: 'Thin', value: 4 },
  { label: 'Medium', value: 10 },
  { label: 'Thick', value: 22 },
];
const FLUSH_MS = 30; // batch pointer moves into one network message every 30ms

export default function Canvas({ isDrawer }) {
  const canvasRef = useRef(null);
  const boardRef = useRef(null); // CanvasBoard instance: a ref, NOT state (no re-render per point)
  const drawingRef = useRef(false);
  const pendingRef = useRef([]); // points waiting to be sent
  const timerRef = useRef(null);

  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(SIZES[1].value);
  const [eraser, setEraser] = useState(false);

  // Create the board once, and subscribe to what the server relays from the drawer.
  useEffect(() => {
    const board = new CanvasBoard(canvasRef.current);
    boardRef.current = board;

    const onDrawData = (msg) => {
      if (msg.type === 'start') board.begin(msg.x, msg.y, msg.color, msg.size);
      else if (msg.type === 'move') board.extend(msg.points);
      else if (msg.type === 'end') board.end();
    };
    const onClear = () => board.clear();
    const onUndo = () => board.undo();

    socket.on('draw_data', onDrawData);
    socket.on('canvas_clear', onClear);
    socket.on('draw_undo', onUndo);
    return () => {
      socket.off('draw_data', onDrawData);
      socket.off('canvas_clear', onClear);
      socket.off('draw_undo', onUndo);
      clearTimeout(timerRef.current);
    };
  }, []);

  // Pointer position -> normalized 0..1. getBoundingClientRect gives the CSS-rendered
  // size, so this stays correct even when the canvas is scaled down on small screens.
  const toPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clamp = (n) => Math.min(1, Math.max(0, n));
    return {
      x: clamp((e.clientX - rect.left) / rect.width),
      y: clamp((e.clientY - rect.top) / rect.height),
    };
  };

  const flush = () => {
    timerRef.current = null;
    if (pendingRef.current.length === 0) return;
    socket.emit('draw_move', { points: pendingRef.current });
    pendingRef.current = [];
  };

  const strokeColor = eraser ? BACKGROUND : color; // eraser = painting with the background color

  const onPointerDown = (e) => {
    if (!isDrawer) return;
    e.currentTarget.setPointerCapture(e.pointerId); // keep receiving moves outside the canvas
    drawingRef.current = true;
    const { x, y } = toPoint(e);
    boardRef.current.begin(x, y, strokeColor, size); // draw locally first = zero lag
    socket.emit('draw_start', { x, y, color: strokeColor, size });
  };

  const onPointerMove = (e) => {
    if (!isDrawer || !drawingRef.current) return;
    const p = toPoint(e);
    boardRef.current.extend([p]);
    pendingRef.current.push(p);
    if (!timerRef.current) timerRef.current = setTimeout(flush, FLUSH_MS);
  };

  const finishStroke = () => {
    if (!isDrawer || !drawingRef.current) return;
    drawingRef.current = false;
    clearTimeout(timerRef.current);
    flush(); // send leftover points BEFORE draw_end so order is preserved
    boardRef.current.end();
    socket.emit('draw_end');
  };

  const undo = () => {
    boardRef.current.undo();
    socket.emit('draw_undo');
  };

  const clear = () => {
    boardRef.current.clear();
    socket.emit('canvas_clear');
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className={isDrawer ? 'board drawable' : 'board'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />

      {isDrawer && (
        <div className="toolbar">
          <div className="swatches">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`color ${c}`}
                className={!eraser && color === c ? 'swatch selected' : 'swatch'}
                style={{ background: c }}
                onClick={() => {
                  setColor(c);
                  setEraser(false);
                }}
              />
            ))}
          </div>
          <div className="row">
            {SIZES.map((s) => (
              <button key={s.value} type="button" className={size === s.value ? 'tab active' : 'tab'} onClick={() => setSize(s.value)}>
                {s.label}
              </button>
            ))}
            <button type="button" className={eraser ? 'tab active' : 'tab'} onClick={() => setEraser((v) => !v)}>
              Eraser
            </button>
            <button type="button" className="tab" onClick={undo}>Undo</button>
            <button type="button" className="tab" onClick={clear}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}
