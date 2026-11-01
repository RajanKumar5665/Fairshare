import * as chatService from './chat.service.js';

export async function sendMessage(req, res, next) {
  try {
    const message = await chatService.sendMessage(
      req.userId,
      req.params.roomId,
      req.body
    );
    res.status(201).json({ success: true, message });
  } catch (err) {
    next(err);
  }
}

export async function getMessages(req, res, next) {
  try {
    const data = await chatService.getMessages(req.params.roomId, req.query);
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function pinMessage(req, res, next) {
  try {
    const message = await chatService.pinMessage(
      req.userId,
      req.params.roomId,
      req.params.messageId
    );
    res.json({ success: true, message });
  } catch (err) {
    next(err);
  }
}
