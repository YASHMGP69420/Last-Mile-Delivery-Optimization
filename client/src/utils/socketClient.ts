import { io, Socket, ManagerOptions, SocketOptions } from 'socket.io-client';

/**
 * Resolves the Socket.IO server URL for Split-Origin vs Single-Origin builds:
 * 1. Explicit `VITE_SOCKET_URL` (trimmed, trailing slashes stripped)
 * 2. Origin derived from absolute `VITE_API_URL` via `new URL()`
 * 3. Relative `'/'` fallback for Single-Origin and Vite dev proxy
 */
export function resolveSocketUrl(): string {
  const explicitSocketUrl = (import.meta.env.VITE_SOCKET_URL || '')
    .trim()
    .replace(/\/+$/, '');
  if (explicitSocketUrl) {
    return explicitSocketUrl;
  }

  const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();
  if (rawApiUrl && /^https?:\/\//i.test(rawApiUrl)) {
    try {
      return new URL(rawApiUrl).origin;
    } catch {
      // Fall back to relative root when VITE_API_URL is malformed
    }
  }

  return '/';
}

/**
 * Creates a standardized Socket.IO client using Engine.IO's polling-then-websocket
 * upgrade handshake so Vite dev proxy & proxies never fail on raw ws:// preflight.
 */
export function createRealtimeSocket(
  token: string,
  options: Partial<ManagerOptions & SocketOptions> = {}
): Socket {
  return io(resolveSocketUrl(), {
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
