import { Pencil, CheckCircle2, UserX } from 'lucide-react';
import '../moderation.css';

export default function Scoreboard({ players, drawerId, guessed, playerId, canKick, onKick }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <div className="scoreboard card">
      <h3>Players</h3>
      <ul className="players">
        {sorted.map((p, i) => (
          <li key={p.id} className={guessed.includes(p.id) ? 'guessed' : ''}>
            <span>#{i + 1} {p.name}{p.id === playerId && ' (you)'}{p.id === drawerId && <Pencil size={16} className="ico" aria-label="Drawing" />}{guessed.includes(p.id) && <CheckCircle2 size={16} className="ico ok" aria-label="Guessed" />}</span>
            <span className="player-line">
              <b>{p.score}</b>
              {canKick && p.id !== playerId && (
                <button type="button" className="tab kick-btn" onClick={() => onKick(p)}><UserX size={15} /> Kick</button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
