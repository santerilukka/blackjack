/**
 * Middleware that rejects requests from users who are not logged in.
 */
export function authGuard(req, res, next) {
  if (!req.session?.username) {
    return res.status(401).json({ error: 'Not logged in. Call POST /api/login first.' });
  }
  next();
}
