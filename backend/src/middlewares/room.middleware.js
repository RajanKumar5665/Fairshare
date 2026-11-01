import { RoomMember } from '../models/roomMember.js';

export function requireRoomMember(roles = []) {
  return async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const member = await RoomMember.findOne({
        roomId,
        userId: req.userId,
        status: 'active',
      });

      if (!member) {
        return res.status(403).json({ success: false, message: 'Not a member of this room' });
      }

      if (roles.length && !roles.includes(member.role)) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions' });
      }

      req.roomMember = member;
      next();
    } catch (err) {
      next(err);
    }
  };
}