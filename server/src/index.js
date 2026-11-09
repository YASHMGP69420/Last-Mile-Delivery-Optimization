const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/db');
const { setIo } = require('./services/socketService');
const { socketAuthMiddleware, registerAuthorizedSocketHandlers } = require('./middleware/socketAuth');

const server = http.createServer(app);

// Socket.IO tracking gateway setup
const allowedOrigins = [
  env.CLIENT_ORIGIN || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Socket.IO CORS blocked'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
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

// Start DB connection & HTTP Server
const startServer = async () => {
  try {
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
  startServer();
}

module.exports = {
  app,
  server,
  io,
};
