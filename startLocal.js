/**
 * This script starts the server with a forced local MongoDB connection
 * Useful for development when you can't access MongoDB Atlas
 */

// Override environment variables before importing the server
process.env.MONGO_URI = 'mongodb://localhost:27017/luxorLocal';
process.env.NODE_ENV = 'development';

// Now import and run the server
require('./server');

console.log('\n🚀 Server started with LOCAL MongoDB configuration');
console.log('💡 This is meant for development only');
console.log('📊 Data will be stored in the "luxorLocal" database\n');
