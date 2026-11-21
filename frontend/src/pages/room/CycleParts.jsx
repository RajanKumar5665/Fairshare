import {
  HiCheck,
  HiOutlineCalendar,
  HiOutlineChevronRight,
  HiOutlineClock,
  HiOutlineFlag,
  HiOutlineLockClosed,
  HiOutlineRefresh,
} from 'react-icons/hi';
import { formatINR } from '../../utils/money';
import { shortDate } from './roomUtils';

/**
 * Explains the rule for what's on screen and gives the owner the right action:
 * - Flat, current month: open until the owner taps "Settle now"
 * - Flat, closed month: saved in history
 * - Trip/group: settle any time · owner can finish / reopen
 */
export function CycleBanner({
  groupType,
  usesCycles,
  report,
  currentCycle,
  isOwner,
  isFinished,
  closedAt,
  busy,
  onCloseNow,
  onFinish,
  onReopen,
  onGoCurrent,
}) {
  if (usesCycles) {
    const c = report?.cycle;
    if (!c || !currentCycle) return null;
    if (c.isCurrent) {
      return (
        <div className="rx-cycle-card">
          <span className="rx-cycle-ico">
            <HiOutlineCalendar size={20} />
          </span>
          <div className="rx-cycle-main">
            <strong>Month {c.index} is running</strong>
            <small className="muted">
              Since {shortDate(currentCycle.start)} ({currentCycle.daysRunning} day{currentCycle.daysRunning === 1 ? '' : 's'}).{' '}
              {isOwner
                ? 'When everyone is ready, tap “Settle now” — the hisaab is saved in History and the next month starts.'
                : 'The owner settles it when everyone is ready; then the hisaab is saved in History and the next month starts.'}
            </small>
          </div>
          {isOwner && (
            <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={onCloseNow}>
              <HiOutlineLockClosed size={14} /> Settle now
            </button>
          )}
        </div>
      );
    }
    return (
      <div className="rx-cycle-card closed">
        <span className="rx-cycle-ico">
          <HiOutlineLockClosed size={20} />
        </span>
        <div className="rx-cycle-main">
          <strong>Month {c.index} is closed</strong>
          <small className="muted">
            Settled by the owner on {shortDate(c.end)}. Its expenses can't change any more — pay what's left using the buttons
            below.
          </small>
        </div>
        <button type="button" className="btn-ghost btn-sm" onClick={onGoCurrent}>
          This month <HiOutlineChevronRight size={14} />
        </button>
      </div>
    );
  }

  const what = groupType === 'trip' ? 'trip' : 'group';
  if (isFinished) {
    return (
      <div className="rx-cycle-card closed">
        <span className="rx-cycle-ico">
          <HiOutlineFlag size={20} />
        </span>
        <div className="rx-cycle-main">
          <strong>{what === 'trip' ? 'Trip' : 'Group'} finished{closedAt ? ` on ${shortDate(closedAt)}` : ''}</strong>
          <small className="muted">No new expenses. Settle the final amounts below.</small>
        </div>
        {isOwner && (
          <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={onReopen}>
            <HiOutlineRefresh size={14} /> Reopen
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="rx-cycle-card">
      <span className="rx-cycle-ico">
        <HiOutlineFlag size={20} />
      </span>
      <div className="rx-cycle-main">
        <strong>Settle up any time</strong>
        <small className="muted">
          The {what} is counted as a whole. {isOwner ? `When the ${what} is over, finish it to stop new expenses.` : `The owner finishes the ${what} when it's over.`}
        </small>
      </div>
      {isOwner && (
        <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={onFinish}>
          <HiOutlineFlag size={14} /> Finish {what}
        </button>
      )}
    </div>
  );
}

/** "Month 2: you still have to pay ₹X" — old months with money left for me. */
export function DuesBanner({ cycles, hidden, onOpen }) {
  if (hidden) return null;
  const mine = (cycles || []).filter((c) => c.status === 'closed' && (c.myToPayPaise > 0 || c.myToGetPaise > 0));
  if (!mine.length) return null;
  const c = mine[mine.length - 1]; // oldest first
  const pay = c.myToPayPaise > 0;
  return (
    <button type="button" className={`rx-alert ${pay ? 'danger' : 'good'}`} onClick={() => onOpen(c.index)}>
      <span className="rx-alert-ico">
        <HiOutlineClock size={18} />
      </span>
      <span className="rx-alert-text">
        <strong>
          Month {c.index}: {pay ? `you still have to pay ${formatINR(c.myToPayPaise)}` : `you still get ${formatINR(c.myToGetPaise)}`}
        </strong>
        <small>
          {mine.length > 1 ? `${mine.length} old months are not fully settled.` : 'That month is closed — finish the payments.'}
        </small>
      </span>
      <span className="rx-alert-cta">Settle</span>
    </button>
  );
}

/** Every closed month of a flat, newest first. */
export function HistoryTab({ info, me, onOpen }) {
  const { current, cycles } = info;
  return (
    <section className="rx-stack" role="tabpanel">
      <div className="rx-section-head">
        <div>
          <h2>Monthly history</h2>
          <p className="muted">Every time the owner settles, that month is saved here for good.</p>
        </div>
      </div>

      {current && (
        <button type="button" className="rx-hist current" onClick={() => onOpen(current.index)}>
          <div className="rx-hist-top">
            <strong>Month {current.index}</strong>
            <span className="badge">Running</span>
          </div>
          <small className="muted">
            Since {shortDate(current.start)} · {current.daysRunning} day{current.daysRunning === 1 ? '' : 's'} so far · closes when the
            owner settles it
          </small>
        </button>
      )}

      {cycles.length === 0 ? (
        <p className="muted rx-empty-line">No settled months yet. Month 1 appears here once the owner settles it.</p>
      ) : (
        cycles.map((c) => {
          const myLine = c.snapshot.members.find((m) => m.userId === me);
          return (
            <button type="button" key={c.index} className="rx-hist" onClick={() => onOpen(c.index)}>
              <div className="rx-hist-top">
                <strong>Month {c.index}</strong>
                {c.status === 'settled' ? (
                  <span className="badge success">
                    <HiCheck size={12} /> Settled
                  </span>
                ) : (
                  <span className="badge warn">{formatINR(c.remainingPaise)} pending</span>
                )}
              </div>
              <small className="muted">
                {c.label.split(' · ')[1]}

              </small>
              <div className="rx-hist-nums">
                <span>
                  <small>Total</small>
                  {formatINR(c.snapshot.totalPaise)}
                </span>
                <span>
                  <small>Per person</small>
                  {formatINR(c.snapshot.equalSharePaise)}
                </span>
                {myLine && (
                  <span>
                    <small>You paid</small>
                    {formatINR(myLine.paidPaise)}
                  </span>
                )}
              </div>
              {c.status === 'closed' && (c.myToPayPaise > 0 || c.myToGetPaise > 0) && (
                <small className={c.myToPayPaise > 0 ? 'rx-amt-neg' : 'rx-amt-pos'}>
                  {c.myToPayPaise > 0 ? `You still pay ${formatINR(c.myToPayPaise)}` : `You still get ${formatINR(c.myToGetPaise)}`}
                </small>
              )}
            </button>
          );
        })
      )}
    </section>
  );
}
