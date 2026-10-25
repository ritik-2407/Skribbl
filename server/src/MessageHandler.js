import { sanitizeName, sanitizeSettings } from './settings.js';
import { Game } from './Game.js';

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
    s.on('list_public_rooms', (_data, ack) => this.safe(ack, () => this.onListPublicRooms(ack)));
    s.on('leave_room', (_data, ack) => this.safe(ack, () => this.onLeaveRoom(ack)));
    s.on('kick_player', (data, ack) => this.safe(ack, () => this.onKickPlayer(data, ack)));
    s.on('toggle_ready', (_data, ack) => this.safe(ack, () => this.onToggleReady(ack)));
    s.on('start_game', (_data, ack) => this.safe(ack, () => this.onStartGame(ack)));
    s.on('play_again', (_d, ack) => this.safe(ack, () => this.onPlayAgain(ack)));
    s.on('word_chosen', (d) => this.safe(null, () => this.onWordChosen(d)));
    s.on('guess', (d) => this.safe(null, () => this.onMessage(d)));
    s.on('chat', (d) => this.safe(null, () => this.onMessage(d)));
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
    if (room.game?.phase !== 'drawing') return null; // can't draw while choosing a word
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
    if (room.hasName(playerName)) return ack({ ok: false, error: 'That name is already taken in this room' });

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

  // Discovery only: joining still goes through join_room, which re-validates everything.
  onListPublicRooms(ack) {
    if (typeof ack !== 'function') return;
    ack({ ok: true, rooms: this.roomManager.listPublic() });
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
    room.game = new Game(room);
    ack({ ok: true }); // ack first so the host's UI is ready before the first events arrive
    room.game.start(); // emits round_start / game_state to everyone
  }

  onWordChosen(data) {
    const room = this.currentRoom();
    if (!room?.game) return;
    room.game.chooseWord(this.socket.id, data?.word);
  }

  // 'guess' and 'chat' both go through the same server-side router.
  onMessage(data) {
    const room = this.currentRoom();
    if (!room) return;
    const player = room.getPlayer(this.socket.id);
    if (room.game) room.game.handleMessage(player, data?.text);
    else {
      const text = typeof data?.text === 'string' ? data.text.trim().slice(0, 100) : '';
      if (text) room.broadcast('chat_message', { playerId: player.id, playerName: player.name, text });
    }
  }

  onPlayAgain(ack) {
    const room = this.currentRoom();
    if (!room) return ack({ ok: false, error: 'Not in a room' });
    if (room.hostId !== this.socket.id) return ack({ ok: false, error: 'Only the host can restart' });
    if (room.phase !== 'ended') return ack({ ok: false, error: 'Game is not over' });
    room.resetToLobby();
    room.broadcast('room_reset', { room: room.toPublic() });
    ack({ ok: true });
  }

  // Voluntary exit. Same cleanup as a disconnect, but the socket stays connected,
  // so we must also detach it from the room ourselves.
  onLeaveRoom(ack) {
    const room = this.currentRoom();
    if (!room) return ack({ ok: false, error: 'Not in a room' });

    // Detach FIRST so the leaver doesn't receive the broadcast about their own exit.
    this.socket.leave(room.code);
    this.socket.data.roomCode = undefined;
    this.removeFromRoom(room, this.socket.id, 'left');
    ack({ ok: true });
  }

  // Host moderation. Authorization: host only, never yourself, target must be in THIS room
  // (the room comes from the host's socket, never from the payload).
  onKickPlayer(data, ack) {
    const room = this.currentRoom();
    if (!room) return ack({ ok: false, error: 'Not in a room' });
    if (room.hostId !== this.socket.id) return ack({ ok: false, error: 'Only the host can remove players' });

    const targetId = typeof data?.playerId === 'string' ? data.playerId : '';
    if (targetId === this.socket.id) return ack({ ok: false, error: "You can't remove yourself, use Leave" });
    if (!room.players.has(targetId)) return ack({ ok: false, error: 'Player not found' });

    // playerId === socket.id, so we can reach the kicked player's connection directly.
    const target = this.io.sockets.sockets.get(targetId);
    if (target) {
      target.emit('kicked', { reason: 'removed by the host' });
      target.leave(room.code);
      target.data.roomCode = undefined; // their later disconnect must not touch this room again
    }
    this.removeFromRoom(room, targetId, 'kicked');
    ack({ ok: true });
  }

  // One cleanup path for ALL ways of leaving (disconnect, leave button, kick),
  // so host handover, empty-room deletion and game updates can never drift apart.
  removeFromRoom(room, playerId, reason) {
    room.removePlayer(playerId);
    if (room.isEmpty) {
      room.game?.destroy(); // stop the timers or they leak forever
      this.roomManager.deleteRoom(room.code); // no leaks: empty rooms are removed
      return;
    }
    room.broadcast('player_left', {
      playerId,
      players: room.playersPublic(),
      hostId: room.hostId,
      reason,
    });
    // Tell the game AFTER the player is removed, so it sees the up-to-date player list.
    room.game?.onPlayerLeft(playerId);
  }

  onDisconnect() {
    const room = this.currentRoom();
    if (!room) return; // already left or was kicked: nothing to clean up
    this.removeFromRoom(room, this.socket.id, 'disconnected');
  }
}
