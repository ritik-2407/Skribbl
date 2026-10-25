import { useState } from 'react';
import { Crown, CheckCircle2, Clock, UserX, Play, Check, X, Copy, LogOut } from 'lucide-react';
import { socket } from '../socket.js';
import '../moderation.css';

export default function Lobby({ room, playerId, onLeave, onKick }) {
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

  // Host only. The button is just convenience: the SERVER re-checks that you are the host.
  const kick = (p) => {
    if (!window.confirm(`Remove ${p.name} from the room?`)) return;
    setError('');
    onKick(p.id, (res) => {
      if (!res?.ok) setError(res?.error ?? 'Could not remove player');
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
        <button type="button" className="tab" onClick={copyInvite}>{copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy invite link</>}</button>
      </div>

      <h3>
        Players ({room.players.length}/{s.maxPlayers})
      </h3>
      <ul className="players">
        {room.players.map((p) => (
          <li key={p.id} className="player-line">
            <span>
              {p.name}
              {p.id === playerId && ' (you)'}
              {p.isHost ? (
                <Crown size={18} className="ico host" aria-label="Host" />
              ) : p.isReady ? (
                <CheckCircle2 size={18} className="ico ok" aria-label="Ready" />
              ) : (
                <Clock size={18} className="ico wait" aria-label="Not ready" />
              )}
            </span>
            {isHost && p.id !== playerId && (
              <button type="button" className="tab kick-btn" onClick={() => kick(p)}><UserX size={15} /> Kick</button>
            )}
          </li>
        ))}
      </ul>

      <div className="leave-row">
        {isHost ? (
          <button className="cta" onClick={() => act('start_game')}><Play size={20} /> Start game</button>
        ) : (
          <button className="cta" onClick={() => act('toggle_ready')}>
            {me?.isReady ? <><X size={20} /> Not ready</> : <><Check size={20} /> Ready</>}
          </button>
        )}
        <button type="button" className="tab" onClick={onLeave}><LogOut size={16} /> Leave room</button>
      </div>
      {error && <p className="bad">{error}</p>}
    </div>
  );
}
