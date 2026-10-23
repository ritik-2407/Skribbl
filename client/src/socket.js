import { io } from 'socket.io-client';

// One shared socket for the whole app (a module is only evaluated once).
// No URL => connects to the same origin that served the page.
// Dev: Vite proxies /socket.io to the server. Prod: Express serves both.
// autoConnect is off so React decides when to connect.
export const socket = io({ autoConnect: false });
