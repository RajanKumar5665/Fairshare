import {
  createRoomSchema,
  updateRoomSchema,
  inviteSchema,
  joinRoomSchema,
  updateRoleSchema,
  transferOwnershipSchema,
} from './room.validation.js';
import * as roomService from './room.service.js';
import { User } from '../../models/user.model.js';
import { env } from '../../config/env.js';

const validate = (schema, body) => schema.validate(body);

export async function createRoom(req, res, next) {
  try {
    const { error, value } = validate(createRoomSchema, req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const room = await roomService.createRoom(req.userId, value);
    res.status(201).json({ success: true, room, inviteToken: room.inviteToken });
  } catch (err) {
    next(err);
  }
}

export async function listRooms(req, res, next) {
  try {
    const rooms = await roomService.getUserRooms(req.userId);
    const user = await User.findById(req.userId).select('roomSubscription');
    const hasCreatedRoom = rooms.some(
      (r) => r.createdBy && r.createdBy.toString() === req.userId.toString()
    );
    const isSubscribed =
      user?.roomSubscription?.status === 'active' &&
      user.roomSubscription.validUntil &&
      new Date(user.roomSubscription.validUntil) > new Date();

    res.json({
      success: true,
      rooms,
      hasCreatedRoom,
      isSubscribed: Boolean(isSubscribed),
      roomSubscription: user?.roomSubscription || { status: 'none' },
    });
  } catch (err) {
    next(err);
  }
}

export async function getRoom(req, res, next) {
  try {
    const room = await roomService.getRoomById(req.params.roomId);
    res.json({ success: true, room, myRole: req.roomMember?.role });
  } catch (err) {
    next(err);
  }
}

export async function updateRoom(req, res, next) {
  try {
    const { error, value } = validate(updateRoomSchema, req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const room = await roomService.updateRoom(req.params.roomId, value);
    res.json({ success: true, room });
  } catch (err) {
    next(err);
  }
}

export async function deleteRoom(req, res, next) {
  try {
    await roomService.deleteRoom(req.params.roomId);
    res.json({ success: true, message: 'Room archived' });
  } catch (err) {
    next(err);
  }
}

export async function listMembers(req, res, next) {
  try {
    const includePast = req.query.includePast !== 'false';
    const members = await roomService.getRoomMembers(req.params.roomId, { includePast });
    res.json({ success: true, members });
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req, res, next) {
  try {
    await roomService.removeMember(req.params.roomId, req.params.userId, req.userId);
    res.json({ success: true, message: 'Member removed from room' });
  } catch (err) {
    next(err);
  }
}

export async function updateMemberRole(req, res, next) {
  try {
    const { error, value } = validate(updateRoleSchema, req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const member = await roomService.updateMemberRole(req.params.roomId, req.params.userId, value.role);
    res.json({ success: true, member });
  } catch (err) {
    next(err);
  }
}

export async function transferOwnership(req, res, next) {
  try {
    const { error, value } = validate(transferOwnershipSchema, req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const result = await roomService.transferOwnership(req.params.roomId, req.userId, value.newOwnerId);
    res.json({ success: true, message: 'Room ownership transferred successfully', ...result });
  } catch (err) {
    next(err);
  }
}

export async function leaveRoom(req, res, next) {
  try {
    const result = await roomService.leaveRoom(req.params.roomId, req.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function invite(req, res, next) {
  try {
    const { error, value } = validate(inviteSchema, req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const token = await roomService.createInvitation(req.params.roomId, req.userId, value);
    const clientUrl = env.CLIENT_URL || 'http://localhost:5173';
    res.status(201).json({
      success: true,
      token,
      inviteLink: `${clientUrl}/join?token=${token}`,
    });
  } catch (err) {
    next(err);
  }
}

export async function listInvitations(req, res, next) {
  try {
    const invitations = await roomService.listInvitations(req.params.roomId);
    res.json({ success: true, invitations });
  } catch (err) {
    next(err);
  }
}

export async function revokeInvitation(req, res, next) {
  try {
    const result = await roomService.revokeInvitation(req.params.roomId, req.params.invitationId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getInvitationInfo(req, res, next) {
  try {
    const token = req.query.token;
    const info = await roomService.getInvitationInfo(token);
    res.json({ success: true, ...info });
  } catch (err) {
    next(err);
  }
}

export async function join(req, res, next) {
  try {
    const { error, value } = validate(joinRoomSchema, req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const roomId = await roomService.acceptInvitation(req.userId, value.token);
    res.json({ success: true, roomId });
  } catch (err) {
    next(err);
  }
}

export async function listExpenses(req, res, next) {
  try {
    const { month, status } = req.query;
    const expenses = await roomService.getRoomExpenses(req.params.roomId, { month, status });
    res.json({ success: true, expenses });
  } catch (err) {
    next(err);
  }
}

export async function getBalances(req, res, next) {
  try {
    const balances = await roomService.getRoomBalances(req.params.roomId, req.query);
    res.json({
      success: true,
      balances,
      summary: balances.summary || null,
      month: balances.month || null,
    });
  } catch (err) {
    next(err);
  }
}

export async function getDashboard(req, res, next) {
  try {
    const { getRoomDashboard } = await import('./roomDashboard.service.js');
    const dashboard = await getRoomDashboard(req.params.roomId);
    res.json({ success: true, dashboard });
  } catch (err) {
    next(err);
  }
}