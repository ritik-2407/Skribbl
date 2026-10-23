import { useState } from 'react';
import { socket } from '../socket.js';

export default function Lobby({ room, playerId }) {
  const [error, setError] = useState('');
  const isHost = room.hostId === playerId;
  const me = room.players.find((p) => p.id === playerId);

  const act = (event) => {
    setError('');
    socket.emit(event, {}, (res) => {
      if (!res.ok) setError(res.error);
    });
  };

  if (room.phase === 'playing') {
    return (
      <div className="card">
        <h2>Game started!</h2>
        <p>The drawing and guessing screens arrive in v2 and v3.</p>
      </div>
    );
  }

  const s = room.settings;
  return (
    <div className="card">
      <h2>
        Room code: <code className="code">{room.code}</code>
      </h2>
      <p className="muted">
        {s.isPrivate ? 'Private' : 'Public'} · {s.rounds} rounds · {s.drawTime}s · {s.wordCount} word
        choices · {s.hints} hints · {s.wordMode}
      </p>

      <h3>
        Players ({room.players.length}/{s.maxPlayers})
      </h3>
      <ul className="players">
        {room.players.map((p) => (
          <li key={p.id}>
            {p.name}
            {p.id === playerId && ' (you)'}
            {p.isHost ? ' 👑' : p.isReady ? ' ✅' : ' ⏳'}
          </li>
        ))}
      </ul>

      {isHost ? (
        <button onClick={() => act('start_game')}>Start game</button>
      ) : (
        <button onClick={() => act('toggle_ready')}>{me?.isReady ? 'Not ready' : 'Ready'}</button>
      )}
      {error && <p className="bad">{error}</p>}
    </div>
  );
}
