import { useEffect, useState, useCallback } from 'react';
import { socket } from './socket.js';
import Home from './components/Home.jsx';
import Lobby from './components/Lobby.jsx';
import Game from './components/Game.jsx';

// App is the single owner of "which screen" + "room state".
// The server is the source of truth: we never edit the player list ourselves,
// we only replace it with what the server broadcasts.
export default function App() {
  const [connected, setConnected] = useState(false);
  const [playerId, setPlayerId] = useState(null);
  const [room, setRoom] = useState(null); // null => Home screen

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => {
      setConnected(false);
      // v4 will add reconnect-to-room. For now a dropped socket = back to home.
      setRoom(null);
      setPlayerId(null);
    };

    // Merge helpers: always use functional updates so we never read stale state.
    const onPlayerJoined = ({ players }) => setRoom((r) => r && { ...r, players });
    const onPlayerLeft = ({ players, hostId }) => setRoom((r) => r && { ...r, players, hostId });
    const onPlayersUpdate = ({ players, hostId }) => setRoom((r) => r && { ...r, players, hostId });
    const onGameState = ({ phase, drawerId }) => setRoom((r) => r && { ...r, phase, drawerId });

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('player_joined', onPlayerJoined);
    socket.on('player_left', onPlayerLeft);
    socket.on('players_update', onPlayersUpdate);
    socket.on('game_state', onGameState);
    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('player_joined', onPlayerJoined);
      socket.off('player_left', onPlayerLeft);
      socket.off('players_update', onPlayersUpdate);
      socket.off('game_state', onGameState);
      socket.disconnect();
    };
  }, []);

  // Called by Home after the server confirms create/join.
  const enterRoom = useCallback((res) => {
    setPlayerId(res.playerId);
    setRoom(res.room);
  }, []);

  if (!connected) {
    return <main className="container"><h1>Skribbl Clone</h1><p>Connecting to server...</p></main>;
  }

  return (
    <main className="container">
      <h1>Skribbl Clone</h1>
      {!room && <Home onEnter={enterRoom} />}
      {room && room.phase === 'lobby' && <Lobby room={room} playerId={playerId} />}
      {room && room.phase === 'playing' && <Game room={room} playerId={playerId} />}
    </main>
  );
}
