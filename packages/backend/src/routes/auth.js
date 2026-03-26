import { Router } from 'express';
import { loginOrRegister, findUser } from '../models/userManager.js';

const router = Router();

/**
 * POST /api/login — Log in or register a user.
 * Body: { username: string }
 * Response: { username, balance }
 */
router.post('/login', (req, res) => {
  const { username } = req.body ?? {};

  let result;
  try {
    result = loginOrRegister(username);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const { user } = result;

  // Store username on the express-session
  req.session.username = user.username;

  // Clear any stale game session so the user starts fresh
  delete req.session.gameSessionId;

  res.json({ username: user.username, balance: user.balance, coins: user.coins, activeFelt: user.activeFelt });
});

/**
 * GET /api/me — Return the currently logged-in user.
 * Response (200): { username, balance, coins, activeFelt }
 * Response (401): { error }
 */
router.get('/me', (req, res) => {
  const username = req.session?.username;
  if (!username) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  const user = findUser(username);
  if (!user) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  res.json({ username: user.username, balance: user.balance, coins: user.coins, activeFelt: user.activeFelt });
});

/**
 * POST /api/logout — Destroy the session and log out.
 * Response (200): { message }
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out' });
  });
});

export { router as authRoutes };
