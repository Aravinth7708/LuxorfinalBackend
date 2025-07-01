import mongoose from 'mongoose';

// Configure mongoose for better error handling
mongoose.set('strictQuery', false);

// Cache connection for reuse
let cachedConnection = null;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;

/**
 * Connect to MongoDB using environment variables
 */
const connectDB = async () => {
  // If we already have a connection, return it
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log('[DB] Using existing database connection');
    return cachedConnection;
  }

  try {
    // Limit reconnection attempts
    if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
      console.error(`[DB] Failed to connect after ${MAX_CONNECTION_ATTEMPTS} attempts`);
      throw new Error('Maximum connection attempts exceeded');
    }

    connectionAttempts++;

    // Get MongoDB URI from environment variable
    const uri = process.env.MONGO_URI;
    
    if (!uri) {
      throw new Error('MONGO_URI environment variable is not defined');
    }

    // Prepare connection options (compatible with MongoDB 6+)
    const connectionOptions = {
      serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
      socketTimeoutMS: 60000,          // Keep socket alive longer
      connectTimeoutMS: 30000,         // Connection timeout
      maxPoolSize: 10,                 // Max connection pool size
      retryWrites: true,
      w: 'majority',
      keepAlive: true
    };

    console.log('[DB] Connecting to MongoDB...');

    // Connect to the database
    const conn = await mongoose.connect(uri, connectionOptions);

    // Setup connection event handlers for better debugging
    mongoose.connection.on('connected', () => {
      console.log('[DB] MongoDB connection established');
    });

    mongoose.connection.on('error', (err) => {
      console.error('[DB] MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] MongoDB connection disconnected');
    });

    // Handle process termination gracefully
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('[DB] MongoDB connection closed due to app termination');
      process.exit(0);
    });

    console.log(`[DB] MongoDB connected: ${mongoose.connection.host}`);
    
    // Cache the connection
    cachedConnection = conn;
    return conn;
  } catch (error) {
    console.error('[DB] Error connecting to MongoDB:', error.message);
    // Wait before retrying connection
    await new Promise(resolve => setTimeout(resolve, 5000));
    return connectDB(); // Recursive retry
  }
};

export default connectDB;
