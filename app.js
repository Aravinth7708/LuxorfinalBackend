const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth');
const villaRoutes = require('./routes/villas');
const bookingRoutes = require('./routes/bookings');
const contactRoutes = require('./routes/contactRoutes');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/villas', villaRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/contact', contactRoutes);

// Add global error handler middleware before other middlewares
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  // Set proper content type for JSON
  res.setHeader('Content-Type', 'application/json');
  
  // Handle various types of errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation Error', details: err.message });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Unauthorized', details: 'Invalid token' });
  }
  
  // Default error response
  return res.status(err.status || 500).json({
    error: err.message || 'Something went wrong',
    status: err.status || 500
  });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('MongoDB connected');
  // Start the server only after successful DB connection
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});