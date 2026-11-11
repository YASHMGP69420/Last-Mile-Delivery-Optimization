const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const env = require('./config/env');
const { validateProductionEnv } = env;
const { connectDB, disconnectDB } = require('./config/db');
const { parseAllowedOrigins, createCorsOptionsDelegate } = require('./config/cors');
const { setIo } = require('./services/socketService');
const { socketAuthMiddleware, registerAuthorizedSocketHandlers } = require('./middleware/socketAuth');

const server = http.createServer(app);

// Socket.IO tracking gateway setup (shared CORS policy with Express)
const allowedOrigins = parseAllowedOrigins(env.CLIENT_ORIGIN, env.NODE_ENV);

const io = new Server(server, {
  cors: createCorsOptionsDelegate({
    allowedOrigins,
    nodeEnv: env.NODE_ENV,
    serveClient: env.SERVE_CLIENT,
    methods: ['GET', 'POST'],
  }),
  path: '/socket.io',
});

// Register singleton socket
setIo(io);
app.set('io', io);

// Socket.IO Authentication & Authorization
io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  registerAuthorizedSocketHandlers(socket, io);
});

let isShuttingDown = false;

async function gracefulShutdown(signal, options = {}) {
  const { exitFn = process.exit, timeoutMs = 10000 } = options;

  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  console.log(`[Server] Received ${signal}. Starting graceful shutdown...`);
  app.set('isDraining', true);

  const forceTimer = setTimeout(() => {
    console.error('[Server] Forced exit after graceful drain timeout');
    exitFn(1);
  }, timeoutMs);
  if (typeof forceTimer.unref === 'function') {
    forceTimer.unref();
  }

  try {
    const ioClosePromise = new Promise((resolve) => {
      io.close(() => resolve());
    });
    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }
    await ioClosePromise;

    if (server.listening) {
      await new Promise((resolve) => {
        server.close(() => resolve());
      });
    }

    await disconnectDB();
    clearTimeout(forceTimer);
    exitFn(0);
  } catch (error) {
    console.error(`[Server] Error during graceful shutdown: ${error.message}`);
    clearTimeout(forceTimer);
    exitFn(1);
  }
}

// Start DB connection & HTTP Server
const startServer = async () => {
  try {
    if (env.NODE_ENV === 'production') {
      try {
        validateProductionEnv();
      } catch (validationError) {
        console.error(`[Server] Fatal production configuration error: ${validationError.message}`);
        process.exit(1);
        return;
      }
    }

    if (env.SERVE_CLIENT) {
      const clientIndexPath = path.resolve(__dirname, '../../client/dist/index.html');
      if (!fs.existsSync(clientIndexPath)) {
        console.error(
          `[Server] Fatal SERVE_CLIENT configuration error: missing "${clientIndexPath}". Run "npm --prefix client run build" first.`
        );
        process.exit(1);
        return;
      }
    }

    await connectDB();

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n[Server] Port ${env.PORT} is already in use by another running instance.`);
        console.error(`[Server] To free port ${env.PORT} on Windows PowerShell, run:`);
        console.error(`[Server]   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${env.PORT}).OwningProcess -Force\n`);
      } else {
        console.error(`[Server] HTTP server error: ${err.message}`);
      }
      process.exit(1);
    });

    server.listen(env.PORT, () => {
      console.log(`[Server] SmartRoute backend running on port ${env.PORT} (${env.NODE_ENV})`);
      console.log(`[Server] API v1 base: http://localhost:${env.PORT}/api/v1`);
    });
  } catch (error) {
    console.error(`[Server] Fatal startup failure: ${error.message}`);
    process.exit(1);
  }
};

if (require.main === module) {
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  startServer();
}

module.exports = {
  app,
  server,
  io,
  startServer,
  gracefulShutdown,
};
