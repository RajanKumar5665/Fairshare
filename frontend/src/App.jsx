import React, { Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import InstallPrompt from './components/InstallPrompt';
import Logo from './components/Logo';

// Lazy-loaded routes for ultra-fast first load
const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/Register'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Rooms = React.lazy(() => import('./pages/Rooms'));
const RoomDetail = React.lazy(() => import('./pages/RoomDetail'));
const Join = React.lazy(() => import('./pages/Join'));
const Profile = React.lazy(() => import('./pages/Profile'));
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = React.lazy(() => import('./pages/TermsOfService'));
const AdminApp = React.lazy(() => import('./admin/App'));
const Welcome = React.lazy(() => import('./pages/Welcome'));

function PageLoader() {
  return (
    <div className="page-loader">
      <div className="sc-splash" role="status" aria-label="Loading SplitCircle">
        <Logo size={84} />
        <strong>SplitCircle</strong>
      </div>
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;
  if (!user) {
    // First visit to the app's home: show the welcome screen instead of a bare login form
    if (location.pathname === '/' && !location.search.includes('action=')) return <Welcome />;
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
          <Route path="/forgot-password" element={<ForgotPassword />} />
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
