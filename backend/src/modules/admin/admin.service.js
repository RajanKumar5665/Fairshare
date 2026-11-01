import { User } from '../../models/user.model.js';
import { Room } from '../../models/room.model.js';
import { RoomMember } from '../../models/roomMember.js';
import { Subscription } from '../../models/subscription.model.js';
import { AdminNotice } from '../../models/adminNotice.model.js';
import { RoomMessage } from '../../models/roomMessage.model.js';
import * as roomService from '../rooms/room.service.js';

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function getOverview() {
  const [users, rooms, activeSubscriptions, admins] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    Room.countDocuments({ status: 'active' }),
    User.countDocuments({ 'roomSubscription.status': 'active' }),
    User.countDocuments({ role: 'admin' }),
  ]);
  return { users, rooms, activeSubscriptions, admins };
}

export async function listRooms() {
  const rooms = await Room.find({ status: { $ne: 'archived' } })
    .populate('createdBy', 'name email mobile roomSubscription')
    .sort({ createdAt: -1 })
    .lean();

  const roomIds = rooms.map((room) => room._id);
  const [members, subscriptions] = await Promise.all([
    RoomMember.find({ roomId: { $in: roomIds }, status: 'active' })
      .populate('userId', 'name email mobile role')
      .lean(),
    Subscription.find({ roomId: { $in: roomIds } }).lean(),
  ]);

  const membersByRoom = new Map();
  for (const member of members) {
    const key = member.roomId.toString();
    if (!membersByRoom.has(key)) membersByRoom.set(key, []);
    membersByRoom.get(key).push(member);
  }
  const subscriptionByRoom = new Map(subscriptions.map((sub) => [sub.roomId.toString(), sub]));

  return rooms.map((room) => ({
    ...room,
    members: membersByRoom.get(room._id.toString()) || [],
    subscription: subscriptionByRoom.get(room._id.toString()) || null,
    ownerSubscription: room.createdBy?.roomSubscription || null,
  }));
}

export async function updateOwnerSubscription(roomId, data) {
  const room = await Room.findById(roomId).select('createdBy');
  if (!room) throw new AppError('Room not found', 404);
  const user = await User.findById(room.createdBy);
  if (!user) throw new AppError('Room owner not found', 404);

  user.roomSubscription = {
    ...(user.roomSubscription?.toObject?.() || user.roomSubscription || {}),
    ...data,
  };
  await user.save();
  return user.roomSubscription;
}

export async function sendOwnerNotice(adminId, roomId, { message, targetUserId }) {
  const room = await Room.findById(roomId).select('createdBy name');
  if (!room) throw new AppError('Room not found', 404);
  const owner = await RoomMember.findOne({ roomId, userId: room.createdBy, role: 'owner', status: 'active' });
  if (!owner) throw new AppError('Active room owner not found', 409);
  if (targetUserId) {
    const target = await RoomMember.exists({ roomId, userId: targetUserId, status: 'active' });
    if (!target) throw new AppError('Target member is not active in this room', 404);
  }
  const notice = await AdminNotice.create({
    roomId,
    ownerId: room.createdBy,
    targetUserId: targetUserId || null,
    adminId,
    message,
  });
  await RoomMessage.create({
    roomId,
    senderId: adminId,
    text: `[Admin notice to owner] ${message}`,
    isAnnouncement: true,
    category: 'general',
  });
  return notice;
}

export async function removeMemberAfterNotice(adminId, roomId, targetUserId) {
  const notice = await AdminNotice.findOne({
    roomId,
    adminId,
    targetUserId,
    status: 'sent',
  });
  if (!notice) throw new AppError('Send a notice to the room owner before removing this member', 428);
  const removed = await roomService.removeMember(roomId, targetUserId, adminId, { allowAdmin: true });
  notice.status = 'resolved';
  await notice.save();
  return removed;
}

export async function archiveRoom(adminId, roomId) {
  const room = await Room.findById(roomId);
  if (!room) throw new AppError('Room not found', 404);
  room.status = 'archived';
  await room.save();
  await RoomMember.updateMany({ roomId, status: 'active' }, {
    $set: { status: 'removed', leftAt: new Date(), membershipEndDate: new Date() },
  });
  await AdminNotice.create({
    roomId,
    ownerId: room.createdBy,
    adminId,
    message: 'This room has been archived by platform administration.',
  });
  return room;
}
