// Vercel serverless entry point - redirects all API requests to the Express app

// Import the Express app
const app = require('../server');

// Export for Vercel serverless deployment
module.exports = app;
