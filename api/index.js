// Vercel serverless entry point

const app = require('../server');

// Add global error handler for Vercel environment
app.use((err, req, res, next) => {
  console.error('[VERCEL ERROR]:', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal Server Error',
    path: req.url,
    timestamp: new Date().toISOString()
  });
});

// Export the app for Vercel serverless deployment
module.exports = app;
