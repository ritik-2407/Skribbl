import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { RoomManager } from './RoomManager.js';
import { MessageHandler } from './MessageHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

// 1. Express handles normal HTTP (health check, serving the built React app).
const app = express();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// 2. Socket.IO needs the raw Node http server, not the Express app,
//    because it hooks into the HTTP "upgrade" request that switches to WebSocket.
const server = http.createServer(app);
const io = new Server(server);

// 3. Serve the production build of the React app (client/dist).
//    In dev, Vite serves the client itself, so this folder won't exist - that's fine.
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res, next) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => err && next());
});

// 4. Every new connection gets its own MessageHandler; all rooms live in one RoomManager.
const roomManager = new RoomManager(io);

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);
  new MessageHandler(io, socket, roomManager).register();
  socket.on('disconnect', (reason) => {
    console.log(`[socket] disconnected: ${socket.id} (${reason})`);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
