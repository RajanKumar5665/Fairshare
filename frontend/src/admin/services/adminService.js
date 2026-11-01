import { api } from '../api';

export const adminService = {
  getOverview: () => api('/api/admin/overview'),
  getRooms: () => api('/api/admin/rooms'),
  updateSubscription: (roomId, payload) => api(`/api/admin/rooms/${roomId}/subscription`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  sendNotice: (roomId, payload) => api(`/api/admin/rooms/${roomId}/notices`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  removeMember: (roomId, userId) => api(`/api/admin/rooms/${roomId}/members/${userId}`, {
    method: 'DELETE',
  }),
  archiveRoom: (roomId) => api(`/api/admin/rooms/${roomId}`, { method: 'DELETE' }),
};
