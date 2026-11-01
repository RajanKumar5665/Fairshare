import { verifyAccessToken } from '../utils/token.js';

export function protect(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = verifyAccessToken(token);
    req.userId = decoded.sub;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

export const requireAuth = protect;