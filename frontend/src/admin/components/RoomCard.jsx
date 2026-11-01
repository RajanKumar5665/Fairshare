export default function RoomCard({ room, onSubscriptionChange, onNotice, onRemove, onArchive }) {
  const members = room.members.filter((member) => member.role !== 'owner');
  const subscription = room.createdBy?.roomSubscription || {};
  return (
    <article className="room-card">
      <div className="room-card-head">
        <div>
          <div className="room-label">ACTIVE ROOM</div>
          <h2>{room.name}</h2>
          <p className="muted">{room.address || 'No address provided'}</p>
        </div>
        <button className="button button-soft" aria-label={`Archive ${room.name}`} title="Archive room" onClick={() => onArchive(room)}>Archive</button>
      </div>
      <div className="owner-strip">
        <span className="avatar">{room.createdBy?.name?.slice(0, 1).toUpperCase() || '?'}</span>
        <div><strong>{room.createdBy?.name || 'Unknown owner'}</strong><small>{room.createdBy?.mobile || room.createdBy?.email || 'No contact'}</small></div>
        <span className="owner-badge">OWNER</span>
      </div>
      <div className="subscription-row">
        <div><span className="label">Subscription</span><strong>{subscription.plan || 'starter_1rs'}</strong></div>
        <select value={subscription.status || 'none'} onChange={(event) => onSubscriptionChange(room, event.target.value)} aria-label={`Subscription for ${room.name}`}>
          <option value="none">None</option><option value="active">Active</option><option value="expired">Expired</option>
        </select>
      </div>
      <div className="member-heading"><span>Members ({members.length})</span><span>Actions</span></div>
      <div className="member-list">
        {members.map((member) => <div className="member-row" key={member._id}>
          <div><strong>{member.userId?.name || 'Unknown member'}</strong><small>{member.userId?.mobile || member.userId?.email || 'No contact'}</small></div>
          <div className="inline-actions">
            <button className="button button-soft" onClick={() => onNotice(room, member)}>Message owner</button>
            <button className="button button-danger-soft" onClick={() => onRemove(room, member)}>Remove</button>
          </div>
        </div>)}
        {!members.length && <p className="empty-inline">No other active members.</p>}
      </div>
    </article>
  );
}
