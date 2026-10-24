import { sanitizeName, sanitizeSettings } from './settings.js';

const ROOM_CODE_RE = /^\d{6}$/;
const MIN_PLAYERS_TO_START = 2;

// Wires socket events to room logic. One MessageHandler instance per connected socket.
// Pattern used for request/response events: client passes an ack callback,
// we always reply { ok: true, ... } or { ok: false, error: '...' }.
export class MessageHandler {
  constructor(io, socket, roomManager) {
    this.io = io;
    this.socket = socket;
    this.roomManager = roomManager;
  }

  register() {
    const s = this.socket;
    s.on('create_room', (data, ack) => this.safe(ack, () => this.onCreateRoom(data, ack)));
    s.on('join_room', (data, ack) => this.safe(ack, () => this.onJoinRoom(data, ack)));
    s.on('toggle_ready', (_data, ack) => this.safe(ack, () => this.onToggleReady(ack)));
    s.on('start_game', (_data, ack) => this.safe(ack, () => this.onStartGame(ack)));
    // Drawing events are fire-and-forget (no ack): they fire dozens of times per second.
    s.on('draw_start', (d) => this.safe(null, () => this.onDrawStart(d)));
    s.on('draw_move', (d) => this.safe(null, () => this.onDrawMove(d)));
    s.on('draw_end', () => this.safe(null, () => this.onDrawEnd()));
    s.on('canvas_clear', () => this.safe(null, () => this.onCanvasClear()));
    s.on('draw_undo', () => this.safe(null, () => this.onDrawUndo()));
    s.on('disconnect', () => this.onDisconnect());
  }

  // Returns the room only if this socket is allowed to draw right now.
  // Authorization lives on the SERVER: a hacked client can't draw out of turn.
  drawingRoom() {
    const room = this.currentRoom();
    if (!room || room.phase !== 'playing') return null;
    if (room.drawerId !== this.socket.id) return null;
    return room;
  }

  onDrawStart(data) {
    const room = this.drawingRoom();
    if (!room) return;
    const clean = room.board.start(data);
    if (!clean) return;
    // socket.to(...) = everyone in the room EXCEPT the drawer (who already drew locally).
    this.socket.to(room.code).emit('draw_data', { type: 'start', ...clean });
  }

  onDrawMove(data) {
    const room = this.drawingRoom();
    if (!room) return;
    const points = room.board.move(data?.points);
    if (!points) return;
    this.socket.to(room.code).emit('draw_data', { type: 'move', points });
  }

  onDrawEnd() {
    const room = this.drawingRoom();
    if (!room) return;
    if (room.board.end()) this.socket.to(room.code).emit('draw_data', { type: 'end' });
  }

  onCanvasClear() {
    const room = this.drawingRoom();
    if (!room) return;
    room.board.clear();
    this.socket.to(room.code).emit('canvas_clear');
  }

  onDrawUndo() {
    const room = this.drawingRoom();
    if (!room) return;
    room.board.undo();
    this.socket.to(room.code).emit('draw_undo');
  }

  // Never let a bad payload crash the whole server process.
  safe(ack, fn) {
    try {
      fn();
    } catch (err) {
      console.error('[handler error]', err);
      if (typeof ack === 'function') ack({ ok: false, error: 'Something went wrong' });
    }
  }

  currentRoom() {
    const code = this.socket.data.roomCode;
    return code ? this.roomManager.getRoom(code) : undefined;
  }

  onCreateRoom(data = {}, ack) {
    if (this.socket.data.roomCode) return ack({ ok: false, error: 'Already in a room' });

    const hostName = sanitizeName(data.hostName);
    if (!hostName) return ack({ ok: false, error: 'Please enter a name' });

    const settings = sanitizeSettings(data.settings);
    const room = this.roomManager.createRoom(this.socket.id, settings);
    room.addPlayer(this.socket.id, hostName);

    this.socket.join(room.code); // Socket.IO room membership, used for broadcasting
    this.socket.data.roomCode = room.code;

    ack({ ok: true, playerId: this.socket.id, room: room.toPublic() });
  }

  onJoinRoom(data = {}, ack) {
    if (this.socket.data.roomCode) return ack({ ok: false, error: 'Already in a room' });

    const playerName = sanitizeName(data.playerName);
    if (!playerName) return ack({ ok: false, error: 'Please enter a name' });

    const code = typeof data.roomId === 'string' ? data.roomId.trim() : '';
    if (!ROOM_CODE_RE.test(code)) return ack({ ok: false, error: 'Room code must be 6 digits' });

    const room = this.roomManager.getRoom(code);
    if (!room) return ack({ ok: false, error: 'Room not found' });
    if (room.phase !== 'lobby') return ack({ ok: false, error: 'Game already started' });
    if (room.isFull) return ack({ ok: false, error: 'Room is full' });

    const player = room.addPlayer(this.socket.id, playerName);
    this.socket.join(room.code);
    this.socket.data.roomCode = room.code;

    // Reply to the joiner with the full room, tell everyone else about the new player.
    ack({ ok: true, playerId: this.socket.id, room: room.toPublic() });
    this.socket.to(room.code).emit('player_joined', {
      player: player.toPublic(room.hostId),
      players: room.playersPublic(),
    });
  }

  onToggleReady(ack) {
    const room = this.currentRoom();
    if (!room) return ack({ ok: false, error: 'Not in a room' });
    if (room.phase !== 'lobby') return ack({ ok: false, error: 'Game already started' });

    const player = room.getPlayer(this.socket.id);
    player.isReady = !player.isReady;

    room.broadcast('players_update', { players: room.playersPublic(), hostId: room.hostId });
    ack({ ok: true });
  }

  onStartGame(ack) {
    const room = this.currentRoom();
    if (!room) return ack({ ok: false, error: 'Not in a room' });
    if (room.hostId !== this.socket.id) return ack({ ok: false, error: 'Only the host can start' });
    if (room.phase !== 'lobby') return ack({ ok: false, error: 'Game already started' });
    if (room.players.size < MIN_PLAYERS_TO_START) {
      return ack({ ok: false, error: `Need at least ${MIN_PLAYERS_TO_START} players` });
    }
    if (!room.allGuestsReady()) return ack({ ok: false, error: 'Waiting for players to ready up' });

    room.phase = 'playing';
    // v2 placeholder: the host draws. v3 replaces this with real turn rotation.
    room.drawerId = room.hostId;
    room.broadcast('game_state', { phase: room.phase, round: 0, drawerId: room.drawerId });
    ack({ ok: true });
  }

  onDisconnect() {
    const room = this.currentRoom();
    if (!room) return;

    room.removePlayer(this.socket.id);
    if (room.isEmpty) {
      this.roomManager.deleteRoom(room.code); // no leaks: empty rooms are removed
      return;
    }
    // If the drawer left mid-game, hand the pen to the (possibly new) host.
    if (room.phase === 'playing' && room.drawerId === this.socket.id) {
      room.drawerId = room.hostId;
      room.board.clear();
      room.broadcast('game_state', { phase: room.phase, round: 0, drawerId: room.drawerId });
      room.broadcast('canvas_clear');
    }
    room.broadcast('player_left', {
      playerId: this.socket.id,
      players: room.playersPublic(),
      hostId: room.hostId,
    });
  }
}
