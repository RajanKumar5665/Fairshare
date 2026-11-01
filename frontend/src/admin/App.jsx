import { AuthProvider as AdminAuthProvider, useAuth } from './auth';
import AdminLayout from './layouts/AdminLayout';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import './styles.css';

function AdminContent() {
  const { user, loading, logout } = useAuth();
  if (loading) return <main className="loading-screen">Checking secure session…</main>;
  if (!user) return <AuthPage />;
  if (user.role !== 'admin') return <AuthPage />;
  return <AdminLayout user={user} onLogout={logout}><DashboardPage /></AdminLayout>;
}

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <div className="admin-root">
        <AdminContent />
      </div>
    </AdminAuthProvider>
  );
}
