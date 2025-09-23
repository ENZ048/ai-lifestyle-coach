require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const plansRouter = require('./routes/plans');
const { authenticate, optionalAuth } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// health
app.get('/', (req, res) => res.send('AI Lifestyle Coach Backend'));

// auth helper endpoint (client can check current user)
app.get('/auth/user', optionalAuth, (req, res) => {
  if (!req.user) return res.status(200).json({ authenticated: false });
  return res.status(200).json({ authenticated: true, user: req.user });
});

// Protected routes
app.use('/plans', authenticate, plansRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
