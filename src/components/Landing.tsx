import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "../hooks/useLanguage";
import { useTheme } from "../hooks/useTheme";
import { Sun, Moon, Sunset, Globe, CheckCircle2, ShieldCheck, Key, Mail, User, Lock, AlertCircle } from "lucide-react";
import { cn } from "../utils/cn";
import React, { useState } from "react";

export default function Landing({ onStart }: { onStart: (user?: any) => void }) {
  const { t, lang, setLang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'recover' | null>(null);
  
  // Form states
  const [email, setEmail] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [rfc, setRfc] = useState('');
  const [curp, setCurp] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (authMode === 'register') {
        if (email !== emailConfirm) return setError('Los correos no coinciden');
        if (password !== passwordConfirm) return setError('Las contraseñas no coinciden');
        if (!rfc || !curp) return setError('RFC y CURP son obligatorios para recuperación');

        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, rfc, curp })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al registrar');
        setAuthMode('login');
        setError('Registro exitoso. Por favor inicia sesión.');
      } else if (authMode === 'login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Credenciales inválidas');
        onStart(data.user);
      } else if (authMode === 'recover') {
        const res = await fetch('/api/auth/recover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, rfc, curp, newPassword: password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al recuperar');
        setAuthMode('login');
        setError('Contraseña restablecida. Por favor inicia sesión.');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className={cn("min-h-screen relative overflow-hidden", 
      theme === 'day' ? 'day-gradient' : theme === 'afternoon' ? 'afternoon-gradient' : 'night-gradient'
    )}>
      {/* Navbar */}
      <nav className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-white font-bold">X</div>
          <span className="font-display font-bold text-xl tracking-tight">XML Cleaner<span className="text-brand">Web</span></span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-medium opacity-70">
          <a href="#features" className="hover:opacity-100 transition-opacity">{t('features')}</a>
          <a href="#how" className="hover:opacity-100 transition-opacity">{t('howItWorks')}</a>
          <a href="#pricing" className="hover:opacity-100 transition-opacity">{t('pricing')}</a>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-[var(--card)] rounded-full p-1 border border-[var(--border)]">
            <button onClick={() => setTheme('day')} className={cn("p-1.5 rounded-full transition-all", theme === 'day' && "bg-white shadow-sm text-brand")}><Sun size={16} /></button>
            <button onClick={() => setTheme('afternoon')} className={cn("p-1.5 rounded-full transition-all", theme === 'afternoon' && "bg-white shadow-sm text-amber-500")}><Sunset size={16} /></button>
            <button onClick={() => setTheme('night')} className={cn("p-1.5 rounded-full transition-all", theme === 'night' && "bg-white shadow-sm text-blue-500")}><Moon size={16} /></button>
          </div>
          
          <button 
            onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] text-xs font-bold uppercase tracking-wider"
          >
            <Globe size={14} />
            {lang}
          </button>

          <button onClick={() => setAuthMode('login')} className="bg-brand hover:bg-brand-dark text-white px-6 py-2 rounded-full font-medium transition-all shadow-lg shadow-brand/20">
            {t('login')}
          </button>
        </div>
      </nav>

      {/* Auth Modal */}
      <AnimatePresence>
        {authMode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[var(--bg)] w-full max-w-md rounded-[2.5rem] p-10 border border-[var(--border)] shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-display font-bold">
                  {authMode === 'login' ? t('login') : authMode === 'register' ? 'Registro' : 'Recuperar'}
                </h2>
                <button onClick={() => setAuthMode(null)} className="p-2 opacity-30 hover:opacity-100 transition-opacity">✕</button>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={14} />
                    {error}
                  </div>
                )}

                {authMode === 'register' && (
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20" size={18} />
                    <input 
                      type="text" 
                      placeholder="Nombre completo" 
                      className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-brand"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20" size={18} />
                  <input 
                    type="email" 
                    placeholder="Correo electrónico" 
                    className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-brand"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>

                {authMode === 'register' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20" size={18} />
                    <input 
                      type="email" 
                      placeholder="Confirmar correo" 
                      className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-brand"
                      value={emailConfirm}
                      onChange={e => setEmailConfirm(e.target.value)}
                      required
                    />
                  </motion.div>
                )}

                {authMode !== 'recover' && (
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20" size={18} />
                    <input 
                      type="password" 
                      placeholder="Contraseña" 
                      className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-brand"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                  </div>
                )}

                {authMode === 'register' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20" size={18} />
                    <input 
                      type="password" 
                      placeholder="Confirmar contraseña" 
                      className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-brand"
                      value={passwordConfirm}
                      onChange={e => setPasswordConfirm(e.target.value)}
                      required
                    />
                  </motion.div>
                )}

                {(authMode === 'register' || authMode === 'recover') && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20" size={18} />
                      <input 
                        type="text" 
                        placeholder="RFC" 
                        className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-brand"
                        value={rfc}
                        onChange={e => setRfc(e.target.value.toUpperCase())}
                        required
                      />
                    </div>
                    <div className="relative">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20" size={18} />
                      <input 
                        type="text" 
                        placeholder="CURP" 
                        className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-brand"
                        value={curp}
                        onChange={e => setCurp(e.target.value.toUpperCase())}
                        required
                      />
                    </div>
                  </div>
                )}

                <button className="w-full bg-brand text-white py-4 rounded-2xl font-bold shadow-lg shadow-brand/20 hover:scale-[1.02] transition-transform">
                  {authMode === 'login' ? 'Entrar' : authMode === 'register' ? 'Crear Cuenta' : 'Restablecer'}
                </button>

                <div className="flex justify-between text-xs font-bold opacity-40 px-2">
                  {authMode === 'login' ? (
                    <>
                      <button type="button" onClick={() => setAuthMode('recover')}>Olvidé mi contraseña</button>
                      <button type="button" onClick={() => setAuthMode('register')}>Crear cuenta</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setAuthMode('login')} className="mx-auto">Ya tengo cuenta</button>
                  )}
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-6 pt-20 pb-32 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand/10 text-brand text-xs font-bold tracking-widest uppercase mb-8"
          >
            <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
            {t('enterpriseReady')}
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-6xl md:text-8xl font-display font-bold tracking-tight mb-8 leading-[0.9]"
          >
            {t('heroTitle')} <br />
            <span className="text-brand">{t('heroHighlight')}</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl opacity-60 max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            {t('heroSub')}
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center gap-6"
          >
            <button 
              onClick={onStart}
              className="group relative bg-brand text-white px-10 py-5 rounded-2xl font-bold text-xl transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-brand/40"
            >
              {t('tryFree')}
              <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            
            <div className="flex items-center gap-2 text-sm font-medium opacity-50">
              <CheckCircle2 size={16} className="text-emerald-500" />
              {t('freeCredits')}
            </div>
          </motion.div>
        </div>

        {/* Floating Mockup Preview */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 100 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.5, type: "spring", damping: 20 }}
          className="mt-32 relative mx-auto max-w-5xl"
        >
          <div className="aspect-video rounded-3xl overflow-hidden border border-[var(--border)] shadow-2xl bg-[var(--card)] p-4">
            <div className="w-full h-full rounded-2xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center opacity-50">
              <span className="font-mono text-xs uppercase tracking-[0.3em]">Preview Interface</span>
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute -top-12 -right-12 w-24 h-24 bg-brand/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-amber-500/20 rounded-full blur-3xl" />
        </motion.div>
      </main>

      <footer className="border-t border-[var(--border)] py-20">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-6 h-6 bg-brand rounded flex items-center justify-center text-white text-xs font-bold">X</div>
              <span className="font-display font-bold text-lg tracking-tight">XML Cleaner</span>
            </div>
            <p className="opacity-50 max-w-sm text-sm leading-relaxed">
              {t('footerDesc')}
            </p>
          </div>
          <div>
            <h4 className="font-bold text-sm mb-6 uppercase tracking-widest opacity-30">Product</h4>
            <ul className="space-y-4 text-sm font-medium opacity-60">
              <li>{t('features')}</li>
              <li>{t('pricing')}</li>
              <li>{t('howItWorks')}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-sm mb-6 uppercase tracking-widest opacity-30">Legal</h4>
            <ul className="space-y-4 text-sm font-medium opacity-60">
              <li>Terms of Service</li>
              <li>Privacy Policy</li>
              <li>Security</li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-20 pt-8 border-t border-[var(--border)] flex justify-between items-center text-xs opacity-30 font-medium">
          <span>© 2026 XML Cleaner Web. {t('rights')}</span>
          <div className="flex gap-6">
            <span>Twitter</span>
            <span>LinkedIn</span>
            <span>Github</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
