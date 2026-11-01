import { noticeSchema, subscriptionSchema } from './admin.validation.js';
import * as adminService from './admin.service.js';

const validate = (schema, body) => schema.validate(body);

export async function overview(req, res, next) {
  try {
    res.json({ success: true, ...(await adminService.getOverview()) });
  } catch (err) {
    next(err);
  }
}

export async function rooms(req, res, next) {
  try {
    res.json({ success: true, rooms: await adminService.listRooms() });
  } catch (err) {
    next(err);
  }
}

export async function updateSubscription(req, res, next) {
  try {
    const { error, value } = validate(subscriptionSchema, req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const subscription = await adminService.updateOwnerSubscription(req.params.roomId, value);
    res.json({ success: true, subscription });
  } catch (err) {
    next(err);
  }
}

export async function sendNotice(req, res, next) {
  try {
    const { error, value } = validate(noticeSchema, req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const notice = await adminService.sendOwnerNotice(req.userId, req.params.roomId, value);
    res.status(201).json({ success: true, notice });
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req, res, next) {
  try {
    const member = await adminService.removeMemberAfterNotice(req.userId, req.params.roomId, req.params.userId);
    res.json({ success: true, member });
  } catch (err) {
    next(err);
  }
}

export async function archiveRoom(req, res, next) {
  try {
    const result = await adminService.archiveRoom(req.userId, req.params.roomId);
    res.json({ success: true, room: result });
  } catch (err) {
    next(err);
  }
}
