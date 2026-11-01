export default function ConfirmModal({ title, message, confirmLabel = 'Confirm', busy, onCancel, onConfirm }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h2>{title}</h2>
        <p className="muted">{message}</p>
        <div className="modal-actions">
          <button className="button button-ghost" onClick={onCancel}>Cancel</button>
          <button className="button button-danger" disabled={busy} onClick={onConfirm}>{busy ? 'Working…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
