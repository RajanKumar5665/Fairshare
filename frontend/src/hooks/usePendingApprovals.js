import { useEffect, useSyncExternalStore } from 'react';
import { api, getAccessToken } from '../api/client';

// One shared copy of "expenses waiting for my approval" so the nav badge,
// dashboard banner and room page never disagree or fetch twice.
let state = { approvals: [], loaded: false };
const listeners = new Set();
let inflight = null;
let lastFetch = 0;

function emit(next) {
  state = next;
  listeners.forEach((l) => l());
}

export function refreshPendingApprovals({ force = false } = {}) {
  if (!getAccessToken()) return Promise.resolve(state);
  if (inflight) return inflight;
  if (!force && Date.now() - lastFetch < 15000) return Promise.resolve(state);
  inflight = api('/api/expenses/pending-approvals')
    .then((res) => {
      emit({ approvals: res.approvals || [], loaded: true });
      return state;
    })
    .catch(() => state)
    .finally(() => {
      lastFetch = Date.now();
      inflight = null;
    });
  return inflight;
}

/** Clear when the signed-in user changes (logout / switch account). */
export function resetPendingApprovals() {
  lastFetch = 0;
  emit({ approvals: [], loaded: false });
}

/** Call after approving/rejecting/adding so every badge updates. */
export function notifyApprovalsChanged() {
  refreshPendingApprovals({ force: true });
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePendingApprovals({ enabled = true } = {}) {
  const snapshot = useSyncExternalStore(subscribe, () => state);

  useEffect(() => {
    if (!enabled) return undefined;
    refreshPendingApprovals();
    const onFocus = () => refreshPendingApprovals();
    const onVisible = () => document.visibilityState === 'visible' && refreshPendingApprovals();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshPendingApprovals({ force: true });
    }, 60000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);

  return { ...snapshot, count: snapshot.approvals.length, refresh: notifyApprovalsChanged };
}
