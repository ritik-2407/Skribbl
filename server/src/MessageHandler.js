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
    s.on('disconnect', () => this.onDisconnect());
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
    // v3 replaces this with a real Game object and round_start events.
    room.broadcast('game_state', { phase: room.phase, round: 0, drawerId: null });
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
    room.broadcast('player_left', {
      playerId: this.socket.id,
      players: room.playersPublic(),
      hostId: room.hostId,
    });
  }
}
