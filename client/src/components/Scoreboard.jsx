export default function Scoreboard({ players, drawerId, guessed, playerId }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <div className="scoreboard card">
      <h3>Players</h3>
      <ul className="players">
        {sorted.map((p, i) => (
          <li key={p.id} className={guessed.includes(p.id) ? 'guessed' : ''}>
            <span>#{i + 1} {p.name}{p.id === playerId && ' (you)'}{p.id === drawerId && ' ✏️'}{guessed.includes(p.id) && ' ✅'}</span>
            <b>{p.score}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
