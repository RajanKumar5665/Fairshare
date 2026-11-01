import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { adminService } from '../services/adminService';
import { useAdminData } from '../hooks/useAdminData';
import ConfirmModal from '../components/ConfirmModal';
import NoticeModal from '../components/NoticeModal';
import RoomCard from '../components/RoomCard';
import StatCard from '../components/StatCard';

export default function DashboardPage() {
  const { overview, rooms, loading, reload, updateRoom } = useAdminData();
  const [noticeTarget, setNoticeTarget] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  async function changeSubscription(room, status) {
    setBusy(true);
    try {
      await adminService.updateSubscription(room._id, { status });
      toast.success('Subscription updated');
      await reload();
    } catch (error) { toast.error(error.message); } finally { setBusy(false); }
  }

  async function sendNotice(message) {
    setBusy(true);
    try {
      await adminService.sendNotice(noticeTarget.room._id, { message, targetUserId: noticeTarget.member.userId?._id });
      toast.success('Notice sent to room owner');
      setNoticeTarget(null);
    } catch (error) { toast.error(error.message); } finally { setBusy(false); }
  }

  async function removeMember(room, member) {
    if (!window.confirm(`Remove ${member.userId?.name || 'this member'}? An owner notice must already exist.`)) return;
    setBusy(true);
    try {
      await adminService.removeMember(room._id, member.userId?._id);
      updateRoom(room._id, (current) => ({ ...current, members: current.members.filter((item) => item._id !== member._id) }));
      toast.success('Member removed');
    } catch (error) { toast.error(error.message); } finally { setBusy(false); }
  }

  async function archiveRoom() {
    setBusy(true);
    try {
      await adminService.archiveRoom(archiveTarget._id);
      toast.success('Room archived');
      setArchiveTarget(null);
      await reload();
    } catch (error) { toast.error(error.message); } finally { setBusy(false); }
  }

  return <AdminPage title="Overview" subtitle="Monitor rooms, subscriptions and member activity.">
    <div className="stats-grid">
      <StatCard label="Total users" value={overview?.users} />
      <StatCard label="Active rooms" value={overview?.rooms} tone="blue" />
      <StatCard label="Active subscriptions" value={overview?.activeSubscriptions} tone="purple" />
      <StatCard label="Administrators" value={overview?.admins} tone="orange" />
    </div>
    <div className="section-heading" id="rooms"><div><p className="eyebrow">OPERATIONS</p><h2>Rooms & members</h2></div><button className="button button-soft" disabled={loading} onClick={reload}>↻ Refresh</button></div>
    {loading ? <div className="loading-card">Loading secure workspace…</div> : <div className="room-grid">{rooms.map((room) => <RoomCard key={room._id} room={room} onSubscriptionChange={changeSubscription} onNotice={(roomData, member) => setNoticeTarget({ room: roomData, member })} onRemove={removeMember} onArchive={setArchiveTarget} />)}{!rooms.length && <div className="empty-state">No active rooms found.</div>}</div>}
    {noticeTarget && <NoticeModal member={noticeTarget.member} busy={busy} onCancel={() => setNoticeTarget(null)} onSubmit={sendNotice} />}
    {archiveTarget && <ConfirmModal title="Archive this room?" message={`“${archiveTarget.name}” will be hidden from active operations. This does not delete financial records.`} confirmLabel="Archive room" busy={busy} onCancel={() => setArchiveTarget(null)} onConfirm={archiveRoom} />}
  </AdminPage>;
}

function AdminPage({ title, subtitle, children }) {
  return <main className="page-content" id="dashboard"><header className="page-header"><div><p className="eyebrow">PLATFORM CONTROL</p><h1>{title}</h1><p className="muted">{subtitle}</p></div><span className="secure-pill">● Secure session</span></header>{children}</main>;
}
