import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In dev, the browser talks to Vite (5173). Anything under /socket.io is
    // forwarded to our Node server (3001), including the WebSocket upgrade.
    // Result: client code uses io() with NO url, identical in dev and production.
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
