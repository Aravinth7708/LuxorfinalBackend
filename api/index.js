// Vercel serverless entry point
import app from '../server.js';

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
export default app;
