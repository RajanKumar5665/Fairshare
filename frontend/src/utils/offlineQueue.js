/**
 * Phase 11 — PWA & Offline Experience
 * Queues pending expense creations and settlements in offline mode.
 * Automatically synchronizes with backend on reconnection.
 */

const QUEUE_KEY = 'fairshare_offline_queue_v1';

export function getOfflineQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToOfflineQueue(item) {
  const queue = getOfflineQueue();
  const entry = {
    ...item,
    idempotencyKey: `OFFLINE_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    queuedAt: new Date().toISOString(),
  };
  queue.push(entry);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return entry;
}

export function removeFromOfflineQueue(idempotencyKey) {
  const queue = getOfflineQueue().filter((item) => item.idempotencyKey !== idempotencyKey);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function flushOfflineQueue(apiClient) {
  const queue = getOfflineQueue();
  if (!queue.length) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      if (item.type === 'expense') {
        await apiClient('/api/expenses', {
          method: 'POST',
          body: JSON.stringify(item.payload),
        });
      } else if (item.type === 'settlement') {
        await apiClient(`/api/rooms/${item.payload.roomId}/settlements`, {
          method: 'POST',
          body: JSON.stringify(item.payload),
        });
      }
      removeFromOfflineQueue(item.idempotencyKey);
      synced++;
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}
