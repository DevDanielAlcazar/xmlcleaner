import React, { useState, useCallback, useEffect } from "react";
import { useDropzone, DropzoneOptions } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "../hooks/useLanguage";
import { useTheme } from "../hooks/useTheme";
import { 
  LayoutDashboard, 
  History, 
  CreditCard, 
  Settings, 
  LogOut, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Download,
  Zap,
  Clock,
  HardDrive,
  Sun,
  Sunset,
  Moon,
  Globe,
  Terminal
} from "lucide-react";
import { cn } from "../utils/cn";
import { cleanXML, CleanResult } from "../utils/xmlCleaner";
import JSZip from "jszip";

import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

export default function Dashboard({ user, onAdmin }: { user: any, onAdmin: () => void }) {
  const { t, lang, setLang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<CleanResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [credits, setCredits] = useState(5);
  const [plan, setPlan] = useState("Free Starter");

  useEffect(() => {
    fetch("/api/user/credits")
      .then(res => res.json())
      .then(data => {
        setCredits(data.credits);
        setPlan(data.plan);
      });
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'text/xml': ['.xml'], 'application/xml': ['.xml'] }
  } as any);

  const handleProcess = async () => {
    if (files.length === 0 || credits < files.length) return;
    
    setProcessing(true);
    const newResults: CleanResult[] = [];
    
    for (const file of files) {
      const result = await cleanXML(file);
      newResults.push(result);
    }
    
    setResults(newResults);
    setCredits(prev => prev - files.length);
    
    // Log processes to DB
    for (const res of newResults) {
      fetch("/api/process/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: res.originalName,
          status: res.success ? "PROCESSED" : "ISSUE",
          warnings: res.warnings
        })
      });
    }

    setFiles([]);
    setProcessing(false);
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    results.forEach(res => {
      if (res.success) {
        zip.file(`cleaned_${res.originalName}`, res.cleanedContent);
      }
    });
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xml_cleaner_batch_${Date.now()}.zip`;
    a.click();
  };

  const handleUpgrade = async () => {
    try {
      const response = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "price_..." }), // You should replace this with your actual Stripe Price ID
      });
      const session = await response.json();
      const stripe = await stripePromise;
      if (stripe) {
        await (stripe as any).redirectToCheckout({ sessionId: session.id });
      }
    } catch (err) {
      console.error("Stripe error:", err);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      {/* Sidebar */}
      <aside className="w-72 border-r border-[var(--border)] flex flex-col p-6 gap-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-white font-bold">X</div>
          <span className="font-display font-bold text-xl tracking-tight">Tranquil<span className="text-brand">XML</span></span>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem icon={<LayoutDashboard size={20} />} label={t('dashboard')} active />
          <SidebarItem icon={<History size={20} />} label="History" />
          <SidebarItem icon={<CreditCard size={20} />} label="Billing" />
          <SidebarItem icon={<Settings size={20} />} label="Preferences" />
          {user?.isAdmin && (
            <div onClick={onAdmin}>
              <SidebarItem icon={<Terminal size={20} />} label="Admin" />
            </div>
          )}
        </nav>

        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold opacity-40 uppercase tracking-widest">{t('credits')}</span>
              <span className="text-sm font-bold">{credits}/5</span>
            </div>
            <div className="h-2 bg-[var(--bg)] rounded-full overflow-hidden mb-4">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(credits / 5) * 100}%` }}
                className="h-full bg-emerald-500"
              />
            </div>
            <button 
              onClick={handleUpgrade}
              className="w-full py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs font-bold hover:bg-[var(--border)] transition-colors"
            >
              {t('expand')}
            </button>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl hover:bg-[var(--card)] transition-colors cursor-pointer group">
            <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand font-bold">
              {(user?.name || 'U').split(' ').map((n: any) => n[0]).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{user?.name || 'User'}</p>
              <p className="text-xs opacity-50 truncate">{plan}</p>
            </div>
            <LogOut size={16} className="opacity-0 group-hover:opacity-30 transition-opacity" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-12 overflow-y-auto">
        <header className="flex justify-between items-start mb-12">
          <div>
            <h1 className="text-4xl font-display font-bold tracking-tight mb-2">Good afternoon, {user?.name || 'User'}</h1>
            <p className="opacity-50 text-sm">Let's find some calm in your data cleaning workflow today.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-[var(--card)] rounded-full p-1 border border-[var(--border)]">
              <button onClick={() => setTheme('day')} className={cn("p-1.5 rounded-full transition-all", theme === 'day' && "bg-white shadow-sm text-brand")}><Sun size={16} /></button>
              <button onClick={() => setTheme('afternoon')} className={cn("p-1.5 rounded-full transition-all", theme === 'afternoon' && "bg-white shadow-sm text-amber-500")}><Sunset size={16} /></button>
              <button onClick={() => setTheme('night')} className={cn("p-1.5 rounded-full transition-all", theme === 'night' && "bg-white shadow-sm text-blue-500")}><Moon size={16} /></button>
            </div>
            <button 
              onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
              className="px-3 py-1.5 rounded-full border border-[var(--border)] text-xs font-bold uppercase"
            >
              {lang}
            </button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              {t('operational')}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-8">
          {/* Upload Area */}
          <div className="col-span-2 space-y-8">
            <div 
              {...getRootProps()} 
              className={cn(
                "aspect-[2/1] rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center p-12 transition-all cursor-pointer",
                isDragActive ? "border-brand bg-brand/5 scale-[0.99]" : "border-[var(--border)] bg-[var(--card)] hover:border-brand/50"
              )}
            >
              <input {...getInputProps()} />
              <div className="w-16 h-16 rounded-3xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center text-brand mb-6 shadow-sm">
                <Upload size={32} />
              </div>
              <h3 className="text-2xl font-display font-bold mb-2">{t('selectFile')}</h3>
              <p className="opacity-40 text-sm text-center max-w-xs">{t('dropFiles')}</p>
              <p className="mt-8 text-xs font-bold opacity-20 uppercase tracking-widest">{t('maxSize')}</p>
            </div>

            {files.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 rounded-[2.5rem] bg-[var(--card)] border border-[var(--border)]"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold">Pending Files ({files.length})</h3>
                  <button 
                    onClick={handleProcess}
                    disabled={processing || credits < files.length}
                    className="bg-brand text-white px-6 py-2 rounded-full text-sm font-bold disabled:opacity-50 flex items-center gap-2"
                  >
                    {processing ? <Zap size={16} className="animate-spin" /> : <Zap size={16} />}
                    {t('cleanNow')}
                  </button>
                </div>
                <div className="space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                      <div className="flex items-center gap-3">
                        <FileText size={18} className="opacity-30" />
                        <span className="text-sm font-medium">{f.name}</span>
                      </div>
                      <span className="text-xs opacity-30">{(f.size / 1024).toFixed(1)} KB</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {results.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 rounded-[2.5rem] bg-brand text-white"
              >
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-2xl font-display font-bold">{t('batchResults')}</h3>
                    <p className="text-sm opacity-70">{t('integrityCheck')}</p>
                  </div>
                  <button 
                    onClick={downloadZip}
                    className="bg-white text-brand px-6 py-3 rounded-full text-sm font-bold flex items-center gap-2 hover:scale-105 transition-transform"
                  >
                    <Download size={18} />
                    {t('exportAll')}
                  </button>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <StatCard label="Cleaned" value={results.filter(r => r.success).length} />
                  <StatCard label="Exceptions" value={results.filter(r => !r.success).length} />
                  <StatCard label="Efficiency" value="100%" />
                </div>

                <div className="space-y-2">
                  {results.slice(0, 3).map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/10 border border-white/20">
                      <div className="flex items-center gap-3">
                        {r.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        <span className="text-sm font-medium">{r.originalName}</span>
                      </div>
                      <div className="flex gap-2">
                        {r.warnings.slice(0, 1).map((w, j) => (
                          <span key={j} className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">{w}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Stats & Info */}
          <div className="space-y-8">
            <div className="p-8 rounded-[2.5rem] bg-[var(--card)] border border-[var(--border)]">
              <div className="flex items-center gap-2 mb-8">
                <Clock size={20} className="opacity-30" />
                <h3 className="font-bold">{t('recentActivity')}</h3>
              </div>
              <div className="space-y-6">
                <ActivityItem label="factura_enero_2024.xml" time="Oct 24 • 14:20" status="PROCESSED" />
                <ActivityItem label="batch_process_092.zip" time="Oct 24 • 11:05" status="PROCESSED" />
                <ActivityItem label="invalid_header_test.xml" time="Oct 23 • 16:45" status="ISSUE" />
              </div>
            </div>

            <div className="p-8 rounded-[2.5rem] bg-[var(--card)] border border-[var(--border)]">
              <div className="flex items-center gap-2 mb-8">
                <Zap size={20} className="opacity-30" />
                <h3 className="font-bold">{t('performance')}</h3>
              </div>
              <div className="space-y-4">
                <PerformanceItem label={t('totalCleaned')} value="42" />
                <PerformanceItem label={t('avgSpeed')} value="1.2s" />
                <PerformanceItem label="Time Saved" value="~3.5 hrs" />
                <PerformanceItem label={t('cloudSpace')} value="12.5 MB" />
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-amber-50 border border-amber-100 flex gap-4">
              <AlertCircle className="text-amber-500 shrink-0" />
              <p className="text-xs text-amber-800 leading-relaxed">
                <span className="font-bold block mb-1">Retention Policy</span>
                {t('retentionPolicy')}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer",
      active ? "bg-brand text-white shadow-lg shadow-brand/20" : "opacity-40 hover:opacity-100 hover:bg-[var(--card)]"
    )}>
      {icon}
      {label}
    </div>
  );
}

function StatCard({ label, value }: { label: string, value: string | number }) {
  return (
    <div className="bg-white/10 p-4 rounded-2xl border border-white/10">
      <p className="text-[10px] uppercase font-bold tracking-widest opacity-60 mb-1">{label}</p>
      <p className="text-2xl font-display font-bold">{value}</p>
    </div>
  );
}

function ActivityItem({ label, time, status }: { label: string, time: string, status: string }) {
  return (
    <div className="flex items-center justify-between group cursor-pointer">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[var(--bg)] flex items-center justify-center">
          <FileText size={14} className="opacity-30" />
        </div>
        <div>
          <p className="text-sm font-bold truncate max-w-[120px]">{label}</p>
          <p className="text-[10px] opacity-40">{time}</p>
        </div>
      </div>
      <span className={cn(
        "text-[10px] font-bold px-2 py-0.5 rounded-full",
        status === 'PROCESSED' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
      )}>
        {status}
      </span>
    </div>
  );
}

function PerformanceItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm opacity-50">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}
