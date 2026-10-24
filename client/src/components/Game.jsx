import Canvas from './Canvas.jsx';

// v2: only the canvas + player list. v3 adds word picking, timer, chat/guessing.
export default function Game({ room, playerId }) {
  const isDrawer = room.drawerId === playerId;
  const drawer = room.players.find((p) => p.id === room.drawerId);

  return (
    <div className="card">
      <p>{isDrawer ? 'You are drawing!' : `${drawer?.name ?? 'Someone'} is drawing`}</p>
      <Canvas isDrawer={isDrawer} />
      <ul className="players inline">
        {room.players.map((p) => (
          <li key={p.id}>
            {p.name}
            {p.id === room.drawerId && ' ✏️'}
          </li>
        ))}
      </ul>
    </div>
  );
}
