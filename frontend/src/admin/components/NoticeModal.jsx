import { useState } from 'react';

export default function NoticeModal({ member, onCancel, onSubmit, busy }) {
  const [message, setMessage] = useState('');
  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <form className="modal-card" onSubmit={(event) => { event.preventDefault(); onSubmit(message); }} onClick={(event) => event.stopPropagation()}>
        <p className="eyebrow">MODERATION NOTICE</p>
        <h2>Message room owner</h2>
        <p className="muted">This notice will be posted in the room before any removal action.</p>
        <div className="notice-target"><strong>{member?.userId?.name}</strong><span>{member?.userId?.mobile || member?.userId?.email}</span></div>
        <label className="field"><span>Message (10–1000 characters)</span><textarea required minLength={10} maxLength={1000} rows="5" value={message} onChange={(event) => setMessage(event.target.value)} /></label>
        <div className="modal-actions">
          <button type="button" className="button button-ghost" onClick={onCancel}>Cancel</button>
          <button className="button button-primary" disabled={busy}>{busy ? 'Sending…' : 'Send notice'}</button>
        </div>
      </form>
    </div>
  );
}
