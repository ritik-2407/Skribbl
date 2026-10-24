import { useState } from 'react';
import { socket } from '../socket.js';

export default function Lobby({ room, playerId }) {
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === playerId;
  const me = room.players.find((p) => p.id === playerId);

  const act = (event) => {
    setError('');
    socket.emit(event, {}, (res) => {
      if (!res.ok) setError(res.error);
    });
  };

  // Same origin as the page, so it works on localhost and on the deployed URL alike.
  const inviteLink = `${window.location.origin}/?room=${room.code}`;
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be blocked (e.g. non-HTTPS); the link is selectable in the box anyway.
    }
  };

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

      <div className="invite">
        <input readOnly value={inviteLink} onFocus={(e) => e.target.select()} />
        <button type="button" className="tab" onClick={copyInvite}>{copied ? 'Copied!' : 'Copy invite link'}</button>
      </div>

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
