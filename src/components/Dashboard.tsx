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
  FileCode,
  BookOpen,
  Printer,
  FileImage,
  BarChart3,
  FolderTree,
  Scale
} from "lucide-react";
import { cn } from "../utils/cn";
import { cleanXML, CleanResult } from "../utils/xmlCleaner";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

export default function Dashboard({ user, onAdmin, onLogout }: { user: any, onAdmin: () => void, onLogout: () => void }) {
  const { t, lang, setLang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'panel' | 'history' | 'billing' | 'preferences' | 'excel' | 'sat' | 'guide' | 'pdf' | 'concil' | 'analytics' | 'organizer'>('panel');
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
  const [pdfLogo, setPdfLogo] = useState<string | null>(null);
  
  // Concil Module States
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [concilResults, setConcilResults] = useState<any | null>(null);

  // Organizer Mode State
  const [organizerFormat, setOrganizerFormat] = useState('rfc_date');

  // Analytics Mode State
  const [analyticsData, setAnalyticsData] = useState<any | null>(null);

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

  const generatePDFs = async () => {
    if (files.length === 0) return;
    setProcessing(true);

    try {
      const xmlContents = await Promise.all(files.map(async (file) => {
        const text = await file.text();
        return { name: file.name, content: text };
      }));

      const zip = new JSZip();

      for (const { name, content } of xmlContents) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, "text/xml");
        
        const getElement = (tagName: string) => {
          const elements = xmlDoc.getElementsByTagNameNS("*", tagName);
          return elements.length > 0 ? elements[0] : xmlDoc.getElementsByTagName(tagName)[0] || xmlDoc.getElementsByTagName(`cfdi:${tagName}`)[0];
        };

        const comprobante = getElement("Comprobante");
        const emisor = getElement("Emisor");
        const receptor = getElement("Receptor");
        const timbre = getElement("TimbreFiscalDigital");
        
        const conceptosNode = getElement("Conceptos");
        const conceptosList = conceptosNode ? Array.from(conceptosNode.getElementsByTagNameNS("*", "Concepto")).length > 0 
          ? Array.from(conceptosNode.getElementsByTagNameNS("*", "Concepto"))
          : Array.from(conceptosNode.getElementsByTagName("cfdi:Concepto")) 
          : [];

        const doc = new jsPDF();
        
        // Add corporate styling to the PDF
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = doc.internal.pageSize.getHeight();

        // Header Background
        doc.setFillColor(34, 40, 49); // Dark blue/grey
        doc.rect(0, 0, pdfWidth, 40, 'F');

        if (pdfLogo) {
          doc.addImage(pdfLogo, 'PNG', 14, 10, 40, 20);
        } else {
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(24);
          doc.setFont("helvetica", "bold");
          doc.text("EMPRESA SA DE CV", 14, 25);
        }

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const serieFolio = `${comprobante?.getAttribute("Serie") || ""} ${comprobante?.getAttribute("Folio") || ""}`.trim();
        doc.text(`FACTURA ${serieFolio ? `NO. ${serieFolio}` : ''}`, pdfWidth - 14, 20, { align: 'right' });
        doc.text(`UUID: ${timbre?.getAttribute("UUID") || "N/A"}`, pdfWidth - 14, 27, { align: 'right' });

        // Emisor & Receptor Sections
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("EMISOR", 14, 55);
        doc.text("RECEPTOR", pdfWidth / 2 + 10, 55);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        
        doc.text(`Razón Social: ${emisor?.getAttribute("Nombre") || "No especificado"}`, 14, 62);
        doc.text(`RFC: ${emisor?.getAttribute("Rfc") || ""}`, 14, 67);
        doc.text(`Régimen: ${emisor?.getAttribute("RegimenFiscal") || "N/A"}`, 14, 72);

        doc.text(`Razón Social: ${receptor?.getAttribute("Nombre") || "No especificado"}`, pdfWidth / 2 + 10, 62);
        doc.text(`RFC: ${receptor?.getAttribute("Rfc") || ""}`, pdfWidth / 2 + 10, 67);
        doc.text(`Uso CFDI: ${receptor?.getAttribute("UsoCFDI") || "N/A"}`, pdfWidth / 2 + 10, 72);

        // General Info Box
        doc.setDrawColor(220, 220, 220);
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(14, 85, pdfWidth - 28, 20, 3, 3, 'FD');
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("Fecha", 20, 92);
        doc.text("Moneda", 70, 92);
        doc.text("Forma Pago", 120, 92);
        doc.text("Método Pago", 160, 92);

        doc.setFont("helvetica", "normal");
        doc.text(comprobante?.getAttribute("Fecha") || "", 20, 99);
        doc.text(comprobante?.getAttribute("Moneda") || "", 70, 99);
        doc.text(comprobante?.getAttribute("FormaPago") || "", 120, 99);
        doc.text(comprobante?.getAttribute("MetodoPago") || "", 160, 99);

        // Conceptos Table
        const tableData = conceptosList.map(c => [
          c.getAttribute("ClaveProdServ") || "",
          c.getAttribute("Cantidad") || "",
          c.getAttribute("ClaveUnidad") || "",
          c.getAttribute("Descripcion") || "",
          `$${parseFloat(c.getAttribute("ValorUnitario") || "0").toFixed(2)}`,
          `$${parseFloat(c.getAttribute("Importe") || "0").toFixed(2)}`
        ]);

        autoTable(doc, {
          startY: 115,
          head: [['Clave', 'Cant', 'Unidad', 'Descripción', 'Unitario', 'Importe']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [34, 40, 49], textColor: 255 },
          styles: { fontSize: 8, cellPadding: 4, textColor: [50, 50, 50] },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 15 },
            2: { cellWidth: 15 },
            4: { cellWidth: 25, halign: 'right' },
            5: { cellWidth: 25, halign: 'right' }
          }
        });

        // Totals
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(10);
        
        const subtotal = parseFloat(comprobante?.getAttribute("SubTotal") || "0").toFixed(2);
        const descuento = parseFloat(comprobante?.getAttribute("Descuento") || "0").toFixed(2);
        const total = parseFloat(comprobante?.getAttribute("Total") || "0").toFixed(2);

        doc.setFont("helvetica", "normal");
        doc.text("Subtotal:", pdfWidth - 50, finalY);
        doc.text(`$${subtotal}`, pdfWidth - 14, finalY, { align: 'right' });
        
        let currentY = finalY;
        if (descuento !== "0.00") {
          currentY += 6;
          doc.text("Descuento:", pdfWidth - 50, currentY);
          doc.text(`$${descuento}`, pdfWidth - 14, currentY, { align: 'right' });
        }

        currentY += 8;
        doc.setFont("helvetica", "bold");
        doc.text("TOTAL:", pdfWidth - 50, currentY);
        doc.text(`$${total}`, pdfWidth - 14, currentY, { align: 'right' });

        // Footer
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150, 150, 150);
        doc.text("Este documento es una representación impresa de un CFDI.", pdfWidth / 2, pdfHeight - 20, { align: 'center' });
        doc.text("Generado profesionalmente por la tecnología de XMLs PRO.", pdfWidth / 2, pdfHeight - 15, { align: 'center' });

        const pdfBlob = doc.output("blob");
        
        if (files.length === 1) {
           doc.save(`Factura_${name.replace('.xml', '')}.pdf`);
        } else {
           zip.file(`Factura_${name.replace('.xml', '')}.pdf`, pdfBlob);
        }
      }

      if (files.length > 1) {
        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Facturas_PDF_${Date.now()}.zip`;
        a.click();
      }

      setFiles([]);
      setNotification({ type: 'success', message: `${files.length > 1 ? 'PDFs generados en ZIP' : 'PDF generado'}. Lista limpiada.` });
    } catch (error) {
      console.error("Error generating PDFs:", error);
      setNotification({ type: 'error', message: 'Error al generar los PDFs. Verifica los archivos.' });
    } finally {
      setProcessing(false);
    }
  };

  const runAnalytics = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    try {
      let totalSubtotal = 0;
      let totalIvaTrasladado = 0;
      let totalIvaRetenido = 0;
      let totalIsrRetenido = 0;
      const entities: Record<string, number> = {};

      for (const file of files) {
        const text = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        
        const getElement = (tagName: string) => {
          const elements = xmlDoc.getElementsByTagNameNS("*", tagName);
          return elements.length > 0 ? elements[0] : xmlDoc.getElementsByTagName(tagName)[0] || xmlDoc.getElementsByTagName(`cfdi:${tagName}`)[0];
        };

        const comp = getElement("Comprobante");
        const tipoDeComprobante = comp?.getAttribute("TipoDeComprobante");
        const subT = parseFloat(comp?.getAttribute("SubTotal") || "0");
        
        if (tipoDeComprobante === 'I') {
          totalSubtotal += subT;
        } else if (tipoDeComprobante === 'E') {
          totalSubtotal -= subT;
        }

        const impuestos = getElement("Impuestos");
        if (impuestos) {
          totalIvaTrasladado += parseFloat(impuestos.getAttribute("TotalImpuestosTrasladados") || "0");
          totalIvaRetenido += parseFloat(impuestos.getAttribute("TotalImpuestosRetenidos") || "0");
        }
        
        // Count limits for Top 10 Clientes/Proveedores
        const emisor = getElement("Emisor");
        const receptor = getElement("Receptor");
        
        // We will consider it an expense if we are the receptor, and income if we are emisor.
        // It's a bit tricky without knowing 'OUR' RFC, so let's just group by whoever is NOT us, or just collect all.
        // Since we don't know the owner's RFC, we'll just track Emisor as provider and Receptor as client
        const emisorName = emisor?.getAttribute("Nombre") || emisor?.getAttribute("Rfc") || "Desconocido";
        entities[emisorName] = (entities[emisorName] || 0) + subT;
      }

      const topEntities = Object.entries(entities)
        .map(([name, value]) => ({ name: name.substring(0, 15) + "...", value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      setAnalyticsData({
        subtotal: totalSubtotal,
        ivaTrasladado: totalIvaTrasladado,
        ivaRetenido: totalIvaRetenido,
        // (Just a sample) Add ISR logic if needed, simplify for now
        isrRetenido: totalIsrRetenido, 
        topEntities
      });
      setNotification({ type: 'success', message: 'Análisis financiero completado exitosamente.' });
    } catch (e) {
      console.error(e);
      setNotification({ type: 'error', message: 'Error al generar analíticas.' });
    } finally {
      setProcessing(false);
    }
  };

  const runConciliation = async () => {
    if (files.length === 0 || !bankFile) {
      setNotification({ type: 'error', message: 'Sube tanto el Excel del banco como los XMLs.' });
      return;
    }
    setProcessing(true);
    try {
      const buffer = await bankFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const excelData = XLSX.utils.sheet_to_json<any>(sheet);
      
      // Convert excel data to a Set of total values or something to match
      // For a real app, it matches UUID or exact amount. We'll match by amount.
      const bankAmounts = excelData.map(row => {
        // finding a column that looks like amount/monto/cargo/abono
        const val = Object.values(row).find(x => typeof x === 'number');
        return val ? Math.abs(val as number) : null;
      }).filter(Boolean);

      const missing: any[] = [];
      const found: any[] = [];

      for (const file of files) {
        const text = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        
        const getElement = (tagName: string) => {
          const elements = xmlDoc.getElementsByTagNameNS("*", tagName);
          return elements.length > 0 ? elements[0] : xmlDoc.getElementsByTagName(tagName)[0] || xmlDoc.getElementsByTagName(`cfdi:${tagName}`)[0];
        };

        const comp = getElement("Comprobante");
        const total = parseFloat(comp?.getAttribute("Total") || "0");
        const uuid = getElement("TimbreFiscalDigital")?.getAttribute("UUID") || file.name;

        // Try to find a match
        const matchIndex = bankAmounts.findIndex(amt => amt && Math.abs(amt - total) < 0.1);
        
        if (matchIndex >= 0) {
          found.push({ file: file.name, uuid, total, status: 'Conciliado' });
          bankAmounts.splice(matchIndex, 1); // remove found to prevent double match
        } else {
          missing.push({ file: file.name, uuid, total, status: 'Falta Pago/Depósito' });
        }
      }

      setConcilResults([...found, ...missing]);
      setNotification({ type: 'success', message: `Conciliación terminada: ${found.length} conciliados, ${missing.length} sin match.` });
    } catch (e) {
      console.error(e);
      setNotification({ type: 'error', message: 'Error procesando la conciliación.' });
    } finally {
      setProcessing(false);
    }
  };

  const runAutoFiling = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    try {
      const zip = new JSZip();

      for (const file of files) {
        const text = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        
        const getElement = (tagName: string) => {
          const elements = xmlDoc.getElementsByTagNameNS("*", tagName);
          return elements.length > 0 ? elements[0] : xmlDoc.getElementsByTagName(tagName)[0] || xmlDoc.getElementsByTagName(`cfdi:${tagName}`)[0];
        };

        const comp = getElement("Comprobante");
        const emisor = getElement("Emisor");
        const tfd = getElement("TimbreFiscalDigital");
        
        const fechaFull = comp?.getAttribute("Fecha") || ""; 
        const dateObj = new Date(fechaFull);
        const year = isNaN(dateObj.getFullYear()) ? "Sin Fecha" : dateObj.getFullYear().toString();
        const month = isNaN(dateObj.getMonth()) ? "Mes" : dateObj.toLocaleString('es-ES', { month: 'long' });
        const tipo = comp?.getAttribute("TipoDeComprobante") === 'I' ? 'Ingresos' : 'Egresos';
        
        const rfc = emisor?.getAttribute("Rfc") || "UNKNOWN";
        const uuid = tfd?.getAttribute("UUID") || "NO-UUID";
        const fechaStr = fechaFull.split('T')[0] || "1970-01-01";

        let newName = "";
        if (organizerFormat === 'rfc_date') newName = `FACTURA_${rfc}_${fechaStr}.xml`;
        else if (organizerFormat === 'uuid') newName = `${uuid}.xml`;
        else if (organizerFormat === 'uuid_date') newName = `${uuid}_${fechaStr}.xml`;
        else newName = `FACTURA_${rfc}_${fechaStr}.xml`;

        zip.folder(year)?.folder(month)?.folder(tipo)?.file(newName, file);
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `XMLs_Organizados_${Date.now()}.zip`;
      a.click();

      setFiles([]);
      setNotification({ type: 'success', message: 'Tus XMLs han sido organizados y empaquetados.' });
    } catch (e) {
      console.error(e);
      setNotification({ type: 'error', message: 'Error en auto-filing.' });
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
          <div onClick={() => { setActiveTab('guide'); setIsSidebarOpen(false); }}>
            <SidebarItem icon={<BookOpen size={20} />} label="¿Para qué sirve?" active={activeTab === 'guide'} />
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
          {!loadingModules && plan === "Pro Unlimited" && (
            <div onClick={() => { setActiveTab('pdf'); setIsSidebarOpen(false); }}>
              <SidebarItem icon={<Printer size={20} />} label="Representación Impresa" active={activeTab === 'pdf'} />
            </div>
          )}
          {!loadingModules && plan === "Pro Unlimited" && (
            <div onClick={() => { setActiveTab('concil'); setIsSidebarOpen(false); }}>
              <SidebarItem icon={<Scale size={20} />} label="Conciliación Inteligente" active={activeTab === 'concil'} />
            </div>
          )}
          {!loadingModules && plan === "Pro Unlimited" && (
            <div onClick={() => { setActiveTab('analytics'); setIsSidebarOpen(false); }}>
              <SidebarItem icon={<BarChart3 size={20} />} label="Dashboard Financiero" active={activeTab === 'analytics'} />
            </div>
          )}
          {!loadingModules && plan === "Pro Unlimited" && (
            <div onClick={() => { setActiveTab('organizer'); setIsSidebarOpen(false); }}>
              <SidebarItem icon={<FolderTree size={20} />} label="Auto-Filing" active={activeTab === 'organizer'} />
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
          ) : activeTab === 'pdf' ? (
            <div className="lg:col-span-3 p-6 lg:p-10 rounded-[2.5rem] bg-[var(--card)] border border-[var(--border)]">
              <div className="flex justify-between items-center mb-12">
                <div>
                  <h2 className="text-3xl font-display font-bold mb-2">Representación Impresa PREMIUM</h2>
                  <p className="text-sm opacity-40 max-w-md">Transforma XMLs en documentos PDF lujosos, corporativos y con tu marca.</p>
                </div>
                <div className="w-16 h-16 rounded-3xl bg-violet-500/10 flex items-center justify-center text-violet-500">
                  <Printer size={32} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-4">
                  <h3 className="font-bold flex items-center gap-2"><FileImage size={18} className="text-violet-500" /> Identidad Visual</h3>
                  <label className="block w-full aspect-[21/9] rounded-[1.5rem] border-2 border-dashed border-[var(--border)] bg-[var(--bg)] flex flex-col items-center justify-center p-4 cursor-pointer hover:border-violet-500/50 transition-colors relative overflow-hidden group">
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setPdfLogo(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }} 
                    />
                    {pdfLogo ? (
                      <div className="relative w-full h-full flex items-center justify-center p-4">
                        <img src={pdfLogo} alt="Logo" className="max-h-full max-w-full object-contain" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                          <span className="text-white font-bold text-sm">Cambiar Logotipo</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload size={24} className="text-violet-500 mb-2" />
                        <p className="font-bold text-sm text-center">Sube tu logo corporativo</p>
                        <p className="text-xs opacity-40 mt-1 text-center">Alta resolución recomendada (PNG/JPG)</p>
                      </>
                    )}
                  </label>
                  {pdfLogo && (
                    <button onClick={() => setPdfLogo(null)} className="text-xs text-rose-500 font-bold hover:underline">
                      Remover logotipo
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold flex items-center gap-2"><FileCode size={18} className="text-violet-500" /> Fuente de Datos (XML)</h3>
                  <div 
                    {...getRootProps()} 
                    className="w-full aspect-[21/9] rounded-[1.5rem] border-2 border-dashed border-[var(--border)] bg-[var(--bg)] flex flex-col items-center justify-center p-4 cursor-pointer hover:border-violet-500/50 transition-colors"
                  >
                    <input {...getInputProps()} />
                    <FileCode size={24} className="text-violet-500 mb-2" />
                    <p className="font-bold text-sm text-center">Arrastra tus XMLs aquí</p>
                    <p className="text-xs opacity-40 mt-1 text-center">{files.length > 0 ? `${files.length} comprobantes listos` : 'Múltiples archivos soportados'}</p>
                  </div>
                </div>
              </div>

              {files.length > 0 && (
                <button 
                  onClick={generatePDFs} 
                  disabled={processing}
                  className="w-full py-5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-[1.5rem] font-bold shadow-xl shadow-violet-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? <RefreshCw size={20} className="animate-spin" /> : <Printer size={20} />}
                  {processing ? "Renderizando Documentos Premium..." : `Generar ${files.length} Documentos Corporativos`}
                </button>
              )}
            </div>
          ) : activeTab === 'concil' ? (
            <div className="lg:col-span-3 p-6 lg:p-10 rounded-[2.5rem] bg-[var(--card)] border border-[var(--border)]">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-3xl font-display font-bold mb-2">Conciliación Inteligente</h2>
                  <p className="text-sm opacity-40 max-w-md">Sube tu estado de cuenta en Excel y los XMLs para detectar faltantes.</p>
                </div>
                <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                   <Scale size={32} />
                </div>
              </div>

              {/* Excel Instructions */}
              <div className="mb-10 p-6 rounded-2xl bg-blue-500/5 border border-blue-500/20 text-blue-600 dark:text-blue-400">
                <h4 className="font-bold flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs text-blue-600 dark:text-blue-400">i</span>
                  Instrucciones Estrictas para tu Excel (.xlsx)
                </h4>
                <ul className="text-sm space-y-2 opacity-80 pl-8 list-disc">
                  <li><strong>Primera hoja:</strong> La información debe estar alojada exclusivamente en la primera pestaña (Hoja 1) del libro.</li>
                  <li><strong>Formato Numérico:</strong> Los importes de las transacciones (Depositos, Giros, Cargos o Abonos) deben estar formateados en Excel estrictamente como `Número` o `Moneda`. Si los números están mezclados con letras o formato de texto plano (ej. "$ 1,500 MXN") cruzará incorrectamente.</li>
                  <li><strong>Encabezados Libres:</strong> No requieres nombrar las columnas de una forma en particular, los algoritmos buscarán coincidencias matemáticas con los "Totales" de los XMLs en todas las casillas numéricas de las filas.</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-4">
                  <h3 className="font-bold flex items-center gap-2"><FileCode size={18} className="text-blue-500" /> Archivo Bancario (Excel)</h3>
                  <label className="block w-full aspect-[21/9] rounded-[1.5rem] border-2 border-dashed border-[var(--border)] bg-[var(--bg)] flex flex-col items-center justify-center p-4 cursor-pointer hover:border-blue-500/50 transition-colors">
                    <input type="file" accept=".xlsx, .xls" className="hidden" onChange={(e) => setBankFile(e.target.files?.[0] || null)} />
                    <FileCode size={24} className="text-blue-500 mb-2" />
                    <p className="font-bold text-sm text-center">{bankFile ? bankFile.name : 'Sube tu estado de cuenta'}</p>
                  </label>
                </div>
                <div className="space-y-4">
                  <h3 className="font-bold flex items-center gap-2"><FileCode size={18} className="text-blue-500" /> XMLs del Mes</h3>
                  <div {...getRootProps()} className="w-full aspect-[21/9] rounded-[1.5rem] border-2 border-dashed border-[var(--border)] bg-[var(--bg)] flex flex-col items-center justify-center p-4 cursor-pointer hover:border-blue-500/50 transition-colors">
                    <input {...getInputProps()} />
                    <FileCode size={24} className="text-blue-500 mb-2" />
                    <p className="font-bold text-sm text-center">Arrastra tus XMLs aquí</p>
                    <p className="text-xs opacity-40 mt-1 text-center">{files.length > 0 ? `${files.length} comprobantes` : 'Múltiples archivos'}</p>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={runConciliation} disabled={processing || files.length === 0 || !bankFile}
                className="w-full py-5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-[1.5rem] font-bold shadow-xl shadow-blue-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed mb-8"
              >
                {processing ? <RefreshCw size={20} className="animate-spin" /> : <Scale size={20} />}
                Conciliar Documentos
              </button>

              {concilResults && (
                <div className="overflow-x-auto">
                   <table className="w-full text-left border-collapse">
                     <thead>
                       <tr className="border-b border-[var(--border)]">
                         <th className="py-3 px-4 font-bold text-sm">Archivo</th>
                         <th className="py-3 px-4 font-bold text-sm">Total XML</th>
                         <th className="py-3 px-4 font-bold text-sm">Status</th>
                       </tr>
                     </thead>
                     <tbody>
                       {concilResults.map((r: any, i: number) => (
                         <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--bg)]">
                           <td className="py-3 px-4 text-xs">{r.file}</td>
                           <td className="py-3 px-4 text-sm font-bold">${r.total.toFixed(2)}</td>
                           <td className="py-3 px-4 text-sm">
                             <span className={`px-2 py-1 rounded text-xs font-bold ${r.status === 'Conciliado' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                               {r.status}
                             </span>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                </div>
              )}
            </div>
          ) : activeTab === 'analytics' ? (
            <div className="lg:col-span-3 p-6 lg:p-10 rounded-[2.5rem] bg-[var(--card)] border border-[var(--border)]">
              <div className="flex justify-between items-center mb-12">
                <div>
                  <h2 className="text-3xl font-display font-bold mb-2">Dashboard Financiero</h2>
                  <p className="text-sm opacity-40 max-w-md">Visualiza ingresos, egresos, impuestos y Top 10 de tus CFDIs masivamente.</p>
                </div>
                <div className="w-16 h-16 rounded-3xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                   <BarChart3 size={32} />
                </div>
              </div>
              <div className="space-y-4 mb-8">
                <div {...getRootProps()} className="w-full aspect-[21/9] lg:aspect-[21/5] rounded-[1.5rem] border-2 border-dashed border-[var(--border)] bg-[var(--bg)] flex flex-col items-center justify-center p-4 cursor-pointer hover:border-amber-500/50 transition-colors">
                  <input {...getInputProps()} />
                  <FileCode size={24} className="text-amber-500 mb-2" />
                  <p className="font-bold text-sm text-center">Arrastra cientos de XMLs aquí</p>
                  <p className="text-xs opacity-40 mt-1 text-center">{files.length > 0 ? `${files.length} cargados` : 'Analiza masivamente'}</p>
                </div>
                <button 
                  onClick={runAnalytics} disabled={processing || files.length === 0}
                  className="w-full py-5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-[1.5rem] font-bold shadow-xl shadow-amber-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? <RefreshCw size={20} className="animate-spin" /> : <BarChart3 size={20} />}
                  Generar Gráficas y Cálculos
                </button>
              </div>

              {analyticsData && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 rounded-2xl bg-[var(--bg)] border border-[var(--border)]">
                      <p className="text-xs opacity-60 font-bold uppercase tracking-widest mb-1">Subtotal (Balance Neto)</p>
                      <p className="text-3xl font-display font-bold text-emerald-500">${analyticsData.subtotal.toFixed(2)}</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-[var(--bg)] border border-[var(--border)]">
                      <p className="text-xs opacity-60 font-bold uppercase tracking-widest mb-1">IVA Trasladado</p>
                      <p className="text-3xl font-display font-bold text-amber-500">${analyticsData.ivaTrasladado.toFixed(2)}</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-[var(--bg)] border border-[var(--border)]">
                      <p className="text-xs opacity-60 font-bold uppercase tracking-widest mb-1">IVA Retenido</p>
                      <p className="text-3xl font-display font-bold text-rose-500">${analyticsData.ivaRetenido.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="h-80 w-full bg-[var(--bg)] border border-[var(--border)] rounded-2xl p-6">
                    <h3 className="font-bold mb-4">Top 10 Entidades Comerciales</h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData.topEntities} layout="vertical" margin={{ left: 20, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} horizontal={false} />
                        <XAxis type="number" tickFormatter={(v) => `$${v}`} tick={{fill: 'currentColor', fontSize: 10, opacity: 0.5}} />
                        <YAxis type="category" dataKey="name" tick={{fill: 'currentColor', fontSize: 10}} width={120} />
                        <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px'}} itemStyle={{color: 'var(--brand)'}} />
                        <Bar dataKey="value" fill="currentColor" className="text-amber-500" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'organizer' ? (
            <div className="lg:col-span-3 p-6 lg:p-10 rounded-[2.5rem] bg-[var(--card)] border border-[var(--border)]">
              <div className="flex justify-between items-center mb-12">
                <div>
                  <h2 className="text-3xl font-display font-bold mb-2">Auto-Filing (Organizador)</h2>
                  <p className="text-sm opacity-40 max-w-md">Ordena miles de XMLs en carpetas por Año/Mes/Tipo y renómbralos masivamente.</p>
                </div>
                <div className="w-16 h-16 rounded-3xl bg-pink-500/10 flex items-center justify-center text-pink-500">
                   <FolderTree size={32} />
                </div>
              </div>

              <div className="mb-8 space-y-4">
                <h3 className="font-bold text-sm">Formato de Renombre Guardado</h3>
                <div className="flex flex-wrap gap-4">
                  <label className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-colors ${organizerFormat === 'rfc_date' ? 'border-pink-500 bg-pink-500/10' : 'border-[var(--border)]'}`}>
                    <input type="radio" value="rfc_date" checked={organizerFormat === 'rfc_date'} onChange={(e) => setOrganizerFormat(e.target.value)} className="hidden" />
                    <span className="text-sm font-bold text-pink-500">RFC_Fecha.xml</span>
                  </label>
                  <label className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-colors ${organizerFormat === 'uuid' ? 'border-pink-500 bg-pink-500/10' : 'border-[var(--border)]'}`}>
                    <input type="radio" value="uuid" checked={organizerFormat === 'uuid'} onChange={(e) => setOrganizerFormat(e.target.value)} className="hidden" />
                    <span className="text-sm font-bold text-pink-500">UUID.xml</span>
                  </label>
                  <label className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-colors ${organizerFormat === 'uuid_date' ? 'border-pink-500 bg-pink-500/10' : 'border-[var(--border)]'}`}>
                    <input type="radio" value="uuid_date" checked={organizerFormat === 'uuid_date'} onChange={(e) => setOrganizerFormat(e.target.value)} className="hidden" />
                    <span className="text-sm font-bold text-pink-500">UUID_Fecha.xml</span>
                  </label>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div {...getRootProps()} className="w-full aspect-[21/9] lg:aspect-[21/5] rounded-[1.5rem] border-2 border-dashed border-[var(--border)] bg-[var(--bg)] flex flex-col items-center justify-center p-4 cursor-pointer hover:border-pink-500/50 transition-colors">
                  <input {...getInputProps()} />
                  <FileCode size={24} className="text-pink-500 mb-2" />
                  <p className="font-bold text-sm text-center">Arrastra tus XMLs desordenados aquí</p>
                  <p className="text-xs opacity-40 mt-1 text-center">{files.length > 0 ? `${files.length} cargados` : 'Recibe un ZIP perfecto'}</p>
                </div>
                {files.length > 0 && (
                  <button 
                    onClick={runAutoFiling} disabled={processing}
                    className="w-full py-5 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-[1.5rem] font-bold shadow-xl shadow-pink-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing ? <RefreshCw size={20} className="animate-spin" /> : <FolderTree size={20} />}
                    Organizar y Empaquetar
                  </button>
                )}
              </div>
            </div>
          ) : activeTab === 'guide' ? (
            <div className="lg:col-span-3 space-y-8">
              <div className="p-8 lg:p-12 rounded-[2.5rem] bg-gradient-to-br from-brand to-brand/80 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                <div className="relative z-10 w-full max-w-3xl">
                  <h2 className="text-4xl lg:text-5xl font-display font-bold mb-4 tracking-tight">¿Para qué sirve XMLs PRO?</h2>
                  <p className="text-lg opacity-90 leading-relaxed mb-8">
                    XMLs PRO es mucho más que un limpiador de archivos. Es una suite completa de auditoría, reparación e inteligencia para comprobantes fiscales digitales (CFDI), diseñada para equipos contables y administrativos de alto nivel.
                  </p>
                  <div className="flex gap-4">
                    <button onClick={() => setActiveTab('billing')} className="px-6 py-3 bg-white text-brand font-bold rounded-2xl hover:scale-[1.02] transition-transform">
                      Ver Planes
                    </button>
                    {plan === 'Free Starter' && (
                      <button onClick={() => handleUpgrade()} className="px-6 py-3 bg-white/20 text-white font-bold rounded-2xl hover:bg-white/30 transition-colors">
                        Mejorar a Pro
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Plan Starter */}
                <div className="p-8 rounded-[2.5rem] bg-[var(--card)] border border-[var(--border)] relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <CheckCircle2 size={120} />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Free Starter</h3>
                  <p className="text-sm opacity-60 mb-8">Ideal para validaciones ocasionales y uso básico.</p>
                  
                  <ul className="space-y-6">
                    <li className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                        <Zap size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold mb-1">Auditoría y Limpieza (Core)</h4>
                        <p className="text-xs opacity-60 leading-relaxed">Repara la estructura, valida cálculos de impuestos y corrige nodos de tus XML. Limitado a 5 archivos por lote.</p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                        <Download size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold mb-1">Descarga Ordenada en ZIP</h4>
                        <p className="text-xs opacity-60 leading-relaxed">Tus XML verificados se comprimen automáticamente en un paquete limpio y listo para ser almacenado.</p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                        <History size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold mb-1">Historial Básico</h4>
                        <p className="text-xs opacity-60 leading-relaxed">Registro de los comprobantes que has procesado y validado en la plataforma a lo largo del tiempo.</p>
                      </div>
                    </li>
                  </ul>
                </div>

                {/* Plan Pro Unlimited */}
                <div className="p-8 rounded-[2.5rem] bg-[var(--card)] border-2 border-brand shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5 text-brand">
                    <Zap size={120} />
                  </div>
                  <div className="absolute top-4 right-4 bg-brand text-white text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full">
                    Recomendado
                  </div>
                  
                  <h3 className="text-2xl font-bold mb-2 text-brand">Pro Unlimited</h3>
                  <p className="text-sm opacity-60 mb-8">El poder absoluto para administrar cientos de CFDI sin límites.</p>
                  
                  <ul className="space-y-6">
                    <li className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
                        <HardDrive size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold mb-1">Cargas Ilimitadas</h4>
                        <p className="text-xs opacity-60 leading-relaxed">Sube grandes volúmenes de comprobantes (1000+) sin restricciones de lote. La capacidad del core aumenta.</p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                        <FileCode size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold mb-1">Extracción Masiva a Excel</h4>
                        <p className="text-xs opacity-60 leading-relaxed">Módulo independiente para transformar carpetas enteras de XMLs en reportes financieros (RFC, Nombres, Conceptos, Desglose de impuestos).</p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                        <Globe size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold mb-1">Estatus Legal SAT (Real-Time)</h4>
                        <p className="text-xs opacity-60 leading-relaxed">Módulo de conexión directa con los servidores del SAT para validar estatus, códigos de respuesta y capacidad de cancelación masiva.</p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0">
                        <Printer size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold mb-1">Representación Impresa PREMIUM</h4>
                        <p className="text-xs opacity-60 leading-relaxed">Transforma lotes de XMLs en facturas PDF corporativas de diseño altamente profesional e incluye tu propio logotipo.</p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                        <Scale size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold mb-1">Conciliación Inteligente</h4>
                        <p className="text-xs opacity-60 leading-relaxed">Sube tu estado de cuenta en Excel y reprocesa todos tus XMLs para detectar automáticamente cuáles faltan por pagar o conciliar (Cuadre contable).</p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                        <BarChart3 size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold mb-1">Dashboard Financiero (Analíticas)</h4>
                        <p className="text-xs opacity-60 leading-relaxed">Arrastra cientos de XMLs y visualiza en segundos un dashboard directivo con desglose de Subtotal, IVA, ISR y Top 10 de clientes/proveedores.</p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-500 flex items-center justify-center shrink-0">
                        <FolderTree size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold mb-1">Auto-Filing (Organizador)</h4>
                        <p className="text-xs opacity-60 leading-relaxed">Deja de lidiar con XMLs desorganizados. Este módulo los agrupa en carpetas por Año/Mes/Tipo y los renombra masivamente (ej. FACTURA_[RFC]_[FECHA].xml).</p>
                      </div>
                    </li>
                  </ul>
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
