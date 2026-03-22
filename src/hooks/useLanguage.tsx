import React, { createContext, useContext, useState } from 'react';

export type Language = 'es' | 'en';

const translations = {
  es: {
    heroTitle: "Auditoría y Gestión",
    heroHighlight: "CFDI Inteligente",
    heroSub: "La solución definitiva para equipos contables y administrativos. Audita cálculos, repara estructuras y asegura la deducibilidad de tus CFDI al instante.",
    heroSubPro: "Potencia tu administración con limpieza inteligente, auditoría de cálculos, extracción masiva a Excel y validación SAT en tiempo real. La suite más completa para el manejo de CFDI.",
    moduleCleaningTitle: "Auditoría y Limpieza",
    moduleCleaningDesc: "No solo limpia; valida cálculos de impuestos, verifica la estructura de nodos y repara XMLs dañados para asegurar una deducibilidad del 100%.",
    moduleExcelTitle: "Inteligencia de Datos (Excel)",
    moduleExcelDesc: "Transforma cientos de XMLs en reportes financieros detallados. Extrae conceptos, impuestos y metadatos en segundos. Exclusivo Pro.",
    moduleSatTitle: "Estatus Legal (SAT)",
    moduleSatDesc: "Conexión directa con el SAT para verificar vigencia, cancelabilidad y códigos de estatus de forma masiva. Exclusivo Pro.",
    satStatus: "Estado",
    satCode: "Código",
    satCancelable: "Cancelable",
    tryFree: "Probar gratis",
    freeCredits: "Obtén 5 créditos gratis al instante",
    features: "Características",
    pricing: "Precios",
    howItWorks: "Cómo funciona",
    login: "Iniciar sesión",
    dashboard: "Panel",
    upload: "Subir",
    process: "Procesar",
    download: "Descargar",
    credits: "Créditos",
    expand: "Expandir capacidad",
    recentActivity: "Actividad reciente",
    performance: "Rendimiento",
    totalCleaned: "Total limpiados",
    avgSpeed: "Velocidad prom.",
    cloudSpace: "Espacio en la nube",
    operational: "Operacional",
    day: "Día",
    afternoon: "Tarde",
    night: "Noche",
    selectFile: "Seleccionar archivo",
    dropFiles: "Suelta tus archivos XML o ZIP aquí",
    maxSize: "Soportamos hasta 50MB con precisión.",
    cleanNow: "Limpiar ahora",
    batchResults: "Resultados del lote",
    exportAll: "Exportar todo (.ZIP)",
    integrityCheck: "Verificación de integridad 100%",
    exceptions: "Excepciones",
    compression: "Compresión",
    retentionPolicy: "Los archivos se eliminan automáticamente después de 24 horas.",
    enterpriseReady: "LISTO PARA EMPRESAS",
    footerDesc: "Rápido, seguro y confiable. Construido para equipos administrativos modernos.",
    rights: "Todos los derechos reservados.",
    adminPanel: "Panel de Administración",
    totalUsers: "Usuarios Totales",
    activeSubscriptions: "Suscripciones Activas",
    dailyRevenue: "Ingresos Diarios",
    anomalyRate: "Tasa de Anomalías",
    userDirectory: "Directorio de Usuarios",
    systemLogs: "Logs del Sistema",
    overview: "Vista General",
    monitoringLog: "Log de Monitoreo",
    priority: "Prioridad",
    action: "Acción",
    status: "Estado",
    reference: "Referencia",
    eventDetail: "Detalle del Evento",
    initiator: "Iniciador",
    moderate: "Moderada",
    critical: "Crítica",
    minor: "Menor",
    systemHealthy: "Sistema Saludable",
    history: "Historial",
    billing: "Facturación",
    preferences: "Preferencias",
    logout: "Cerrar sesión"
  },
  en: {
    heroTitle: "Audit & Manage",
    heroHighlight: "Smart CFDI",
    heroSub: "The definitive solution for accounting and administrative teams. Audit calculations, repair structures, and ensure the deductibility of your CFDI instantly.",
    heroSubPro: "Power your administration with smart cleaning, tax audit, bulk Excel extraction, and real-time SAT validation. The most complete suite for CFDI management.",
    moduleCleaningTitle: "Audit & Cleaning",
    moduleCleaningDesc: "More than just cleaning; it validates tax calculations, verifies node structure, and repairs damaged XMLs to ensure 100% deductibility.",
    moduleExcelTitle: "Data Intelligence (Excel)",
    moduleExcelDesc: "Transform hundreds of XMLs into detailed financial reports. Extract concepts, taxes, and metadata in seconds. Pro Exclusive.",
    moduleSatTitle: "Legal Status (SAT)",
    moduleSatDesc: "Direct connection to the SAT to verify validity, cancelability, and status codes in bulk. Pro Exclusive.",
    satStatus: "Status",
    satCode: "Code",
    satCancelable: "Cancelable",
    tryFree: "Try for free",
    freeCredits: "Get 5 free credits instantly",
    features: "Features",
    pricing: "Pricing",
    howItWorks: "How it works",
    login: "Log in",
    dashboard: "Dashboard",
    upload: "Upload",
    process: "Process",
    download: "Download",
    credits: "Credits",
    expand: "Expand capacity",
    recentActivity: "Recent Activity",
    performance: "Performance",
    totalCleaned: "Total Cleaned",
    avgSpeed: "Avg. Speed",
    cloudSpace: "Cloud Space",
    operational: "Operational",
    day: "Day",
    afternoon: "Afternoon",
    night: "Night",
    selectFile: "Select from Device",
    dropFiles: "Gently drop your XML or ZIP files here.",
    maxSize: "We handle up to 50MB with precision and care.",
    cleanNow: "Clean Now",
    batchResults: "Batch Results",
    exportAll: "Export All (.ZIP)",
    integrityCheck: "100% Integrity Check",
    exceptions: "Exceptions",
    compression: "Compression",
    retentionPolicy: "Processed assets are stored in volatile memory for 24 hours.",
    enterpriseReady: "ENTERPRISE READY",
    footerDesc: "The fast, secure, and reliable way to handle business XML files. Built for modern administrative teams.",
    rights: "All rights reserved.",
    adminPanel: "Admin Panel",
    totalUsers: "Total Users",
    activeSubscriptions: "Active Subscriptions",
    dailyRevenue: "Daily Revenue",
    anomalyRate: "Anomaly Rate",
    userDirectory: "User Directory",
    systemLogs: "System Logs",
    overview: "Overview",
    monitoringLog: "Monitoring Log",
    priority: "Priority",
    action: "Action",
    status: "Status",
    reference: "Reference",
    eventDetail: "Event Detail",
    initiator: "Initiator",
    moderate: "Moderate",
    critical: "Critical",
    minor: "Minor",
    systemHealthy: "System Healthy",
    history: "History",
    billing: "Billing",
    preferences: "Preferences",
    logout: "Log out"
  }
};

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: keyof typeof translations['es']) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('app-lang') as Language;
    return saved || 'es';
  });

  const t = (key: keyof typeof translations['es']) => {
    return translations[lang][key] || key;
  };

  const handleSetLang = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('app-lang', newLang);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang: handleSetLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
