const mongoose = require('mongoose');

// Cache the database connection
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { 
    conn: null, 
    promise: null,
    retries: 0
  };
}

/**
 * Connect to MongoDB with connection pooling optimized for serverless
 */
async function dbConnect() {
  // If we already have a connection, use it
  if (cached.conn) {
    console.log('[DB] Using existing database connection');
    return cached.conn;
  }

  // If we're already connecting, wait for it to complete
  if (cached.promise) {
    console.log('[DB] Using existing connection promise');
    try {
      cached.conn = await cached.promise;
      return cached.conn;
    } catch (error) {
      console.error('[DB] Previous connection failed, retrying', error.message);
      // Previous attempt failed, reset promise to try again
      cached.promise = null;
      // Increment retry count and continue
      cached.retries++;
    }
  }

  // Maximum connection retries
  const MAX_RETRIES = 3;
  
  // Get MongoDB URI from environment variable
  const MONGO_URI = process.env.MONGO_URI;
  
  if (!MONGO_URI) {
    console.error('[DB] MONGO_URI is not defined in environment variables');
    throw new Error('MongoDB connection string is not defined');
  }

  // Only attempt to connect if we haven't exceeded retry count
  if (cached.retries >= MAX_RETRIES) {
    console.error(`[DB] Exceeded maximum retry attempts (${MAX_RETRIES})`);
    throw new Error(`Failed to connect to MongoDB after ${MAX_RETRIES} attempts`);
  }

  // Connection options
  const opts = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    bufferCommands: false,
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 60000,
    maxIdleTimeMS: 120000,
    maxPoolSize: 10,
    connectTimeoutMS: 30000
  };

  console.log('[DB] Connecting to MongoDB...');
  
  try {
    // Create a new connection promise
    cached.promise = mongoose.connect(MONGO_URI, opts).then(mongoose => {
      console.log('[DB] MongoDB connected successfully!');
      mongoose.connection.on('error', err => {
        console.error('[DB] MongoDB connection error:', err);
      });
      mongoose.connection.on('disconnected', () => {
        console.warn('[DB] MongoDB disconnected');
      });
      return mongoose;
    });

    // Await connection
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    console.error('[DB] MongoDB connection error:', error.message);
    
    // Reset promise so next request will try to connect again
    cached.promise = null;
    cached.retries++;
    
    throw error;
  }
}

module.exports = dbConnect;
