import { useEffect, useState } from 'react';
import { socket } from './socket.js';

export default function App() {
  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState(null);
  const [reply, setReply] = useState(null);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      setSocketId(socket.id);
    };
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.connect();

    // Cleanup: remove listeners + disconnect. Without this, StrictMode's
    // double-mount in dev would register every listener twice.
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
    };
  }, []);

  const sendPing = () => {
    // The 3rd argument of emit is an "acknowledgement" callback: the server
    // calls it, and the data comes back to this function (request/response).
    socket.emit('ping_server', { hello: 'from client' }, (response) => {
      setReply(response);
    });
  };

  return (
    <main className="container">
      <h1>Skribbl Clone</h1>
      <p>
        Status:{' '}
        <strong className={connected ? 'ok' : 'bad'}>
          {connected ? 'connected' : 'disconnected'}
        </strong>
      </p>
      {socketId && <p>Your socket id: <code>{socketId}</code></p>}
      <button onClick={sendPing} disabled={!connected}>Ping server</button>
      {reply && <pre>{JSON.stringify(reply, null, 2)}</pre>}
    </main>
  );
}
