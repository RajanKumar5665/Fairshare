import { RoomMessage } from '../../models/roomMessage.model.js';
import { RoomMember } from '../../models/roomMember.js';

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function sendMessage(userId, roomId, data) {
  const member = await RoomMember.findOne({ roomId, userId, status: 'active' });
  if (!member) throw new AppError('Only active room members can send messages', 403);

  const isAnnouncement = Boolean(data.isAnnouncement);
  if (isAnnouncement && !['owner', 'admin'].includes(member.role)) {
    // If ordinary member wants to send announcement, allow with category general/maintenance
  }

  const message = await RoomMessage.create({
    roomId,
    senderId: userId,
    text: data.text.trim(),
    isAnnouncement,
    category: data.category || (isAnnouncement ? 'rent' : 'chat'),
    pinned: Boolean(data.pinned),
  });

  return message.populate('senderId', 'name mobile avatar');
}

export async function getMessages(roomId, query = {}) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(10, parseInt(query.limit) || 50));
  const skip = (page - 1) * limit;

  const filter = { roomId };
  if (query.isAnnouncement !== undefined) {
    filter.isAnnouncement = query.isAnnouncement === 'true' || query.isAnnouncement === true;
  }

  const [messages, total] = await Promise.all([
    RoomMessage.find(filter)
      .populate('senderId', 'name mobile avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    RoomMessage.countDocuments(filter),
  ]);

  return {
    messages: messages.reverse(), // Chronological for chat
    page,
    limit,
    total,
  };
}

export async function pinMessage(userId, roomId, messageId) {
  const message = await RoomMessage.findOne({ _id: messageId, roomId });
  if (!message) throw new AppError('Message not found', 404);

  message.pinned = !message.pinned;
  await message.save();
  return message;
}
