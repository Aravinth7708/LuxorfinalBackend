// Vercel serverless entry point

const app = require('../server');

// Export the app for Vercel serverless deployment
module.exports = app;
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
