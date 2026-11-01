import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './auth';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
      <Toaster
        position="top-center"
        gutter={10}
        toastOptions={{
          duration: 3800,
          style: {
            background: '#16283c',
            color: '#e8eef7',
            border: '1px solid #314a65',
            borderRadius: '14px',
            padding: '12px 18px',
            fontSize: '0.92rem',
            fontFamily: "'DM Sans', system-ui, sans-serif",
            boxShadow: '0 14px 36px rgba(0, 0, 0, 0.5)',
          },
          success: {
            iconTheme: { primary: '#53ddba', secondary: '#0a1220' },
          },
          error: {
            duration: 4800,
            iconTheme: { primary: '#ff9ca5', secondary: '#0a1220' },
          },
        }}
      />
    </AuthProvider>
  </StrictMode>,
);
