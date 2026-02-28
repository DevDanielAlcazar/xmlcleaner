/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ThemeProvider } from './hooks/useTheme';
import { LanguageProvider } from './hooks/useLanguage';
import Landing from './components/Landing';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';

export default function App() {
  const [view, setView] = useState<'landing' | 'dashboard' | 'admin'>('landing');
  const [user, setUser] = useState<any>(null);

  return (
    <ThemeProvider>
      <LanguageProvider>
        {view === 'landing' ? (
          <Landing onStart={(userData) => {
            setUser(userData);
            setView('dashboard');
          }} />
        ) : view === 'dashboard' ? (
          <Dashboard 
            user={user}
            onAdmin={() => setView('admin')} 
          />
        ) : (
          <AdminPanel onBack={() => setView('admin')} />
        )}
      </LanguageProvider>
    </ThemeProvider>
  );
}
