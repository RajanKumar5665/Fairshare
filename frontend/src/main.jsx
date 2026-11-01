import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import './tailwind.css';
import './index.css';
import App from './App.jsx';

// Remove the previous service worker's cache of authenticated expense data.
if ('caches' in window) {
  window.caches.delete('api-expenses-cache').catch(() => {});
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <BrowserRouter>
          <AuthProvider>
          <App />
          <Toaster
            position="top-right"
            gutter={10}
            containerStyle={{
              top: 20,
              right: 20,
              zIndex: 99999,
            }}
            toastOptions={{
              duration: 3800,
              className: 'custom-toast-popup',
              style: {
                background: 'var(--card)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
                borderRadius: '14px',
                padding: '12px 18px',
                fontSize: '0.92rem',
                fontWeight: '600',
                fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
                maxWidth: 'min(calc(100vw - 32px), 390px)',
                boxShadow: '0 12px 32px -4px rgba(28, 25, 20, 0.12)',
              },
              success: {
                className: 'custom-toast-popup toast-success',
                iconTheme: { primary: '#0f6e56', secondary: '#ffffff' },
              },
              error: {
                duration: 4800,
                className: 'custom-toast-popup toast-error',
                iconTheme: { primary: '#b42318', secondary: '#ffffff' },
              },
              loading: {
                className: 'custom-toast-popup toast-loading',
                iconTheme: { primary: '#148f6e', secondary: '#ffffff' },
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  </StrictMode>
);
