import { useCallback, useEffect, useState } from 'react';
import { socket } from '../socket.js';

const REFRESH_MS = 5000;

// Discovery only. Joining reuses the normal join_room flow (onJoin), which the
// server re-validates, so a stale list (room filled up meanwhile) is harmless.
export default function BrowseRooms({ onJoin, busy }) {
  const [rooms, setRooms] = useState(null); // null = still loading first time

  const load = useCallback(() => {
    socket.emit('list_public_rooms', {}, (res) => {
      if (res?.ok) setRooms(res.rooms);
    });
  }, []);

  // Fetch on open, then poll while this tab is visible. Cleanup stops the polling.
  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div>
      <div className="row between">
        <h3>Public rooms</h3>
        <button type="button" className="tab" onClick={load}>Refresh</button>
      </div>

      {rooms === null && <p className="muted">Loading...</p>}
      {rooms && rooms.length === 0 && (
        <p className="muted">No public rooms open right now. Create one and untick "Private room"!</p>
      )}

      <ul className="players">
        {rooms?.map((r) => (
          <li key={r.code} className="room-row">
            <span>
              <b>{r.hostName}'s room</b>
              <br />
              <small className="muted">
                {r.playerCount}/{r.maxPlayers} players · {r.rounds} rounds · {r.drawTime}s
              </small>
            </span>
            <button type="button" disabled={busy} onClick={() => onJoin(r.code)}>Join</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
