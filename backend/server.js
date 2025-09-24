require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const plansRouter = require('./routes/plans');
const profileRouter = require('./routes/profile');
const { authenticate, optionalAuth } = require('./middleware/auth');
const { requestLogger, errorLogger } = require('./middleware/logger');

const app = express();
app.use(cors());
app.use(bodyParser.json());
// HTTP request timing and basic logs
app.use(requestLogger);

// health
app.get('/', (req, res) => res.send('AI Lifestyle Coach Backend'));

// auth helper endpoint (client can check current user)
app.get('/auth/user', optionalAuth, (req, res) => {
  if (!req.user) return res.status(200).json({ authenticated: false });
  return res.status(200).json({ authenticated: true, user: req.user });
});

// Protected routes
app.use('/plans', authenticate, plansRouter);
app.use('/profile', authenticate, profileRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});

// Centralized error logging (must be after all routes)
app.use(errorLogger);

// Global error handlers
process.on('unhandledRejection', (reason) => {
  console.error(new Date().toISOString(), 'UNHANDLED_REJECTION', reason);
});
process.on('uncaughtException', (err) => {
  console.error(new Date().toISOString(), 'UNCAUGHT_EXCEPTION', err);
});
