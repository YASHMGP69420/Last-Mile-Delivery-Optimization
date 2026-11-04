const mongoose = require('mongoose');
const env = require('./env');

let isConnected = false;

const connectDB = async (customUri = null) => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const uri = customUri || env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartroute';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
    });
    isConnected = true;
    console.log(`[MongoDB] Connected to database: ${conn.connection.name} (${conn.connection.host})`);
    return conn.connection;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    if (process.env.NODE_ENV === 'test') {
      console.warn('[MongoDB] Running in test mode without primary DB. Checking mock/fallback...');
    }
    throw error;
  }
};

const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('[MongoDB] Disconnected from database');
  }
};

module.exports = {
  connectDB,
  disconnectDB,
};
