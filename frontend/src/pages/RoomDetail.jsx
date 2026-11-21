import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  HiCheck,
  HiDuplicate,
  HiOutlineArrowLeft,
  HiOutlineBell,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineLogout,
  HiOutlinePlus,
  HiOutlineShieldCheck,
  HiOutlineUserAdd,
  HiOutlineX,
} from 'react-icons/hi';
import { SiWhatsapp } from 'react-icons/si';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatINR } from '../utils/money';
import { notifyApprovalsChanged } from '../hooks/usePendingApprovals';
import ExpenseSheet from './room/ExpenseSheet';
import SettleUpTab from './room/SettleUpTab';
import { Avatar, ExpenseCard, PaymentSheet, RejectSheet } from './room/RoomParts';
import { formatInviteCode, sameId, toInputDate, typeMeta } from './room/roomUtils';
import { CycleBanner, DuesBanner, HistoryTab } from './room/CycleParts';

const TABS = [
  { id: 'expenses', label: 'Expenses' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'settle', label: 'Settle' },
  { id: 'history', label: 'History', roomsOnly: true },
  { id: 'members', label: 'Members' },
];

/** Normalise an /expenses row (populated paidBy) to the report row shape. */
function toRow(e) {
  return {
    _id: e._id,
    title: e.title,
    category: e.category,
    expenseDate: e.expenseDate,
    amountPaise: e.amountInSmallestUnit,
    status: e.status,
    paidById: String(e.paidBy?._id || e.paidBy || ''),
    paidByName: e.paidBy?.name || 'Former member',
    createdById: String(e.createdBy?._id || e.createdBy || ''),
    rejectionReason: e.rejectionReason || '',
    participants: e.participants || [],
  };
}

export default function RoomDetail() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const me = String(user?._id || user?.id || '');

  const tabParam = searchParams.get('tab');
  const tab = TABS.some((x) => x.id === tabParam) ? tabParam : 'expenses';
  const setTab = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    next.delete('invite');
    setSearchParams(next, { replace: true });
  };

  // Period shown: 'c3' = Month 3 of a flat, 'all' = whole history (trips/groups always 'all')
  const [month, setMonth] = useState(null);
  const [cycleInfo, setCycleInfo] = useState({ usesCycles: false, current: null, cycles: [] });

  const [room, setRoom] = useState(null);
  const [myRole, setMyRole] = useState('member');
  const [members, setMembers] = useState([]);
  const [report, setReport] = useState(null);
  const [openItems, setOpenItems] = useState([]); // pending + rejected, all months
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payerFilter, setPayerFilter] = useState('all');

  const [sheet, setSheet] = useState(null); // { kind: 'add' } | { kind: 'edit', expense }
  const [rejecting, setRejecting] = useState(null);
  const [paying, setPaying] = useState(null); // { transfer, mode }
  const [inviteOpen, setInviteOpen] = useState(searchParams.get('invite') === '1');
  useEffect(() => {
    if (room && myRole !== 'owner') setInviteOpen(false);
  }, [room, myRole]);

  const isAdmin = ['owner', 'admin'].includes(myRole);
  const isOwner = myRole === 'owner';
  const requireApproval = room?.settings?.requireApproval !== false;
  const canInvite = isOwner; // only the person who created the group can invite
  const groupType = room?.type || 'room';
  const meta = typeMeta(groupType);
  const allLabel = groupType === 'trip' ? t('Whole trip') : t('All time');
  const usesCycles = cycleInfo.usesCycles;
  const currentCycle = cycleInfo.current;
  const viewedCycle = month?.startsWith('c') ? Number(month.slice(1)) : null;
  const isFinished = Boolean(room?.isClosed);
  const canAdd = !isFinished;
  const periodTitle = (style) => {
    if (month === 'all') return allLabel;
    if (!viewedCycle) return '';
    if (style === 'short') return t('Month {n}', { n: viewedCycle });
    return report?.cycle?.index === viewedCycle ? report.monthLabel : t('Month {n}', { n: viewedCycle });
  };
  const visibleTabs = TABS.filter((x) => !x.roomsOnly || usesCycles);

  const loadRoom = useCallback(async () => {
    const [roomRes, membersRes, balRes, openRes, cycleRes] = await Promise.all([
      api(`/api/rooms/${roomId}`),
      api(`/api/rooms/${roomId}/members?includePast=false`),
      api(`/api/rooms/${roomId}/balances`),
      api(`/api/rooms/${roomId}/expenses?status=pending_review,rejected&limit=200`),
      api(`/api/rooms/${roomId}/cycles`),
    ]);
    setRoom(roomRes.room);
    setMyRole(roomRes.myRole || 'member');
    setCycleInfo({ usesCycles: Boolean(cycleRes.usesCycles), current: cycleRes.current, cycles: cycleRes.cycles || [] });
    // Flats open on the current month; trips/groups are settled as a whole.
    setMonth((m) => m || (cycleRes.usesCycles ? `c${cycleRes.current.index}` : 'all'));
    setMembers(
      (membersRes.members || [])
        .filter((m) => m.userId)
        .map((m) => ({ id: String(m.userId._id), name: m.userId.name || 'Roommate', role: m.role })),
    );
    setBalances(balRes.balances || []);
    setOpenItems((openRes.expenses || []).map(toRow));
  }, [roomId]);

  const loadReport = useCallback(async () => {
    if (!month) return;
    setReportLoading(true);
    try {
      const query = month.startsWith('c') ? `cycle=${month.slice(1)}` : `month=${month}`;
      const res = await api(`/api/rooms/${roomId}/monthly-report?${query}`);
      setReport(res.report);
    } finally {
      setReportLoading(false);
    }
  }, [roomId, month]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadRoom()
      .catch((err) => {
        if (!alive) return;
        if (/not a member|not found/i.test(err.message)) setNotFound(true);
        else toast.error(err.message || t('Failed to load room'));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [loadRoom]);

  useEffect(() => {
    loadReport().catch((err) => toast.error(err.message || t('Failed to load month')));
  }, [loadReport]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadRoom(), loadReport()]).catch((err) => toast.error(err.message));
    notifyApprovalsChanged();
  }, [loadRoom, loadReport]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const needsMe = useMemo(
    () =>
      openItems.filter(
        (e) => e.status === 'pending_review' && e.participants.some((p) => sameId(p.userId, me) && p.reviewStatus === 'pending'),
      ),
    [openItems, me],
  );
  const waitingOthers = useMemo(
    () => openItems.filter((e) => e.status === 'pending_review' && !needsMe.includes(e)),
    [openItems, needsMe],
  );
  const rejected = useMemo(() => openItems.filter((e) => e.status === 'rejected'), [openItems]);

  const monthExpenses = useMemo(() => {
    const list = [...(report?.expenses || [])].sort(
      (a, b) => new Date(b.expenseDate) - new Date(a.expenseDate),
    );
    return payerFilter === 'all' ? list : list.filter((e) => sameId(e.paidById, payerFilter));
  }, [report, payerFilter]);

  const payers = useMemo(() => {
    const map = new Map();
    for (const e of report?.expenses || []) {
      if (e.status === 'rejected') continue;
      const cur = map.get(e.paidById) || { id: e.paidById, name: e.paidByName, total: 0 };
      cur.total += e.amountPaise;
      map.set(e.paidById, cur);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [report]);

  const myLine = report?.members.find((m) => sameId(m.userId, me));
  const myAllTime = balances.find((b) => sameId(b.userId, me));
  const canManage = (e) => sameId(e.paidById, me) || sameId(e.createdById, me) || isAdmin;

  // ── Actions ────────────────────────────────────────────────────────────────
  async function run(fn, success) {
    setBusy(true);
    try {
      await fn();
      if (success) toast.success(success);
      await refreshAll();
      return true;
    } catch (err) {
      toast.error(err.message || t('Something went wrong'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const approve = (e) =>
    run(
      () => api(`/api/rooms/${roomId}/expenses/${e._id}/review`, { method: 'POST', body: JSON.stringify({ action: 'approve' }) }),
      t('Approved ✓'),
    );

  const reject = async (note) => {
    const ok = await run(
      () =>
        api(`/api/rooms/${roomId}/expenses/${rejecting._id}/review`, {
          method: 'POST',
          body: JSON.stringify({ action: 'reject', note }),
        }),
      t('Rejected — they have been told why'),
    );
    if (ok) setRejecting(null);
  };

  const remove = (e) => {
    if (!window.confirm(t('Delete “{title}”? This cannot be undone.', { title: e.title }))) return;
    run(() => api(`/api/expenses/${e._id}`, { method: 'DELETE' }), t('Expense deleted'));
  };

  const recordPayment = async (values) => {
    const { transfer, mode } = paying;
    const body = {
      ...values,
      paidTo: transfer.to,
      ...(report?.cycle ? { cycle: report.cycle.index } : {}),
      ...(mode === 'received' ? { paidBy: transfer.from } : {}),
    };
    const ok = await run(
      () => api(`/api/rooms/${roomId}/settlements`, { method: 'POST', body: JSON.stringify(body) }),
      mode === 'paid' ? t('Marked as paid — waiting for {name} to confirm', { name: transfer.toName }) : t('Payment recorded'),
    );
    if (ok) setPaying(null);
  };

  const confirmPayment = (s) =>
    run(
      () => api(`/api/rooms/${roomId}/settlements/${s._id}/confirm`, { method: 'PATCH', body: '{}' }),
      t('Payment confirmed'),
    );

  const rejectPayment = (s) => {
    const reason = window.prompt(
      t("Why didn't you receive {amount} from {name}?", { amount: formatINR(s.amountPaise), name: s.fromName }),
      t('Not received yet'),
    );
    if (reason === null) return;
    if (reason.trim().length < 3) return toast.error(t('Please write a short reason'));
    run(
      () =>
        api(`/api/rooms/${roomId}/settlements/${s._id}/reverse`, {
          method: 'POST',
          body: JSON.stringify({ reason: reason.trim() }),
        }),
      t('Marked as not received'),
    );
  };

  async function closeMonthNow() {
    const n = currentCycle.index;
    if (
      !window.confirm(
        t(
          'Settle Month {n} now?\n\n• The hisaab so far is saved in History\n• Everyone can then pay what they owe\n• Month {next} starts today\n• Pending expenses move to Month {next}\n\nThis cannot be undone.',
          { n, next: n + 1 },
        ),
      )
    )
      return;
    const ok = await run(
      () => api(`/api/rooms/${roomId}/cycles/close`, { method: 'POST' }),
      t('Month {n} settled — Month {next} has started', { n, next: n + 1 }),
    );
    if (ok) {
      setMonth(`c${n}`);
      setTab('settle');
    }
  }

  async function setFinished(finished) {
    const isTrip = groupType === 'trip';
    const msg = finished
      ? isTrip
        ? t('Finish this trip?\n\nNo one can add new expenses after this. Everyone can still see the final settle-up and record payments. You can reopen it later.')
        : t('Finish this group?\n\nNo one can add new expenses after this. Everyone can still see the final settle-up and record payments. You can reopen it later.')
      : isTrip
        ? t('Reopen this trip so people can add expenses again?')
        : t('Reopen this group so people can add expenses again?');
    if (!window.confirm(msg)) return;
    await run(
      () => api(`/api/rooms/${roomId}/finish`, { method: 'POST', body: JSON.stringify({ finished }) }),
      finished ? (isTrip ? t('Trip finished — settle up below') : t('Group finished — settle up below')) : t('Reopened'),
    );
    if (finished) setTab('settle');
  }

  const toggleApproval = () =>
    run(
      () =>
        api(`/api/rooms/${roomId}`, {
          method: 'PATCH',
          body: JSON.stringify({ settings: { requireApproval: !requireApproval } }),
        }),
      !requireApproval ? t('New expenses will need approval') : t('Approval turned off for new expenses'),
    );

  async function leaveRoom() {
    if (!window.confirm(t('Leave {name}? You need a zero balance to leave.', { name: room.name }))) return;
    setBusy(true);
    try {
      await api(`/api/rooms/${roomId}/leave`, { method: 'POST' });
      toast.success(t('You left the room'));
      navigate('/rooms');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="d-page">
        <div className="skeleton skeleton-card" style={{ height: 160, borderRadius: 24 }} />
        <div className="d-stats" style={{ marginTop: 16 }}>
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
        </div>
      </div>
    );
  }

  if (notFound || !room) {
    return (
      <div className="d-page">
        <div className="d-empty">
          <h3>{t('Group not found')}</h3>
          <p className="muted">{t('It may have been archived, or you are no longer a member.')}</p>
          <button className="btn-primary" onClick={() => navigate('/rooms')}>
            {t('Back to groups')}
          </button>
        </div>
      </div>
    );
  }

  const approvalsCount = needsMe.length;
  const monthTotal = report?.totals.approvedPaise || 0;

  return (
    <div className="d-page rd-page rx-page">
      <section className="d-hero rd-hero dx-hero">
        <div className="dx-hero-top">
          <button type="button" className="dx-chip" onClick={() => navigate('/rooms')}>
            <HiOutlineArrowLeft size={15} /> {t('Groups')}
          </button>
          {canInvite && (
            <button type="button" className="dx-chip strong" onClick={() => setInviteOpen(true)}>
              <HiOutlineUserAdd size={15} /> {t('Invite')}
            </button>
          )}
        </div>
        <div className="dx-room-title">
          <h1>
            <span aria-hidden="true">{meta.emoji} </span>
            {room.name}
          </h1>
          <p>
            {[
              room.address || room.description,
              members.length === 1 ? t('{n} person', { n: members.length }) : t('{n} people', { n: members.length }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="dx-amount">
          <span>{t('{period} total', { period: periodTitle('short') })}</span>
          <strong>{reportLoading && !report ? '—' : formatINR(monthTotal)}</strong>
        </div>
      </section>

      <div className="d-stats rx-stats">
        <div className="d-stat">
          <div className="d-stat-lbl">{t('You paid')}</div>
          <div className="d-stat-val">{formatINR(myLine?.paidPaise || 0)}</div>
          <small className="muted">{month === 'all' ? allLabel.toLowerCase() : t('in {period}', { period: periodTitle('short') })}</small>
        </div>
        <div className="d-stat">
          <div className="d-stat-lbl">{t('Your share')}</div>
          <div className="d-stat-val">{formatINR(myLine?.sharePaise || 0)}</div>
          <small className="muted">{t('what you used')}</small>
        </div>
        <div className="d-stat">
          <div className="d-stat-lbl">{t('Overall balance')}</div>
          <div className={`d-stat-val ${myAllTime?.netPaise > 0 ? 'rx-amt-pos' : myAllTime?.netPaise < 0 ? 'rx-amt-neg' : ''}`}>
            {!myAllTime || myAllTime.netPaise === 0
              ? t('All even')
              : myAllTime.netPaise > 0
                ? `+${formatINR(myAllTime.netPaise)}`
                : `−${formatINR(-myAllTime.netPaise)}`}
          </div>
          <small className="muted">
            {!myAllTime || myAllTime.netPaise === 0 ? t('nothing pending') : myAllTime.netPaise > 0 ? t('you get back') : t('you owe')}
          </small>
        </div>
      </div>

      <DuesBanner
        cycles={cycleInfo.cycles}
        hidden={tab === 'history'}
        onOpen={(index) => {
          setMonth(`c${index}`);
          setTab('settle');
        }}
      />

      {approvalsCount > 0 && tab !== 'approvals' && (
        <button type="button" className="rx-alert" onClick={() => setTab('approvals')}>
          <span className="rx-alert-ico">
            <HiOutlineBell size={18} />
          </span>
          <span className="rx-alert-text">
            <strong>
              {approvalsCount === 1
                ? t('{n} expense needs your approval', { n: approvalsCount })
                : t('{n} expenses need your approval', { n: approvalsCount })}
            </strong>
            <small>{t('They won’t count until you approve.')}</small>
          </span>
          <span className="rx-alert-cta">{t('Review')}</span>
        </button>
      )}

      <div className="rx-tabs" role="tablist" aria-label={t('Room sections')}>
        {visibleTabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            role="tab"
            aria-selected={tab === tb.id}
            className={`rx-tab ${tab === tb.id ? 'active' : ''}`}
            onClick={() => setTab(tb.id)}
          >
            {t(tb.label)}
            {tb.id === 'approvals' && approvalsCount > 0 && <span className="rx-tab-badge">{approvalsCount}</span>}
          </button>
        ))}
      </div>

      {(tab === 'expenses' || tab === 'settle') && usesCycles && month && currentCycle && (
        <div className="rx-month">
          <button
            type="button"
            aria-label={t('Previous month')}
            disabled={viewedCycle === 1}
            onClick={() => setMonth(month === 'all' ? `c${currentCycle.index}` : `c${Math.max(1, viewedCycle - 1)}`)}
          >
            <HiOutlineChevronLeft size={18} />
          </button>
          <span className="rx-month-title">
            <strong>{month === 'all' ? allLabel : t('Month {n}', { n: viewedCycle })}</strong>
            <small className="muted">
              {month === 'all'
                ? t('every month together')
                : viewedCycle < currentCycle.index
                  ? t('settled · {range}', {
                      range: (report?.cycle?.index === viewedCycle ? report.monthLabel.split(' · ')[1] : '') || '',
                    })
                  : t('running since {date}', {
                      date: new Date(currentCycle.start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                    })}
            </small>
          </span>
          <button
            type="button"
            aria-label={t('Next month')}
            disabled={month === 'all' || viewedCycle >= currentCycle.index}
            onClick={() => setMonth(`c${viewedCycle + 1}`)}
          >
            <HiOutlineChevronRight size={18} />
          </button>
          <button
            type="button"
            className={`rx-all-toggle ${month === 'all' ? 'on' : ''}`}
            onClick={() => setMonth(month === 'all' ? `c${currentCycle.index}` : 'all')}
          >
            {month === 'all' ? t('By month') : t('All time')}
          </button>
        </div>
      )}

      {tab === 'settle' && (
        <CycleBanner
          groupType={groupType}
          usesCycles={usesCycles}
          report={report}
          currentCycle={currentCycle}
          isOwner={isOwner}
          isFinished={isFinished}
          closedAt={room.closedAt}
          busy={busy}
          onCloseNow={closeMonthNow}
          onFinish={() => setFinished(true)}
          onReopen={() => setFinished(false)}
          onGoCurrent={() => setMonth(`c${currentCycle.index}`)}
        />
      )}

      {/* ── Expenses ─────────────────────────────────────────────────────── */}
      {(tab === 'expenses' || (tab === 'history' && !usesCycles)) && (
        <section className="rx-stack" role="tabpanel">
          <div className="rx-section-head">
            <div>
              <h2>{t('Expenses')}</h2>
            </div>
            {canAdd && (
              <button type="button" className="btn-primary d-add-desktop" onClick={() => setSheet({ kind: 'add' })}>
                <HiOutlinePlus size={17} /> {t('Add expense')}
              </button>
            )}
          </div>

          {payers.length > 1 && (
            <div className="d-chips">
              <button type="button" className={`d-chip ${payerFilter === 'all' ? 'active' : ''}`} onClick={() => setPayerFilter('all')}>
                {t('Everyone')}
              </button>
              {payers.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className={`d-chip ${payerFilter === p.id ? 'active' : ''}`}
                  onClick={() => setPayerFilter(payerFilter === p.id ? 'all' : p.id)}
                >
                  {sameId(p.id, me) ? t('You') : p.name} · {formatINR(p.total)}
                </button>
              ))}
            </div>
          )}

          {reportLoading && !report ? (
            <div className="d-list">
              <div className="skeleton skeleton-card" />
              <div className="skeleton skeleton-card" />
            </div>
          ) : monthExpenses.length === 0 ? (
            <div className="d-empty">
              <div className="d-empty-ico">
                <HiOutlinePlus size={28} />
              </div>
              <h3>{month === 'all' ? t('No expenses yet') : t('No expenses in {period}', { period: periodTitle('short') })}</h3>
              <p className="muted">
                {groupType === 'trip'
                  ? t('Add food, stay, cabs, tickets — whoever paid, the app works out who owes whom.')
                  : t('Add groceries, bills or rent — everyone sees it and approves it.')}
              </p>
              {canAdd && (
                <button type="button" className="btn-primary" onClick={() => setSheet({ kind: 'add' })}>
                  {t('Add the first expense')}
                </button>
              )}
            </div>
          ) : (
            <div className="d-list">
              {monthExpenses.map((e) => (
                <ExpenseCard monthlyEqual={groupType === 'room'}
                  key={e._id}
                  expense={e}
                  me={me}
                  busy={busy}
                  canManage={canManage(e)}
                  onApprove={approve}
                  onReject={setRejecting}
                  onEdit={(x) => setSheet({ kind: 'edit', expense: x })}
                  onDelete={remove}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Approvals ────────────────────────────────────────────────────── */}
      {tab === 'approvals' && (
        <section className="rx-stack" role="tabpanel">
          <div className="rx-section-head">
            <div>
              <h2>{t('Approvals')}</h2>
              <p className="muted">
                {requireApproval
                  ? t('An expense counts only after everyone in its split approves it.')
                  : t('Approval is turned off for new expenses in this room.')}
              </p>
            </div>
          </div>

          <h3 className="rx-group-title">{t('Waiting for you')} {needsMe.length > 0 && <span className="rx-tab-badge">{needsMe.length}</span>}</h3>
          {needsMe.length === 0 ? (
            <p className="muted rx-empty-line">
              <HiCheck size={14} /> {t('You’re all caught up.')}
            </p>
          ) : (
            <div className="d-list">
              {needsMe.map((e) => (
                <ExpenseCard monthlyEqual={groupType === 'room'}
                  key={e._id}
                  expense={e}
                  me={me}
                  busy={busy}
                  canManage={canManage(e)}
                  onApprove={approve}
                  onReject={setRejecting}
                  onEdit={(x) => setSheet({ kind: 'edit', expense: x })}
                  onDelete={remove}
                />
              ))}
            </div>
          )}

          {waitingOthers.length > 0 && (
            <>
              <h3 className="rx-group-title">{t('Waiting for others')}</h3>
              <div className="d-list">
                {waitingOthers.map((e) => (
                  <ExpenseCard monthlyEqual={groupType === 'room'}
                    key={e._id}
                    expense={e}
                    me={me}
                    busy={busy}
                    canManage={canManage(e)}
                    onApprove={approve}
                    onReject={setRejecting}
                    onEdit={(x) => setSheet({ kind: 'edit', expense: x })}
                    onDelete={remove}
                  />
                ))}
              </div>
            </>
          )}

          {rejected.length > 0 && (
            <>
              <h3 className="rx-group-title">{t('Rejected')}</h3>
              <div className="d-list">
                {rejected.map((e) => (
                  <ExpenseCard monthlyEqual={groupType === 'room'}
                    key={e._id}
                    expense={e}
                    me={me}
                    busy={busy}
                    canManage={canManage(e)}
                    defaultOpen={sameId(e.paidById, me)}
                    onApprove={approve}
                    onReject={setRejecting}
                    onEdit={(x) => setSheet({ kind: 'edit', expense: x })}
                    onDelete={remove}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* ── Settle up ────────────────────────────────────────────────────── */}
      {tab === 'settle' &&
        (report ? (
          <SettleUpTab
            report={report}
            me={me}
            isAdmin={isAdmin}
            busy={busy}
            paymentsEnabled={!usesCycles || Boolean(report.cycle && !report.cycle.isCurrent)}
            paymentsNote={
              !usesCycles
                ? null
                : report.cycle?.isCurrent
                  ? isOwner
                    ? t('This is the running calculation. Payments start after Month {n} is settled — tap “Settle now” when everyone is ready.', { n: report.cycle.index })
                    : t('This is the running calculation. Payments start after Month {n} is settled by the owner.', { n: report.cycle.index })
                  : t('All-time view is for checking only. Pay month by month from the History tab.')
            }
            onPay={(t) => setPaying({ transfer: t, mode: 'paid' })}
            onReceive={(t) => setPaying({ transfer: t, mode: 'received' })}
            onConfirm={confirmPayment}
            onRejectPayment={rejectPayment}
            onShowPending={() => setTab('approvals')}
          />
        ) : (
          <div className="skeleton skeleton-card" style={{ height: 240 }} />
        ))}

      {/* ── History (flats) ─────────────────────────────────────────────── */}
      {tab === 'history' && usesCycles && (
        <HistoryTab
          info={cycleInfo}
          me={me}
          onOpen={(index) => {
            setMonth(`c${index}`);
            setTab('settle');
          }}
        />
      )}

      {/* ── Members ──────────────────────────────────────────────────────── */}
      {tab === 'members' && (
        <section className="rx-stack" role="tabpanel">
          <div className="rx-section-head">
            <div>
              <h2>{t('Members')}</h2>
              <p className="muted">{t('{n} people · overall balance', { n: balances.filter((b) => b.isCurrentMember).length })}</p>
            </div>
            {canInvite && (
              <button type="button" className="btn-ghost btn-sm" onClick={() => setInviteOpen(true)}>
                <HiOutlineUserAdd size={15} /> {t('Invite')}
              </button>
            )}
          </div>

          <ul className="rx-members">
            {balances
              .filter((b) => b.isCurrentMember || b.netPaise !== 0)
              .map((b) => (
                <li key={b.userId}>
                  <Avatar name={b.name} size={40} />
                  <div className="rx-member-main">
                    <strong className="rx-ellipsis">
                      {b.name}
                      {sameId(b.userId, me) ? ` (${t('you')})` : ''}
                    </strong>
                    <small className="muted">
                      {b.isCurrentMember ? (b.role === 'owner' ? t('Owner') : b.role === 'admin' ? t('Admin') : t('Member')) : t('Moved out')}
                    </small>
                  </div>
                  <div className="rx-member-bal">
                    {b.netPaise > 0 ? (
                      <span className="rx-amt-pos">{t('gets {amount}', { amount: formatINR(b.netPaise) })}</span>
                    ) : b.netPaise < 0 ? (
                      <span className="rx-amt-neg">{t('owes {amount}', { amount: formatINR(-b.netPaise) })}</span>
                    ) : (
                      <span className="rx-amt-zero">{t('even')}</span>
                    )}
                  </div>
                </li>
              ))}
          </ul>

          <div className="rx-card rx-setting">
            <span className="rx-setting-ico">
              <HiOutlineShieldCheck size={20} />
            </span>
            <div className="rx-setting-main">
              <strong>{t('Roommates approve every expense')}</strong>
              <small className="muted">
                {requireApproval
                  ? t('On — new expenses count only after everyone in the split approves.')
                  : t('Off — new expenses count immediately.')}
              </small>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={requireApproval}
              aria-label={t('Require approval for new expenses')}
              className={`rx-switch ${requireApproval ? 'on' : ''}`}
              disabled={!isAdmin || busy}
              title={isAdmin ? '' : t('Only the owner or an admin can change this')}
              onClick={toggleApproval}
            >
              <span />
            </button>
          </div>

          {!isOwner && (
            <p className="muted text-xs rx-empty-line">
              {t('Only the person who created this group can invite new people. Ask them for the link.')}
            </p>
          )}

          {!isOwner && (
            <button type="button" className="btn-ghost rx-danger rx-leave" onClick={leaveRoom} disabled={busy}>
              <HiOutlineLogout size={16} /> {t('Leave group')}
            </button>
          )}
        </section>
      )}

      {canAdd && !sheet && !rejecting && !paying && !inviteOpen && (
        <button className="d-fab rd-fab" aria-label={t('Add room expense')} onClick={() => setSheet({ kind: 'add' })}>
          <HiOutlinePlus size={26} />
        </button>
      )}

      {sheet && (
        <ExpenseSheet
          roomId={roomId}
          groupType={groupType}
          members={members}
          me={me}
          requireApproval={requireApproval}
          expense={sheet.kind === 'edit' ? sheet.expense : null}
          minDate={currentCycle ? toInputDate(currentCycle.start) : undefined}
          onClose={() => setSheet(null)}
          onSaved={async (res) => {
            setSheet(null);
            // New/fixed expenses always land in the open month
            if (usesCycles && currentCycle && month !== 'all') setMonth(`c${currentCycle.index}`);
            await refreshAll();
          }}
        />
      )}
      {rejecting && <RejectSheet expense={rejecting} onClose={() => setRejecting(null)} onSubmit={reject} />}
      {paying && (
        <PaymentSheet transfer={paying.transfer} mode={paying.mode} onClose={() => setPaying(null)} onSubmit={recordPayment} />
      )}
      {inviteOpen && (
        <InviteSheet roomId={roomId} roomName={room.name} groupType={groupType} onClose={() => setInviteOpen(false)} />
      )}
    </div>
  );
}

function InviteSheet({ roomId, roomName, groupType, onClose }) {
  const { t } = useLanguage();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null);

  const load = useCallback(
    async (reset = false) => {
      setLoading(true);
      try {
        const res = await api(`/api/rooms/${roomId}/invitations`, { method: 'POST', body: JSON.stringify({ reset }) });
        setInvite(res);
        if (reset) toast.success(t('New link created — the old one no longer works'));
      } catch (err) {
        toast.error(err.message || t('Could not get the invite link'));
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roomId],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const code = invite?.code || '';
  const url = code ? `${window.location.origin}/join?token=${code}` : '';
  const inviteVars = { name: roomName, url, code: formatInviteCode(code) };
  const message =
    groupType === 'trip'
      ? t('Join our trip "{name}" on FairShare to split expenses 👇\n{url}\n\nOr open the app → Join → code: {code}', inviteVars)
      : groupType === 'group'
        ? t('Join our group "{name}" on FairShare to split expenses 👇\n{url}\n\nOr open the app → Join → code: {code}', inviteVars)
        : t('Join our flat "{name}" on FairShare to split expenses 👇\n{url}\n\nOr open the app → Join → code: {code}', inviteVars);

  async function copy(text, field) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      toast.success(t('Copied!'));
      setTimeout(() => setCopied((c) => (c === field ? null : c)), 2000);
    } catch {
      toast.error(t('Copy failed — select and copy manually'));
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: t('Join {name}', { name: roomName }), text: message });
    } catch {
      /* cancelled */
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet stack" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="rx-inv-title">
        <div className="d-sheet-grip" />
        <div className="d-sheet-head">
          <div>
            <h2 id="rx-inv-title">{t('Invite friends')}</h2>
            <p className="muted text-xs" style={{ margin: '4px 0 0' }}>
              {t('One link for everyone — share it in your WhatsApp group.')}
            </p>
          </div>
          <button type="button" className="modal-close-button" onClick={onClose} aria-label={t('Close')}>
            <HiOutlineX size={15} />
          </button>
        </div>

        {loading && !invite ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <span className="spinner" />
          </div>
        ) : code ? (
          <div className="stack" style={{ gap: 14 }}>
            <div className="invite-code-box">
              <div className="invite-code-label">
                <span>{t('Group code')}</span>
                <span className="text-xs muted">
                  {invite.useCount ? t('{n} joined with this link', { n: invite.useCount }) : t('Anyone with it can join')}
                </span>
              </div>
              <button type="button" className="invite-code-value rx-code" onClick={() => copy(code, 'code')}>
                {formatInviteCode(code)}
              </button>
            </div>

            <button
              type="button"
              className="btn-whatsapp"
              onClick={() => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank', 'noopener')}
            >
              <SiWhatsapp size={18} /> {t('Share on WhatsApp')}
            </button>

            <div className="rx-invite-actions">
              <button type="button" className="btn-ghost" onClick={() => copy(url, 'link')}>
                {copied === 'link' ? <HiCheck size={15} /> : <HiDuplicate size={15} />} {copied === 'link' ? t('Copied') : t('Copy link')}
              </button>
              {typeof navigator !== 'undefined' && navigator.share && (
                <button type="button" className="btn-ghost" onClick={nativeShare}>
                  {t('More apps…')}
                </button>
              )}
            </div>

            <p className="muted text-xs" style={{ margin: 0 }}>
              {t('Valid till {date}.', {
                date: new Date(invite.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
              })}
              {(
                <>
                  {' '}
                  {t('Shared with the wrong person?')}{' '}
                  <button
                    type="button"
                    className="rx-link"
                    disabled={loading}
                    onClick={() => window.confirm(t('Create a new link? The current link and code will stop working.')) && load(true)}
                  >
                    {t('Reset link')}
                  </button>
                </>
              )}
            </p>
          </div>
        ) : (
          <p className="muted">{t('Could not get an invite link. Only the person who created this group can invite.')}</p>
        )}
      </div>
    </div>
  );
}
