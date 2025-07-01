// Vercel serverless entry point - redirects all API requests to the Express app
const app = require('../server');

// Add a global error handling middleware specifically for Vercel
if (!app._router.stack.some(layer => layer.name === 'vercelErrorHandler')) {
  app.use((err, req, res, next) => {
    console.error('[VERCEL ERROR]:', err);
    res.status(500).json({
      status: 'error',
      message: 'Internal Server Error',
      path: req.url,
      timestamp: new Date().toISOString()
    });
  });
}

// Export the Express app for Vercel serverless deployment
module.exports = app;
