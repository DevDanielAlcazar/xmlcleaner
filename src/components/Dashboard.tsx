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
  Terminal,
  Search,
  X,
  RefreshCw,
  FileCode
} from "lucide-react";
import { cn } from "../utils/cn";
import { cleanXML, CleanResult } from "../utils/xmlCleaner";
import JSZip from "jszip";
import * as XLSX from "xlsx";

import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

export default function Dashboard({ user, onAdmin, onLogout }: { user: any, onAdmin: () => void, onLogout: () => void }) {
  const { t, lang, setLang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'panel' | 'history' | 'billing' | 'preferences' | 'excel' | 'sat'>('panel');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<CleanResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<CleanResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [credits, setCredits] = useState(5);
  const [plan, setPlan] = useState("Free Starter");
  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalCleaned: 0,
    avgSpeed: "1.2s",
    timeSaved: "0h",
    cloudSpace: "0 MB"
  });
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [validatingSAT, setValidatingSAT] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success')) {
      setNotification({ type: 'success', message: '¡Suscripción activada con éxito! Tus créditos se actualizarán en breve.' });
    } else if (params.get('canceled')) {
      setNotification({ type: 'error', message: 'El proceso de pago fue cancelado.' });
    }
    
    // Clear notification after 5 seconds
    if (params.get('success') || params.get('canceled')) {
      setTimeout(() => setNotification(null), 5000);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetch(`/api/user/credits?userId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          setCredits(data.credits);
          setPlan(data.plan);
        });

      // Fetch history
      fetch(`/api/user/history?userId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          setHistory(data);
        });
    }

    // Fetch stats
    fetch("/api/admin/metrics")
      .then(res => res.json())
      .then(data => {
        setStats(prev => ({
          ...prev,
          totalCleaned: data.processedToday || 0,
          timeSaved: `~${((data.processedToday || 0) * 5 / 60).toFixed(1)} hrs`
        }));
      });

    // Fetch modules
    setLoadingModules(true);
    fetch("/api/modules")
      .then(res => res.json())
      .then(data => {
        setModules(data);
        setLoadingModules(false);
      })
      .catch(err => {
        console.error("Error fetching modules:", err);
        setLoadingModules(false);
      });
  }, [user]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'text/xml': ['.xml'], 'application/xml': ['.xml'] }
  } as any);

  const handleProcess = async () => {
    if (files.length === 0) return;
    
    // Enforce Free Starter limit
    if (plan === "Free Starter" && files.length > 5) {
      setNotification({ type: 'error', message: 'El plan Free Starter solo permite procesar hasta 5 archivos por lote. Por favor, reduce la cantidad o mejora tu plan.' });
      return;
    }

    if (credits < files.length) {
      setNotification({ type: 'error', message: 'No tienes suficientes créditos para procesar estos archivos.' });
      return;
    }
    
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
          userId: user?.id,
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

  const exportToExcel = async () => {
    if (files.length === 0) return;
    
    setProcessing(true);
    
    try {
      // First process all files to get their content if they haven't been processed yet
      // In the Excel tab, we might just have raw files that haven't gone through cleanXML
      const xmlContents = await Promise.all(files.map(async (file) => {
        const text = await file.text();
        return { name: file.name, content: text };
      }));

      const data = xmlContents.map(({ name, content }) => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, "text/xml");
        
        // Helper to find element regardless of namespace prefix (cfdi:, etc.)
        const getElement = (tagName: string) => {
          const elements = xmlDoc.getElementsByTagNameNS("*", tagName);
          return elements.length > 0 ? elements[0] : xmlDoc.getElementsByTagName(tagName)[0] || xmlDoc.getElementsByTagName(`cfdi:${tagName}`)[0];
        };

        const comprobante = getElement("Comprobante");
        const emisor = getElement("Emisor");
        const receptor = getElement("Receptor");
        const timbre = getElement("TimbreFiscalDigital");
        
        // Extract concepts
        const conceptosNode = getElement("Conceptos");
        const conceptosList = conceptosNode ? Array.from(conceptosNode.getElementsByTagNameNS("*", "Concepto")).length > 0 
          ? Array.from(conceptosNode.getElementsByTagNameNS("*", "Concepto"))
          : Array.from(conceptosNode.getElementsByTagName("cfdi:Concepto")) 
          : [];
        
        const descripciones = conceptosList.map(c => c.getAttribute("Descripcion")).filter(Boolean).join(" | ");

        return {
          "Archivo": name,
          "Fecha": comprobante?.getAttribute("Fecha") || "",
          "Folio": comprobante?.getAttribute("Folio") || "",
          "Serie": comprobante?.getAttribute("Serie") || "",
          "UUID": timbre?.getAttribute("UUID") || "",
          "RFC Emisor": emisor?.getAttribute("Rfc") || "",
          "Nombre Emisor": emisor?.getAttribute("Nombre") || "",
          "RFC Receptor": receptor?.getAttribute("Rfc") || "",
          "Nombre Receptor": receptor?.getAttribute("Nombre") || "",
          "Uso CFDI": receptor?.getAttribute("UsoCFDI") || "",
          "Metodo Pago": comprobante?.getAttribute("MetodoPago") || "",
          "Forma Pago": comprobante?.getAttribute("FormaPago") || "",
          "Conceptos": descripciones || "",
          "Subtotal": parseFloat(comprobante?.getAttribute("SubTotal") || "0"),
          "Descuento": parseFloat(comprobante?.getAttribute("Descuento") || "0"),
          "Total": parseFloat(comprobante?.getAttribute("Total") || "0"),
          "Moneda": comprobante?.getAttribute("Moneda") || "",
          "Tipo Comprobante": comprobante?.getAttribute("TipoDeComprobante") || ""
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "XML Data");
      XLSX.writeFile(workbook, `reporte_xml_${Date.now()}.xlsx`);
      
      // Clear files after successful download
      setFiles([]);
      setNotification({ type: 'success', message: `Reporte generado con ${data.length} registros. Lista limpiada.` });
    } catch (error) {
      console.error("Error generating Excel:", error);
      setNotification({ type: 'error', message: 'Error al generar el reporte Excel. Verifica los archivos.' });
    } finally {
      setProcessing(false);
    }
  };

  const validateSAT = async (itemsToValidate = results) => {
    if (itemsToValidate.length === 0) return;

    // Enforce Free Starter limit for SAT validation too
    if (plan === "Free Starter" && itemsToValidate.length > 5) {
      setNotification({ type: 'error', message: 'El plan Free Starter solo permite validar hasta 5 archivos por lote en el SAT.' });
      return;
    }

    setValidatingSAT(true);
    const updatedResults = [...itemsToValidate];

    for (let i = 0; i < updatedResults.length; i++) {
      const res = updatedResults[i];
      if (!res.success) continue;

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(res.cleanedContent, "text/xml");
      
      // Helper to find element regardless of namespace prefix
      const getElement = (tagName: string) => {
        const elements = xmlDoc.getElementsByTagNameNS("*", tagName);
        return elements.length > 0 ? elements[0] : xmlDoc.getElementsByTagName(tagName)[0] || xmlDoc.getElementsByTagName(`cfdi:${tagName}`)[0];
      };

      const comprobante = getElement("Comprobante");
      const emisor = getElement("Emisor");
      const receptor = getElement("Receptor");
      const timbre = getElement("TimbreFiscalDigital");

      const re = emisor?.getAttribute("Rfc");
      const rr = receptor?.getAttribute("Rfc");
      const tt = comprobante?.getAttribute("Total");
      const id = timbre?.getAttribute("UUID");

      if (re && rr && tt && id) {
        try {
          const response = await fetch("/api/sat/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ re, rr, tt, id })
          });
          const data = await response.json();
          
          if (response.ok) {
            updatedResults[i] = { ...res, satStatus: data };
          } else {
            updatedResults[i] = { ...res, satStatus: { estado: "Error SAT", codigo: data.error || "Error interno del SAT", cancelable: "N/A" } };
          }
          setResults([...updatedResults]); // Update UI progressively
        } catch (err) {
          console.error("Error validating SAT:", err);
          updatedResults[i] = { ...res, satStatus: { estado: "Error de Conexión", codigo: "No se pudo conectar al SAT", cancelable: "N/A" } };
          setResults([...updatedResults]);
        }
      } else {
        updatedResults[i] = { ...res, satStatus: { estado: "XML Inválido", codigo: "Faltan datos requeridos (RFC, Total, UUID)", cancelable: "N/A" } };
        setResults([...updatedResults]);
      }
    }
    setValidatingSAT(false);
  };

  const handleUpgrade = async (priceId?: string) => {
    try {
      const response = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          planId: priceId || "price_1T5vEpE2HOY0nwdF4XTuqzN8",
          userId: user?.id
        }),
      });
      const session = await response.json();
      if (session.url) {
        window.location.href = session.url;
      }
    } catch (err) {
      console.error("Stripe error:", err);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)] relative">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[var(--card)] border-b border-[var(--border)] z-40 flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-white font-bold">X</div>
          <span className="font-display font-bold text-lg tracking-tight">XMLs <span className="text-brand">PRO</span></span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 rounded-xl bg-[var(--bg)] border border-[var(--border)]"
        >
          {isSidebarOpen ? <X size={20} /> : <LayoutDashboard size={20} />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 w-72 border-r border-[var(--border)] flex flex-col p-6 gap-8 bg-[var(--bg)] z-50 transition-transform lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-white font-bold">X</div>
          <span className="font-display font-bold text-xl tracking-tight">XMLs <span className="text-brand">PRO</span></span>
        </div>

        <nav className="flex-1 space-y-2">
          <div onClick={() => { setActiveTab('panel'); setIsSidebarOpen(false); }}>
            <SidebarItem icon={<LayoutDashboard size={20} />} label={t('dashboard')} active={activeTab === 'panel'} />
          </div>
          <div onClick={() => { setActiveTab('history'); setIsSidebarOpen(false); }}>
            <SidebarItem icon={<History size={20} />} label={t('history')} active={activeTab === 'history'} />
          </div>
          <div onClick={() => { setActiveTab('billing'); setIsSidebarOpen(false); }}>
            <SidebarItem icon={<CreditCard size={20} />} label={t('billing')} active={activeTab === 'billing'} />
          </div>
          <div onClick={() => { setActiveTab('preferences'); setIsSidebarOpen(false); }}>
            <SidebarItem icon={<Settings size={20} />} label={t('preferences')} active={activeTab === 'preferences'} />
          </div>
          
          {/* Independent Modules - Only for Pro Unlimited */}
          {!loadingModules && plan === "Pro Unlimited" && modules.find(m => m.name.includes('Excel'))?.is_active && (
            <div onClick={() => { setActiveTab('excel'); setIsSidebarOpen(false); }}>
              <SidebarItem icon={<FileCode size={20} />} label="Extraer Excel" active={activeTab === 'excel'} />
            </div>
          )}
          {!loadingModules && plan === "Pro Unlimited" && modules.find(m => m.name.includes('SAT'))?.is_active && (
            <div onClick={() => { setActiveTab('sat'); setIsSidebarOpen(false); }}>
              <SidebarItem icon={<Globe size={20} />} label="Validador SAT" active={activeTab === 'sat'} />
            </div>
          )}

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
              <span className="text-sm font-bold">{credits}/{plan === 'Pro Unlimited' ? '10k' : '5'}</span>
            </div>
            <div className="h-2 bg-[var(--bg)] rounded-full overflow-hidden mb-4">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(credits / (plan === 'Pro Unlimited' ? 10000 : 5)) * 100}%` }}
                className="h-full bg-emerald-500"
              />
            </div>
            <button 
              onClick={() => setActiveTab('billing')}
              className="w-full py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs font-bold hover:bg-[var(--bg)]/80 transition-colors"
            >
              {t('expand')}
            </button>
          </div>

          <div 
            onClick={onLogout}
            className="flex items-center gap-3 p-3 rounded-2xl hover:bg-[var(--card)] transition-colors cursor-pointer group"
          >
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
      <main className="flex-1 p-6 lg:p-12 overflow-y-auto pt-24 lg:pt-12">
        <AnimatePresence>
          {notification && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={cn(
                "mb-8 p-4 rounded-2xl border flex items-center gap-3 font-bold text-sm",
                notification.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-rose-50 border-rose-100 text-rose-600"
              )}
            >
              {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              {notification.message}
            </motion.div>
          )}
        </AnimatePresence>

        <header className="flex flex-col lg:flex-row justify-between items-start gap-6 mb-12">
          <div>
            <h1 className="text-3xl lg:text-4xl font-display font-bold tracking-tight mb-2">Good afternoon, {user?.name || 'User'}</h1>
            <p className="opacity-50 text-sm">Let's find some calm in your data cleaning workflow today.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {activeTab === 'panel' ? (
            <>
              {/* Upload Area */}
              <div className="lg:col-span-2 space-y-8">
                <div 
                  {...getRootProps()} 
                  className={cn(
                    "aspect-square lg:aspect-[2/1] rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center p-6 lg:p-12 transition-all cursor-pointer",
                    isDragActive ? "border-brand bg-brand/5 scale-[0.99]" : "border-[var(--border)] bg-[var(--card)] hover:border-brand/50"
                  )}
                >
                  <input {...getInputProps()} />
                  <div className="w-16 h-16 rounded-3xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center text-brand mb-6 shadow-sm">
                    <Upload size={32} />
                  </div>
                  <h3 className="text-xl lg:text-2xl font-display font-bold mb-2 text-center">{t('selectFile')}</h3>
                  <p className="opacity-40 text-sm text-center max-w-xs">{t('dropFiles')}</p>
                  <p className="mt-8 text-xs font-bold opacity-20 uppercase tracking-widest">{t('maxSize')}</p>
                </div>

                {files.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 lg:p-8 rounded-[2.5rem] bg-[var(--card)] border border-[var(--border)]"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                      <h3 className="font-bold">Pending Files ({files.length})</h3>
                      <button 
                        onClick={handleProcess}
                        disabled={processing || credits < files.length}
                        className="w-full sm:w-auto bg-brand text-white px-6 py-2 rounded-full text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
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
                            <span className="text-sm font-medium truncate max-w-[150px] sm:max-w-none">{f.name}</span>
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
                    className="p-6 lg:p-8 rounded-[2.5rem] bg-brand text-white"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
                      <div>
                        <h3 className="text-2xl font-display font-bold">{t('batchResults')}</h3>
                        <p className="text-sm opacity-70">{t('integrityCheck')}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        <button 
                          onClick={downloadZip}
                          className="flex-1 sm:flex-none bg-white text-brand px-4 lg:px-6 py-3 rounded-full text-xs lg:text-sm font-bold flex items-center justify-center gap-2 hover:scale-105 transition-transform"
                        >
                          <Download size={16} />
                          {t('exportAll')}
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                      <StatCard label="Cleaned" value={results.filter(r => r.success && !r.warnings.some(w => w.toLowerCase().includes("error") || w.toLowerCase().includes("alerta"))).length} />
                      <StatCard label="Exceptions" value={results.filter(r => !r.success || r.warnings.some(w => w.toLowerCase().includes("error") || w.toLowerCase().includes("alerta"))).length} />
                      <StatCard label="Efficiency" value={`${Math.round((results.filter(r => r.success && !r.warnings.some(w => w.toLowerCase().includes("error") || w.toLowerCase().includes("alerta"))).length / results.length) * 100)}%`} />
                    </div>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {results.map((r, i) => (
                        <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/20 transition-colors">
                          <div className="flex items-center gap-3">
                            {!r.success ? (
                              <AlertCircle size={18} className="text-rose-500" />
                            ) : r.warnings.some(w => w.toLowerCase().includes("error") || w.toLowerCase().includes("alerta") || w.toLowerCase().includes("faltante") || w.toLowerCase().includes("cálculo")) ? (
                              <AlertCircle size={18} className="text-amber-500" />
                            ) : (
                              <CheckCircle2 size={18} className="text-emerald-500" />
                            )}
                            <span className="text-sm font-medium truncate max-w-[120px] sm:max-w-[200px]">{r.originalName}</span>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="hidden sm:flex flex-wrap gap-1 justify-end max-w-[150px]">
                              {r.warnings.slice(0, 1).map((w, j) => (
                                <span key={j} className="text-[9px] bg-white/20 px-2 py-0.5 rounded-md uppercase font-bold tracking-wider truncate max-w-full">{w}</span>
                              ))}
                              {r.warnings.length > 1 && (
                                <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded-md font-bold">+{r.warnings.length - 1}</span>
                              )}
                            </div>
                            <button 
                              onClick={() => setSelectedResult(r)}
                              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/30 transition-colors relative"
                              title="Ver detalles"
                            >
                              <Search size={16} />
                              {r.satStatus && (
                                <div className={cn(
                                  "absolute -top-1 -right-1 w-2 h-2 rounded-full",
                                  r.satStatus.estado === 'Vigente' ? "bg-emerald-400" : "bg-rose-400"
                                )} />
                              )}
                            </button>
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
                    {history.length > 0 ? history.slice(0, 3).map((item, i) => (
                      <ActivityItem 
                        key={i} 
                        label={item.filename || 'Unknown'} 
                        time={new Date(item.created_at).toLocaleDateString() + ' • ' + new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                        status={item.status || 'UNKNOWN'} 
                      />
                    )) : (
                      <p className="text-xs opacity-30 text-center py-4">No activity yet</p>
                    )}
                  </div>
                </div>

                <div className="p-8 rounded-[2.5rem] bg-[var(--card)] border border-[var(--border)]">
                  <div className="flex items-center gap-2 mb-8">
                    <Zap size={20} className="opacity-30" />
                    <h3 className="font-bold">{t('performance')}</h3>
                  </div>
                  <div className="space-y-4">
                    <PerformanceItem label={t('totalCleaned')} value={stats.totalCleaned.toString()} />
                    <PerformanceItem label={t('avgSpeed')} value={stats.avgSpeed} />
                    <PerformanceItem label="Time Saved" value={stats.timeSaved} />
                    <PerformanceItem label={t('cloudSpace')} value={stats.cloudSpace} />
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
            </>
          ) : activeTab === 'excel' ? (
            <div className="lg:col-span-3 p-6 lg:p-10 rounded-[2.5rem] bg-[var(--card)] border border-[var(--border)]">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-display font-bold">Extracción Masiva a Excel</h2>
                  <p className="text-sm opacity-40">Sube tus XMLs para generar un reporte detallado en Excel.</p>
                </div>
                <FileCode size={32} className="text-emerald-500 opacity-20" />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div 
                  {...getRootProps()} 
                  className="aspect-video rounded-[2rem] border-2 border-dashed border-[var(--border)] bg-[var(--bg)] flex flex-col items-center justify-center p-8 cursor-pointer hover:border-emerald-500/50 transition-colors"
                >
                  <input {...getInputProps()} />
                  <Upload size={32} className="text-emerald-500 mb-4" />
                  <p className="font-bold text-center">Arrastra tus XMLs aquí</p>
                  <p className="text-xs opacity-40 mt-2">Solo archivos .xml</p>
                </div>

                <div className="space-y-6">
                  <div className="p-6 rounded-3xl bg-emerald-50 border border-emerald-100">
                    <h4 className="font-bold text-emerald-900 mb-2 flex items-center gap-2">
                      <CheckCircle2 size={16} />
                      ¿Qué extraemos?
                    </h4>
                    <ul className="text-xs text-emerald-800 space-y-2 opacity-80">
                      <li>• Datos del Emisor y Receptor (RFC, Nombre)</li>
                      <li>• Conceptos, Cantidades y Unidades</li>
                      <li>• Impuestos Trasladados y Retenidos</li>
                      <li>• UUID, Fecha y Folio Fiscal</li>
                    </ul>
                  </div>
                  
                  {files.length > 0 && (
                    <button 
                      onClick={exportToExcel}
                      className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                    >
                      <Download size={18} />
                      Generar Excel ({files.length} archivos)
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'sat' ? (
            <div className="lg:col-span-3 p-6 lg:p-10 rounded-[2.5rem] bg-[var(--card)] border border-[var(--border)]">
              <div className="flex justify-between items-center mb-12">
                <div>
                  <h2 className="text-3xl font-display font-bold mb-2">Estatus Legal SAT</h2>
                  <p className="text-sm opacity-40 max-w-md">Validación masiva y en tiempo real directamente con los servidores oficiales del SAT.</p>
                </div>
                <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <Globe size={32} />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
                <div className="lg:col-span-2 space-y-6">
                  <div 
                    {...getRootProps()} 
                    className="aspect-square rounded-[2.5rem] border-2 border-dashed border-[var(--border)] bg-[var(--bg)] flex flex-col items-center justify-center p-8 cursor-pointer hover:border-blue-500/50 transition-all group"
                  >
                    <input {...getInputProps()} />
                    <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mb-6 group-hover:scale-110 transition-transform">
                      <Search size={32} />
                    </div>
                    <p className="font-bold text-center text-lg">Sube tus XMLs</p>
                    <p className="text-xs opacity-40 mt-2 text-center">Arrastra o haz clic para seleccionar los archivos a validar</p>
                  </div>

                  {files.length > 0 && (
                    <button 
                      disabled={processing || validatingSAT}
                      onClick={async () => {
                        setValidatingSAT(true); // Show loading state immediately
                        setProcessing(true);
                        const newResults = [];
                        for(const f of files) {
                          const res = await cleanXML(f);
                          newResults.push(res);
                        }
                        setResults(newResults);
                        setProcessing(false);
                        // Call validateSAT with the newly processed results
                        await validateSAT(newResults);
                      }}
                      className={cn(
                        "w-full py-5 rounded-[1.5rem] font-bold shadow-xl transition-all flex items-center justify-center gap-3",
                        (processing || validatingSAT) 
                          ? "bg-blue-600/50 text-white/80 cursor-not-allowed shadow-none" 
                          : "bg-blue-600 text-white shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98]"
                      )}
                    >
                      {(processing || validatingSAT) ? (
                        <>
                          <RefreshCw size={20} className="animate-spin" />
                          {processing ? "Procesando XMLs..." : "Consultando al SAT..."}
                        </>
                      ) : (
                        <>
                          <Zap size={20} />
                          Validar {files.length} Comprobantes
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="lg:col-span-3">
                  {results.some(r => r.satStatus) ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-lg flex items-center gap-2">
                          <CheckCircle2 size={20} className="text-blue-500" />
                          Resultados de Consulta
                        </h4>
                        <div className="flex gap-2">
                          <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold uppercase tracking-wider">
                            {results.filter(r => r.satStatus?.estado === 'Vigente').length} Vigentes
                          </div>
                          <div className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 text-[10px] font-bold uppercase tracking-wider">
                            {results.filter(r => r.satStatus && r.satStatus.estado !== 'Vigente').length} Otros
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-4">
                        {results.filter(r => r.satStatus).map((r, i) => (
                          <motion.div 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            key={i} 
                            className="p-5 bg-[var(--bg)] rounded-[1.5rem] border border-[var(--border)] hover:border-blue-500/30 transition-colors shadow-sm"
                          >
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center",
                                  r.satStatus?.estado === 'Vigente' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                                )}>
                                  <FileText size={20} />
                                </div>
                                <div>
                                  <p className="text-sm font-bold truncate max-w-[150px] sm:max-w-[250px]">{r.originalName}</p>
                                  <p className="text-[10px] opacity-40 font-mono">{r.warnings[0] || 'CFDI 4.0'}</p>
                                </div>
                              </div>
                              <span className={cn(
                                "text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest",
                                r.satStatus?.estado === 'Vigente' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                              )}>
                                {r.satStatus?.estado}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-[var(--border)]">
                              <div>
                                <p className="text-[9px] font-bold opacity-30 uppercase mb-1">{t('satCode')}</p>
                                <p className="text-[11px] font-medium leading-tight">{r.satStatus?.codigo}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[9px] font-bold opacity-30 uppercase mb-1">{t('satCancelable')}</p>
                                <p className="text-[11px] font-medium">{r.satStatus?.cancelable}</p>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-20 text-center p-12">
                      <Globe size={64} className="mb-6" />
                      <p className="text-xl font-display font-bold">Sin resultados</p>
                      <p className="text-sm">Sube tus archivos para iniciar la validación legal</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'history' ? (
            <div className="lg:col-span-3 p-6 lg:p-8 rounded-[2.5rem] bg-[var(--card)] border border-[var(--border)]">
              <h2 className="text-2xl font-display font-bold mb-8">{t('history')}</h2>
              <div className="space-y-4">
                {history.length > 0 ? history.map((item, i) => (
                  <ActivityItem 
                    key={i} 
                    label={item.filename || 'Unknown'} 
                    time={new Date(item.created_at).toLocaleDateString() + ' • ' + new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                    status={item.status || 'UNKNOWN'} 
                  />
                )) : (
                  <p className="text-sm opacity-30 text-center py-12">Your processing history will appear here.</p>
                )}
              </div>
            </div>
          ) : activeTab === 'billing' ? (
            <div className="lg:col-span-3 p-6 lg:p-8 rounded-[2.5rem] bg-[var(--card)] border border-[var(--border)]">
              <h2 className="text-2xl font-display font-bold mb-8">{t('billing')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-6 lg:p-8 rounded-3xl border border-[var(--border)] bg-[var(--bg)] flex flex-col">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-bold mb-1">Plan Mensual</h3>
                      <p className="text-sm opacity-50">Ideal para trabajo constante</p>
                    </div>
                    <span className="text-2xl font-display font-bold">$29<span className="text-sm opacity-50">/mes</span></span>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    <li className="text-sm flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Créditos ilimitados (10,000)</li>
                    <li className="text-sm flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Reparación Total</li>
                    <li className="text-sm flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Alertas Inteligentes</li>
                    <li className="text-sm flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Soporte prioritario</li>
                  </ul>
                  <button 
                    onClick={() => handleUpgrade("price_1T5vEpE2HOY0nwdF4XTuqzN8")}
                    className="w-full py-4 bg-brand text-white rounded-2xl font-bold shadow-lg shadow-brand/20 hover:scale-[1.02] transition-transform"
                  >
                    Suscribirse Mensual
                  </button>
                </div>

                <div className="p-6 lg:p-8 rounded-3xl border-2 border-brand bg-brand/5 flex flex-col relative overflow-hidden">
                  <div className="absolute top-4 right-4 bg-brand text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">Ahorra 2 meses</div>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-bold mb-1">Plan Anual</h3>
                      <p className="text-sm opacity-50">Ahorras dos meses con las mismas capacidades</p>
                    </div>
                    <span className="text-2xl font-display font-bold">$290<span className="text-sm opacity-50">/año</span></span>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    <li className="text-sm flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Todo lo del plan mensual</li>
                    <li className="text-sm flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> 2 meses gratis</li>
                    <li className="text-sm flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Acceso anticipado a funciones</li>
                  </ul>
                  <button 
                    onClick={() => handleUpgrade("price_1T5vEpE2HOY0nwdFIlpwJm2s")}
                    className="w-full py-4 bg-brand text-white rounded-2xl font-bold shadow-lg shadow-brand/20 hover:scale-[1.02] transition-transform"
                  >
                    Suscribirse Anual
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-3 p-6 lg:p-8 rounded-[2.5rem] bg-[var(--card)] border border-[var(--border)]">
              <h2 className="text-2xl font-display font-bold mb-8">{t('preferences')}</h2>
              <div className="max-w-md space-y-8">
                <div>
                  <label className="block text-sm font-bold mb-4 opacity-50 uppercase tracking-widest">Language</label>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button 
                      onClick={() => setLang('es')}
                      className={cn("flex-1 py-4 rounded-2xl border border-[var(--border)] font-bold transition-all", lang === 'es' ? "bg-brand text-white border-brand" : "bg-[var(--bg)]")}
                    >
                      Español
                    </button>
                    <button 
                      onClick={() => setLang('en')}
                      className={cn("flex-1 py-4 rounded-2xl border border-[var(--border)] font-bold transition-all", lang === 'en' ? "bg-brand text-white border-brand" : "bg-[var(--bg)]")}
                    >
                      English
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-4 opacity-50 uppercase tracking-widest">Appearance</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button onClick={() => setTheme('day')} className={cn("py-4 rounded-2xl border border-[var(--border)] flex flex-col items-center gap-2", theme === 'day' && "border-brand bg-brand/5 text-brand")}>
                      <Sun size={20} />
                      <span className="text-xs font-bold">{t('day')}</span>
                    </button>
                    <button onClick={() => setTheme('afternoon')} className={cn("py-4 rounded-2xl border border-[var(--border)] flex flex-col items-center gap-2", theme === 'afternoon' && "border-brand bg-brand/5 text-amber-600")}>
                      <Sunset size={20} />
                      <span className="text-xs font-bold">{t('afternoon')}</span>
                    </button>
                    <button onClick={() => setTheme('night')} className={cn("py-4 rounded-2xl border border-[var(--border)] flex flex-col items-center gap-2", theme === 'night' && "border-brand bg-brand/5 text-blue-600")}>
                      <Moon size={20} />
                      <span className="text-xs font-bold">{t('night')}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Details Modal */}
      <AnimatePresence>
        {selectedResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedResult(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-[var(--card)] rounded-[2rem] lg:rounded-[2.5rem] border border-[var(--border)] shadow-2xl overflow-hidden mx-4"
            >
              <div className="p-6 lg:p-8 border-b border-[var(--border)] flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl flex items-center justify-center",
                    selectedResult.success ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                  )}>
                    {selectedResult.success ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                  </div>
                  <div>
                    <h3 className="text-lg lg:text-xl font-bold truncate max-w-[150px] sm:max-w-none">{selectedResult.originalName}</h3>
                    <p className="text-[10px] lg:text-xs opacity-40">Detalles del procesamiento y validación</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedResult(null)}
                  className="p-2 rounded-full hover:bg-[var(--bg)] transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 lg:p-8 max-h-[60vh] overflow-y-auto space-y-6">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-30 mb-4">Alertas y Hallazgos</h4>
                  <div className="space-y-3">
                    {selectedResult.warnings.length > 0 ? selectedResult.warnings.map((w, i) => (
                      <div key={i} className="flex gap-3 p-4 rounded-2xl bg-[var(--bg)] border border-[var(--border)]">
                        <div className={cn(
                          "mt-0.5 shrink-0",
                          w.toLowerCase().includes("error") || w.toLowerCase().includes("alerta") || w.toLowerCase().includes("cálculo") ? "text-amber-500" : "text-emerald-500"
                        )}>
                          <AlertCircle size={16} />
                        </div>
                        <p className="text-sm font-medium leading-relaxed">{w}</p>
                      </div>
                    )) : (
                      <p className="text-sm opacity-40 italic">No se encontraron alertas adicionales.</p>
                    )}
                  </div>
                </div>

                {selectedResult.satStatus && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-30 mb-4">Estatus Real SAT</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-[var(--bg)] border border-[var(--border)]">
                        <p className="text-[10px] opacity-40 uppercase font-bold mb-1">Estado</p>
                        <p className={cn(
                          "text-sm font-bold",
                          selectedResult.satStatus.estado === 'Vigente' ? "text-emerald-500" : "text-rose-500"
                        )}>
                          {selectedResult.satStatus.estado}
                        </p>
                      </div>
                      <div className="p-4 rounded-2xl bg-[var(--bg)] border border-[var(--border)]">
                        <p className="text-[10px] opacity-40 uppercase font-bold mb-1">Cancelable</p>
                        <p className="text-sm font-bold">{selectedResult.satStatus.cancelable}</p>
                      </div>
                      <div className="sm:col-span-2 p-4 rounded-2xl bg-[var(--bg)] border border-[var(--border)]">
                        <p className="text-[10px] opacity-40 uppercase font-bold mb-1">Código SAT</p>
                        <p className="text-xs font-mono break-all">{selectedResult.satStatus.codigo}</p>
                      </div>
                    </div>
                  </div>
                )}

                {!selectedResult.success && selectedResult.error && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-rose-500 mb-4">Error Crítico</h4>
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium">
                      {selectedResult.error}
                    </div>
                  </div>
                )}

                <div className="p-6 rounded-3xl bg-brand/5 border border-brand/10">
                  <p className="text-xs opacity-60 leading-relaxed">
                    <span className="font-bold text-brand block mb-1">Nota de Seguridad:</span>
                    Las reparaciones realizadas se limitan a la estructura XML y limpieza de caracteres. Los sellos fiscales y firmas digitales no han sido modificados para preservar la validez legal del documento.
                  </p>
                </div>
              </div>

              <div className="p-6 lg:p-8 bg-[var(--bg)]/50 border-t border-[var(--border)] flex justify-end">
                <button 
                  onClick={() => setSelectedResult(null)}
                  className="w-full sm:w-auto px-8 py-3 bg-brand text-white rounded-full font-bold shadow-lg shadow-brand/20 hover:scale-[1.02] transition-transform"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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

interface ActivityItemProps {
  label: string;
  time: string;
  status: string;
  key?: any;
}

function ActivityItem({ label, time, status }: ActivityItemProps) {
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
