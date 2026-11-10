import { io, Socket, ManagerOptions, SocketOptions } from 'socket.io-client';

/**
 * Creates a standardized Socket.IO client using Engine.IO's polling-then-websocket
 * upgrade handshake so Vite dev proxy & proxies never fail on raw ws:// preflight.
 */
export function createRealtimeSocket(
  token: string,
  options: Partial<ManagerOptions & SocketOptions> = {}
): Socket {
  return io('/', {
    path: '/socket.io',
    transports: ['polling', 'websocket'],
    withCredentials: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1500,
    ...options,
    auth: { token },
  });
}

/**
 * Defers socket creation by one event-loop tick so React 18 StrictMode's
 * immediate mount/unmount cycle cancels before opening an in-flight WebSocket,
 * preventing "WebSocket is closed before the connection is established" noise.
 */
export function mountRealtimeSocket(
  token: string,
  setup: (socket: Socket) => (() => void) | void,
  options: Partial<ManagerOptions & SocketOptions> = {}
): () => void {
  let disposed = false;
  let socket: Socket | null = null;
  let teardown: (() => void) | void;

  const timer = window.setTimeout(() => {
    if (disposed) return;
    socket = createRealtimeSocket(token, options);
    teardown = setup(socket);
  }, 0);

  return () => {
    disposed = true;
    window.clearTimeout(timer);
    if (typeof teardown === 'function') {
      teardown();
    }
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  };
}
