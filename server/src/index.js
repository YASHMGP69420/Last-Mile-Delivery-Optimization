const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/db');

const server = http.createServer(app);

// Socket.IO tracking gateway setup
const io = new Server(server, {
  cors: {
    origin: env.CLIENT_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  path: '/socket.io',
});

io.on('connection', (socket) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);
  }

  socket.on('route:join', (data) => {
    if (data && data.routeId) {
      socket.join(`route:${data.routeId}`);
    }
  });

  socket.on('disconnect', () => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    }
  });
});

// Start DB connection & HTTP Server
const startServer = async () => {
  try {
    await connectDB();
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
