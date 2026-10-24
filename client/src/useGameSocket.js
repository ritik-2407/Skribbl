import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from './socket.js';

// One hook owns ALL socket listeners and the state they produce.
// Components just receive plain props: they never touch socket.on().
// The server is the source of truth; we only store what it tells us.
export function useGameSocket() {
  const [connected, setConnected] = useState(false);
  const [playerId, setPlayerId] = useState(null);
  const [room, setRoom] = useState(null); // lobby info: code, players, settings, phase
  const [game, setGame] = useState(null); // in-game info: phase, hint, timer, round...
  const [messages, setMessages] = useState([]); // chat + system lines
  const [wordOptions, setWordOptions] = useState(null); // only the drawer gets these
  const [roundEnd, setRoundEnd] = useState(null);
  const [gameOver, setGameOver] = useState(null);

  const roomRef = useRef(null);
  roomRef.current = room; // lets socket callbacks read the latest room without re-subscribing
  const msgId = useRef(0);

  const addMessage = useCallback((m) => {
    setMessages((list) => [...list.slice(-99), { id: msgId.current++, ...m }]);
  }, []);

  const resetGameState = useCallback(() => {
    setGame(null);
    setMessages([]);
    setWordOptions(null);
    setRoundEnd(null);
    setGameOver(null);
  }, []);

  const nameOf = (id) => roomRef.current?.players.find((p) => p.id === id)?.name ?? 'Someone';

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => {
      setConnected(false);
      setRoom(null); // v4 will add reconnect-to-room
      setPlayerId(null);
      resetGameState();
    };

    const onPlayerJoined = ({ player, players }) => {
      setRoom((r) => r && { ...r, players });
      addMessage({ system: true, text: `${player.name} joined` });
    };
    const onPlayerLeft = ({ playerId: id, players, hostId }) => {
      addMessage({ system: true, text: `${nameOf(id)} left` });
      setRoom((r) => r && { ...r, players, hostId });
    };
    const onPlayersUpdate = ({ players, hostId }) => setRoom((r) => r && { ...r, players, hostId });

    const onGameState = (state) => {
      setGame(state);
      setRoom((r) => r && { ...r, phase: state.phase === 'ended' ? 'ended' : 'playing', drawerId: state.drawerId });
      if (state.phase !== 'choosing') setWordOptions(null);
      if (state.phase !== 'round_end') setRoundEnd(null);
    };
    const onTimer = ({ timeLeft }) => setGame((g) => g && { ...g, timeLeft });
    const onRoundStart = (d) => {
      setWordOptions(d.wordOptions ?? null);
      addMessage({ system: true, text: `Round ${d.round}/${d.totalRounds}: ${nameOf(d.drawerId)} is choosing a word` });
    };
    const onRoundEnd = (d) => {
      setRoundEnd(d);
      addMessage({ system: true, text: `The word was "${d.word}"` });
    };
    const onGameOver = (d) => setGameOver(d);

    const onGuessResult = (r) => {
      if (r.correct) addMessage({ system: true, kind: 'correct', text: `${r.playerName} guessed the word!` });
      else if (r.close) addMessage({ system: true, kind: 'close', text: 'So close! Check your spelling.' });
    };
    const onChat = (m) => addMessage(m);

    const onRoomReset = ({ room: fresh }) => {
      resetGameState();
      setRoom(fresh);
    };

    const handlers = {
      connect: onConnect,
      disconnect: onDisconnect,
      player_joined: onPlayerJoined,
      player_left: onPlayerLeft,
      players_update: onPlayersUpdate,
      game_state: onGameState,
      timer: onTimer,
      round_start: onRoundStart,
      round_end: onRoundEnd,
      game_over: onGameOver,
      guess_result: onGuessResult,
      chat_message: onChat,
      room_reset: onRoomReset,
    };
    for (const [event, fn] of Object.entries(handlers)) socket.on(event, fn);
    socket.connect();

    return () => {
      for (const [event, fn] of Object.entries(handlers)) socket.off(event, fn);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enterRoom = useCallback(
    (res) => {
      resetGameState();
      setPlayerId(res.playerId);
      setRoom(res.room);
    },
    [resetGameState]
  );

  return { connected, playerId, room, game, messages, wordOptions, roundEnd, gameOver, enterRoom };
}
