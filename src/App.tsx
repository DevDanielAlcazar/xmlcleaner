/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, Component, ErrorInfo, ReactNode } from 'react';
import { ThemeProvider } from './hooks/useTheme';
import { LanguageProvider } from './hooks/useLanguage';
import Landing from './components/Landing';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import SupportChat from './components/SupportChat';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = { hasError: false };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("[App ErrorBoundary caught]:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg)] text-[var(--text)]">
          <div className="max-w-md p-8 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-xl text-center space-y-4">
            <h2 className="text-xl font-bold">Ocurrió un problema de visualización</h2>
            <p className="text-sm opacity-60">Se recuperó el estado para evitar el cierre de sesión.</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg hover:bg-blue-700"
            >
              Continuar trabajando
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const safeStorage = {
  get: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(key);
        if (val) return val;
      }
    } catch {}
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const val = window.sessionStorage.getItem(key);
        if (val) return val;
      }
    } catch {}
    try {
      if (typeof document !== 'undefined') {
        const match = document.cookie.match(new RegExp('(^|;\\s*)' + key + '=([^;]*)'));
        if (match) return decodeURIComponent(match[2]);
      }
    } catch {}
    return null;
  },
  set: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {}
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
      }
    } catch {}
    try {
      if (typeof document !== 'undefined') {
        document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=604800; SameSite=Lax`;
      }
    } catch {}
  },
  remove: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {}
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
    } catch {}
    try {
      if (typeof document !== 'undefined') {
        document.cookie = `${key}=; path=/; max-age=0`;
      }
    } catch {}
  }
};

export default function App() {
  const [user, setUser] = useState<any>(() => {
    try {
      const saved = safeStorage.get('xml_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [view, setView] = useState<'landing' | 'dashboard' | 'admin'>(() => {
    try {
      const saved = safeStorage.get('xml_user_session');
      return saved ? 'dashboard' : 'landing';
    } catch {
      return 'landing';
    }
  });

  const [bannedNotice, setBannedNotice] = useState<{ isBanned: boolean; reason: string } | null>(null);

  const handleStart = (userData: any) => {
    setBannedNotice(null);
    setUser(userData);
    if (userData) {
      try {
        safeStorage.set('xml_user_session', JSON.stringify(userData));
      } catch {}
    }
    setView('dashboard');
  };

  const handleLogout = (banData?: { banned?: boolean; reason?: string }) => {
    try {
      safeStorage.remove('xml_user_session');
    } catch {}
    setUser(null);
    if (banData?.banned) {
      setBannedNotice({
        isBanned: true,
        reason: banData.reason || 'Tu cuenta ha sido restringida por administración.'
      });
    }
    setView('landing');
  };

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          {view === 'landing' ? (
            <Landing onStart={handleStart} initialBannedNotice={bannedNotice} />
          ) : view === 'dashboard' ? (
            <Dashboard 
              user={user}
              onAdmin={() => setView('admin')} 
              onLogout={handleLogout}
            />
          ) : (
            <AdminPanel 
              user={user}
              onBack={() => setView('dashboard')} 
            />
          )}
          <SupportChat />
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
