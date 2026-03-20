import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { authRoutes } from './routes/auth.js';
import { sessionRoutes } from './routes/session.js';
import { gameRoutes } from './routes/game.js';
import { authGuard } from './middleware/authGuard.js';

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

app.use(session({
  secret: 'blackjack-dev-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, httpOnly: true, maxAge: 1000 * 60 * 60 },
}));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', authRoutes);
app.use('/api', authGuard, sessionRoutes);
app.use('/api', authGuard, gameRoutes);

export { app };
