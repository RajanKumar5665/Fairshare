import React, { Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import InstallPrompt from './components/InstallPrompt';

// Lazy-loaded routes for ultra-fast first load
const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/Register'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Rooms = React.lazy(() => import('./pages/Rooms'));
const RoomDetail = React.lazy(() => import('./pages/RoomDetail'));
const Join = React.lazy(() => import('./pages/Join'));
const Profile = React.lazy(() => import('./pages/Profile'));
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = React.lazy(() => import('./pages/TermsOfService'));
const AdminApp = React.lazy(() => import('./admin/App'));

function PageLoader() {
  return (
    <div className="page-loader">
      <div className="page-loader-inner">
        <div className="loader-brand">F</div>
        <p className="muted text-sm">Loading FairShare…</p>
      </div>
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;
  if (!user) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${returnUrl}`} replace />;
  }
  return children;
}

export default function App() {
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/admin/*" element={<AdminApp />} />

          {/* Join route handles both authenticated and unauthenticated invitation views */}
          <Route
            path="/join"
            element={
              <Layout isJoinRoute>
                <Join />
              </Layout>
            }
          />

          <Route
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/rooms/:roomId" element={<RoomDetail />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <InstallPrompt />
    </>
  );
}
