import { User } from '../models/user.model.js';

export async function requireAdmin(req, res, next) {
  try {
    const user = await User.findOne({ _id: req.userId, role: 'admin' }).select('_id role');
    if (!user) return res.status(403).json({ success: false, message: 'Admin access required' });
    req.admin = user;
    next();
  } catch (err) {
    next(err);
  }
}
