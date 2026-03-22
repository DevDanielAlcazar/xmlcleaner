import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "../hooks/useLanguage";
import { useTheme } from "../hooks/useTheme";
import { Sun, Moon, Sunset, Globe, CheckCircle2, ShieldCheck, Key, Mail, User, Lock, AlertCircle, Zap, FileCode, Search } from "lucide-react";
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
          <span className="font-display font-bold text-xl tracking-tight">XMLs <span className="text-brand">PRO</span></span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-medium opacity-70">
          <a href="#features" className="hover:opacity-100 transition-opacity">Características</a>
          <a href="#how" className="hover:opacity-100 transition-opacity">Cómo funciona</a>
          <a href="#pricing" className="hover:opacity-100 transition-opacity">Precios</a>
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
                        placeholder="RFC (Opcional)" 
                        className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-brand"
                        value={rfc}
                        onChange={e => setRfc(e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="relative">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20" size={18} />
                      <input 
                        type="text" 
                        placeholder="CURP (Opcional)" 
                        className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-brand"
                        value={curp}
                        onChange={e => setCurp(e.target.value.toUpperCase())}
                      />
                    </div>
                  </div>
                )}

                {authMode === 'register' && (
                  <p className="text-[10px] opacity-40 text-center leading-tight">
                    * El RFC y CURP son opcionales. Puedes agregar uno o ambos para recuperar tu cuenta si olvidas tu contraseña.
                  </p>
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
            {t('heroSubPro')}
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center gap-6"
          >
            <button 
              onClick={() => setAuthMode('register')}
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

        {/* Modules Section */}
        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="w-12 h-12 bg-brand/20 text-brand rounded-2xl flex items-center justify-center mb-6">
              <Zap size={24} />
            </div>
            <h3 className="text-xl font-bold mb-2">{t('moduleCleaningTitle')}</h3>
            <p className="text-sm opacity-60 leading-relaxed">{t('moduleCleaningDesc')}</p>
          </div>
          <div className="p-8 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-500 rounded-2xl flex items-center justify-center mb-6">
              <FileCode size={24} />
            </div>
            <h3 className="text-xl font-bold mb-2">{t('moduleExcelTitle')}</h3>
            <p className="text-sm opacity-60 leading-relaxed">{t('moduleExcelDesc')}</p>
          </div>
          <div className="p-8 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="w-12 h-12 bg-blue-500/20 text-blue-500 rounded-2xl flex items-center justify-center mb-6">
              <Globe size={24} />
            </div>
            <h3 className="text-xl font-bold mb-2">{t('moduleSatTitle')}</h3>
            <p className="text-sm opacity-60 leading-relaxed">{t('moduleSatDesc')}</p>
          </div>
        </div>

        {/* Floating Mockup Preview */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 100 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.5, type: "spring", damping: 20 }}
          className="mt-32 relative mx-auto max-w-6xl"
          id="features"
        >
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold mb-4">Características Principales</h2>
            <p className="opacity-50 max-w-2xl mx-auto">Tecnología de punta para el manejo de tus comprobantes fiscales.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-[2.5rem] bg-[var(--card)] border border-[var(--border)] shadow-xl hover:scale-[1.02] transition-transform">
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mb-6">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-xl font-bold mb-4">Auditoría Estructural</h3>
              <p className="text-sm opacity-60 leading-relaxed">
                Validamos cada nodo y cálculo de impuestos. No solo limpiamos el archivo, aseguramos que sea fiscalmente perfecto para tus deducciones.
              </p>
            </div>
            
            <div className="p-8 rounded-[2.5rem] bg-[var(--card)] border border-[var(--border)] shadow-xl hover:scale-[1.02] transition-transform">
              <div className="w-12 h-12 bg-brand/10 text-brand rounded-2xl flex items-center justify-center mb-6">
                <Zap size={24} />
              </div>
              <h3 className="text-xl font-bold mb-4">Reparación de Datos</h3>
              <p className="text-sm opacity-60 leading-relaxed">
                Eliminamos caracteres invisibles y corregimos errores de codificación que bloquean la carga en sistemas contables y del SAT.
              </p>
            </div>

            <div className="p-8 rounded-[2.5rem] bg-[var(--card)] border border-[var(--border)] shadow-xl hover:scale-[1.02] transition-transform">
              <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mb-6">
                <Search size={24} />
              </div>
              <h3 className="text-xl font-bold mb-4">Inteligencia Fiscal</h3>
              <p className="text-sm opacity-60 leading-relaxed">
                Detección automática de discrepancias en RFC, versiones de CFDI y métodos de pago antes de procesar tus lotes.
              </p>
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-brand/10 rounded-full blur-[100px] -z-10" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-amber-500/10 rounded-full blur-[100px] -z-10" />
        </motion.div>

        {/* How it works */}
        <section id="how" className="mt-48">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold mb-4">Cómo Funciona</h2>
            <p className="opacity-50 max-w-2xl mx-auto">Tres simples pasos para tener tus XML listos.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { step: "01", title: "Carga Inteligente", desc: "Sube tus archivos XML o ZIP. Nuestro sistema identifica automáticamente la versión y estructura de cada comprobante." },
              { step: "02", title: "Auditoría y Reparación", desc: "Ejecutamos más de 20 reglas de validación, corregimos errores de cálculo y eliminamos basura digital." },
              { step: "03", title: "Entrega Certificada", desc: "Descarga tus archivos optimizados o genera reportes financieros en Excel listos para tu contabilidad." }
            ].map((s, i) => (
              <div key={i} className="relative group">
                <div className="text-8xl font-display font-bold opacity-5 absolute -top-12 -left-4 group-hover:text-brand transition-colors">{s.step}</div>
                <h4 className="text-xl font-bold mb-4 relative z-10">{s.title}</h4>
                <p className="text-sm opacity-60 leading-relaxed relative z-10">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mt-48">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold mb-4">Planes y Precios</h2>
            <p className="opacity-50 max-w-2xl mx-auto">Elige el plan que mejor se adapte a tus necesidades.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Free */}
            <div className="p-10 rounded-[2.5rem] bg-[var(--card)] border border-[var(--border)] flex flex-col">
              <h3 className="text-xl font-bold mb-2">Free Starter</h3>
              <div className="text-4xl font-display font-bold mb-6">$0 <span className="text-sm opacity-40 font-sans">MXN</span></div>
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-center gap-3 text-sm font-medium opacity-70"><CheckCircle2 size={16} className="text-emerald-500" /> 5 créditos incluidos</li>
                <li className="flex items-center gap-3 text-sm font-medium opacity-70"><CheckCircle2 size={16} className="text-emerald-500" /> 5 XMLs gratis</li>
                <li className="flex items-center gap-3 text-sm font-medium opacity-70"><CheckCircle2 size={16} className="text-emerald-500" /> Reparación básica</li>
              </ul>
              <button onClick={() => setAuthMode('register')} className="w-full py-4 rounded-2xl border border-[var(--border)] font-bold hover:bg-[var(--bg)] transition-colors">Empezar ahora</button>
            </div>

            {/* Monthly */}
            <div className="p-10 rounded-[2.5rem] bg-[var(--card)] border-2 border-brand flex flex-col relative">
              <div className="absolute top-6 right-6 bg-brand text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">Popular</div>
              <h3 className="text-xl font-bold mb-2">Pro Mensual</h3>
              <div className="text-4xl font-display font-bold mb-6">$29 <span className="text-sm opacity-40 font-sans">MXN / mes</span></div>
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-center gap-3 text-sm font-medium opacity-70"><CheckCircle2 size={16} className="text-emerald-500" /> Créditos Ilimitados (10k)</li>
                <li className="flex items-center gap-3 text-sm font-medium opacity-70"><CheckCircle2 size={16} className="text-emerald-500" /> Reparación Total</li>
                <li className="flex items-center gap-3 text-sm font-medium opacity-70"><CheckCircle2 size={16} className="text-emerald-500" /> Módulo Extraer Excel</li>
                <li className="flex items-center gap-3 text-sm font-medium opacity-70"><CheckCircle2 size={16} className="text-emerald-500" /> Módulo Validador SAT</li>
                <li className="flex items-center gap-3 text-sm font-medium opacity-70"><CheckCircle2 size={16} className="text-emerald-500" /> Soporte Prioritario</li>
              </ul>
              <button onClick={() => setAuthMode('register')} className="w-full py-4 rounded-2xl bg-brand text-white font-bold shadow-lg shadow-brand/20 hover:scale-[1.02] transition-transform">Suscribirse</button>
            </div>

            {/* Annual */}
            <div className="p-10 rounded-[2.5rem] bg-[var(--card)] border border-[var(--border)] flex flex-col">
              <h3 className="text-xl font-bold mb-2">Pro Anual</h3>
              <div className="text-4xl font-display font-bold mb-2">$290 <span className="text-sm opacity-40 font-sans">MXN / año</span></div>
              <div className="text-xs font-bold text-emerald-500 mb-6 uppercase tracking-widest">Ahorra 2 meses</div>
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-center gap-3 text-sm font-medium opacity-70"><CheckCircle2 size={16} className="text-emerald-500" /> Todo lo del plan mensual</li>
                <li className="flex items-center gap-3 text-sm font-medium opacity-70"><CheckCircle2 size={16} className="text-emerald-500" /> 2 meses de regalo</li>
                <li className="flex items-center gap-3 text-sm font-medium opacity-70"><CheckCircle2 size={16} className="text-emerald-500" /> Facturación anual</li>
              </ul>
              <button onClick={() => setAuthMode('register')} className="w-full py-4 rounded-2xl border border-[var(--border)] font-bold hover:bg-[var(--bg)] transition-colors">Suscribirse</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] py-20">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-6 h-6 bg-brand rounded flex items-center justify-center text-white text-xs font-bold">X</div>
              <span className="font-display font-bold text-lg tracking-tight">XMLs PRO</span>
            </div>
            <p className="opacity-50 max-w-sm text-sm leading-relaxed">
              {t('footerDesc')}
            </p>
          </div>
          <div>
            <h4 className="font-bold text-sm mb-6 uppercase tracking-widest opacity-30">Producto</h4>
            <ul className="space-y-4 text-sm font-medium opacity-60">
              <li><a href="#features" className="hover:text-brand transition-colors">Características</a></li>
              <li><a href="#pricing" className="hover:text-brand transition-colors">Precios</a></li>
              <li><a href="#how" className="hover:text-brand transition-colors">Cómo funciona</a></li>
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
          <span>© 2026 XMLs PRO. {t('rights')}</span>
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
