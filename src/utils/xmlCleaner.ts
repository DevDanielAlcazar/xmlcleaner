/**
 * XML Cleaning Logic (Frontend Implementation)
 * Optimized for PAC/SAT compliance.
 */

export interface CleanResult {
  originalName: string;
  cleanedContent: string;
  warnings: string[];
  success: boolean;
  error?: string;
  satStatus?: {
    estado: string;
    codigo: string;
    cancelable: string;
  };
}

const XML_DECL_RE = /^\s*<\?xml\b[^?]*\?>/i;

function removeIllegalXMLChars(str: string): string {
  // Filters characters that are illegal in XML 1.0
  return str.replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u10000-\u10FFFF]/g, "");
}

function stripBeforeFirstAngle(text: string): { text: string; stripped: boolean } {
  const idx = text.indexOf("<");
  if (idx > 0) {
    return { text: text.substring(idx), stripped: true };
  }
  return { text, stripped: false };
}

function rebuildXMLDeclaration(text: string): string {
  const standard = '<?xml version="1.0" encoding="UTF-8"?>\n';
  const match = text.match(XML_DECL_RE);
  if (match) {
    return standard + text.substring(match[0].length).trimStart();
  }
  return standard + text.trimStart();
}

function validateStructure(text: string, warnings: string[]): void {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");
    
    // Check for parser errors
    const parseError = xmlDoc.getElementsByTagNameNS("*", "parsererror");
    if (parseError.length > 0 || xmlDoc.documentElement.nodeName === "parsererror") {
      const errorMsg = parseError[0]?.textContent || xmlDoc.documentElement.textContent || "Error desconocido";
      warnings.push(`Error estructural crítico: El XML está mal formado o truncado. Detalle: ${errorMsg.substring(0, 50)}...`);
      return; // Stop further validation if it can't be parsed
    }

      const root = xmlDoc.documentElement;
      
      // Namespace validation
      if (root.namespaceURI !== "http://www.sat.gob.mx/cfd/4") {
        warnings.push("Error: Namespace CFDI incorrecto o versión antigua detectada.");
      }

      // Basic CFDI validation if applicable
      if (root.nodeName.includes("Comprobante")) {
        const version = root.getAttribute("Version");
        if (version !== "4.0") {
          warnings.push(`Alerta: Versión de CFDI detectada: ${version || 'Desconocida'}. El estándar actual es 4.0.`);
        }

        // Date format validation (YYYY-MM-DDThh:mm:ss)
        const fecha = root.getAttribute("Fecha");
        if (fecha) {
          if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(fecha)) {
            warnings.push(`Error: Formato de Fecha inválido: ${fecha}. Debe ser AAAA-MM-DDThh:mm:ss`);
          } else {
            const dateObj = new Date(fecha);
            if (dateObj > new Date()) {
              warnings.push(`Error: La Fecha del comprobante (${fecha}) es futura.`);
            }
          }
        }
        
        const lugarExp = root.getAttribute("LugarExpedicion");
        if (lugarExp && !/^\d{5}$/.test(lugarExp)) {
          warnings.push(`Error: LugarExpedicion inválido (${lugarExp}). Debe ser un código postal de 5 dígitos.`);
        }

        // Totals and Tax validation
        const subtotal = parseFloat(root.getAttribute("SubTotal") || "0");
        const total = parseFloat(root.getAttribute("Total") || "0");
        const descuento = parseFloat(root.getAttribute("Descuento") || "0");
        
        const checkDecimals = (val: string | null, name: string) => {
          if (val && val.includes('.')) {
            const decimals = val.split('.')[1];
            if (decimals.length > 6) {
              warnings.push(`Error: El valor de ${name} (${val}) excede la precisión decimal permitida (máximo 6).`);
            }
          }
        };
        checkDecimals(root.getAttribute("SubTotal"), "SubTotal");
        checkDecimals(root.getAttribute("Total"), "Total");
        
        const tipoDeComprobante = root.getAttribute("TipoDeComprobante");
        if (tipoDeComprobante === "P") {
          const pagos = xmlDoc.getElementsByTagNameNS("*", "Pago");
          if (pagos.length === 0) {
            warnings.push(`Error: Comprobante de tipo Pago (P) debe contener el complemento de Recepción de Pagos.`);
          } else {
            const totalesNode = xmlDoc.getElementsByTagNameNS("*", "Totales")[0];
            const montoTotalPagos = parseFloat(totalesNode?.getAttribute("MontoTotalPagos") || "0");
            
            let sumMontos = 0;
            for (let i = 0; i < pagos.length; i++) {
              const monto = parseFloat(pagos[i].getAttribute("Monto") || "0");
              sumMontos += monto;
              
              const doctosRelacionados = pagos[i].getElementsByTagNameNS("*", "DoctoRelacionado");
              let sumImpPagado = 0;
              for (let j = 0; j < doctosRelacionados.length; j++) {
                sumImpPagado += parseFloat(doctosRelacionados[j].getAttribute("ImpPagado") || "0");
              }
              
              if (doctosRelacionados.length > 0 && Math.abs(sumImpPagado - monto) > 0.1) {
                warnings.push(`Error de Cálculo: En el Pago ${i+1}, la suma de ImpPagado (${sumImpPagado.toFixed(2)}) no coincide con el Monto del pago (${monto.toFixed(2)}).`);
              }
            }
            
            if (totalesNode && Math.abs(sumMontos - montoTotalPagos) > 0.1) {
              warnings.push(`Error de Cálculo: La suma de los Montos de los pagos (${sumMontos.toFixed(2)}) no coincide con MontoTotalPagos (${montoTotalPagos.toFixed(2)}).`);
            }
          }
          if (subtotal !== 0 || total !== 0) {
            warnings.push(`Error: En comprobantes de tipo Pago (P), SubTotal y Total deben ser 0.`);
          }
        }

        const metodoPago = root.getAttribute("MetodoPago");
        const formaPago = root.getAttribute("FormaPago");
        if (metodoPago === "PPD" && formaPago !== "99") {
          warnings.push(`Error: Si MetodoPago es PPD, FormaPago debe ser 99 (Por definir).`);
        }
        if (metodoPago === "PUE" && formaPago === "99") {
          warnings.push(`Error: Si MetodoPago es PUE, FormaPago no puede ser 99.`);
        }

        // Line item validation
        const conceptos = xmlDoc.getElementsByTagNameNS("*", "Concepto");
        let calculatedSubtotal = 0;
        for (let i = 0; i < conceptos.length; i++) {
          const concepto = conceptos[i];
          const importe = parseFloat(concepto.getAttribute("Importe") || "0");
          calculatedSubtotal += importe;
          
          checkDecimals(concepto.getAttribute("Importe"), "Importe de Concepto");
          checkDecimals(concepto.getAttribute("ValorUnitario"), "ValorUnitario de Concepto");

          const objetoImp = concepto.getAttribute("ObjetoImp");
          const trasladosConcepto = concepto.getElementsByTagNameNS("*", "Traslado");
          if (objetoImp === "01" && trasladosConcepto.length > 0) {
            warnings.push(`Error: Concepto con ObjetoImp="01" (No objeto de impuesto) no debe contener nodos de Traslado.`);
          }
        }

        if (Math.abs(calculatedSubtotal - subtotal) > 0.1) {
          warnings.push(`Error de Cálculo: La suma de conceptos ($${calculatedSubtotal.toFixed(2)}) no coincide con el SubTotal ($${subtotal.toFixed(2)}).`);
        }

        // Tax validation
        const impuestosNode = xmlDoc.getElementsByTagNameNS("*", "Impuestos");
        let totalTraslados = 0;
        let totalRetenciones = 0;

        // Usually the last Impuestos node at root level is the summary
        const rootImpuestos = Array.from(impuestosNode).find(node => node.parentNode === root);
        if (rootImpuestos) {
          totalTraslados = parseFloat(rootImpuestos.getAttribute("TotalImpuestosTrasladados") || "0");
          totalRetenciones = parseFloat(rootImpuestos.getAttribute("TotalImpuestosRetenidos") || "0");
        }

        const expectedTotal = subtotal - descuento + totalTraslados - totalRetenciones;
        if (Math.abs(expectedTotal - total) > 0.1 && tipoDeComprobante !== "P" && tipoDeComprobante !== "T") {
          warnings.push(`Error de Cálculo: El Total ($${total.toFixed(2)}) no coincide con la suma de Subtotal, Descuento e Impuestos ($${expectedTotal.toFixed(2)}).`);
        }

        // Check for common tax rates and calculations
        const traslados = xmlDoc.getElementsByTagNameNS("*", "Traslado");
        for (let i = 0; i < traslados.length; i++) {
          const tasaOCuota = traslados[i].getAttribute("TasaOCuota");
          const baseStr = traslados[i].getAttribute("Base");
          const importeStr = traslados[i].getAttribute("Importe");
          
          if (tasaOCuota) {
            if (!["0.160000", "0.080000", "0.000000"].includes(tasaOCuota)) {
              warnings.push(`Alerta: Impuestos: Tasa de traslado inusual detectada: ${tasaOCuota}. Verifique si es correcta.`);
            }
            
            if (baseStr && importeStr) {
              const base = parseFloat(baseStr);
              const importe = parseFloat(importeStr);
              const tasa = parseFloat(tasaOCuota);
              
              if (Math.abs(base * tasa - importe) > 0.1) {
                warnings.push(`Error de Cálculo: Traslado con Base ${base} y Tasa ${tasaOCuota} tiene un Importe incorrecto (${importe}). Debería ser aprox ${(base * tasa).toFixed(2)}.`);
              }
            }
          }
        }

        const rfcEmisor = xmlDoc.getElementsByTagNameNS("*", "Emisor")[0]?.getAttribute("Rfc");
        if (rfcEmisor && !/^[A-Z&Ñ]{3,4}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{2}[0-9A]$/.test(rfcEmisor)) {
          warnings.push(`Error: RFC del Emisor parece tener un formato inválido: ${rfcEmisor}`);
        }
        
        const rfcReceptor = xmlDoc.getElementsByTagNameNS("*", "Receptor")[0]?.getAttribute("Rfc");
        if (rfcReceptor && !/^[A-Z&Ñ]{3,4}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{2}[0-9A]$/.test(rfcReceptor) && rfcReceptor !== "XAXX010101000" && rfcReceptor !== "XEXX010101000") {
          warnings.push(`Error: RFC del Receptor parece tener un formato inválido: ${rfcReceptor}`);
        }

      const requiredAttrs = ["Version", "Fecha", "Sello", "NoCertificado", "Certificado", "SubTotal", "Moneda", "Total", "TipoDeComprobante", "Exportacion", "LugarExpedicion"];
      requiredAttrs.forEach(attr => {
        if (!root.getAttribute(attr)) {
          warnings.push(`Error: Atributo CFDI obligatorio faltante o vacío: ${attr}`);
        }
      });

      // Sello validation (length check)
      const sello = root.getAttribute("Sello");
      if (sello && sello.length < 100) {
        warnings.push("Error: El Sello fiscal parece estar truncado o es demasiado corto.");
      }

      const requiredNodes = ["Emisor", "Receptor", "Conceptos"];
      requiredNodes.forEach(node => {
        const elements = xmlDoc.getElementsByTagNameNS("*", node);
        const elementsNoNS = xmlDoc.getElementsByTagName(node);
        if (elements.length === 0 && elementsNoNS.length === 0) {
          warnings.push(`Error: Nodo CFDI obligatorio faltante: ${node}`);
        } else {
          const el = elements[0] || elementsNoNS[0];
          if (node === "Emisor") {
            if (!el.getAttribute("RegimenFiscal")) warnings.push("Error: Emisor: Falta atributo 'RegimenFiscal' o está vacío (Requerido en 4.0)");
            if (!el.getAttribute("Nombre")) warnings.push("Error: Emisor: Falta atributo 'Nombre' o está vacío (Requerido en 4.0)");
            const rfc = el.getAttribute("Rfc");
            if (rfc === "XAXX010101000" || rfc === "XEXX010101000") {
              warnings.push("Alerta: Emisor: Se está usando un RFC genérico.");
            }
          }
          if (node === "Receptor") {
            if (!el.getAttribute("UsoCFDI")) warnings.push("Error: Receptor: Falta atributo 'UsoCFDI' o está vacío (Requerido en 4.0)");
            if (!el.getAttribute("RegimenFiscalReceptor")) warnings.push("Error: Receptor: Falta atributo 'RegimenFiscalReceptor' o está vacío (Requerido en 4.0)");
            if (!el.getAttribute("DomicilioFiscalReceptor")) warnings.push("Error: Receptor: Falta atributo 'DomicilioFiscalReceptor' o está vacío (Requerido en 4.0)");
            if (!el.getAttribute("Nombre")) warnings.push("Error: Receptor: Falta atributo 'Nombre' o está vacío (Requerido en 4.0)");
          }
        }
      });

      // Check for TimbreFiscalDigital
      const tfd = xmlDoc.getElementsByTagNameNS("*", "TimbreFiscalDigital")[0];
      if (!tfd) {
        warnings.push("Alerta: No se encontró el nodo TimbreFiscalDigital. El XML podría no estar timbrado.");
      } else {
        if (!tfd.hasAttribute("UUID")) warnings.push("Error: TimbreFiscalDigital: Falta el folio fiscal (UUID).");
      }
    }
  } catch (err) {
    warnings.push("Error: No se pudo realizar la validación estructural avanzada.");
  }
}

export async function cleanXML(file: File): Promise<CleanResult> {
  const warnings: string[] = [];
  try {
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder("utf-8");
    let content = decoder.decode(buffer);

    // 1. Handle BOM
    if (content.charCodeAt(0) === 0xfeff) {
      warnings.push("BOM UTF-8 removido.");
      content = content.substring(1);
    }

    // 2. Strip garbage before first '<'
    const { text: strippedText, stripped } = stripBeforeFirstAngle(content);
    content = strippedText;
    if (stripped) warnings.push("Basura removida antes del primer '<'.");

    // 3. Remove illegal characters (Full Mode)
    const cleanedChars = removeIllegalXMLChars(content);
    if (cleanedChars.length !== content.length) {
      warnings.push("Caracteres ilegales de XML 1.0 removidos.");
    }
    content = cleanedChars;

    // 4. Rebuild Declaration
    content = rebuildXMLDeclaration(content);
    warnings.push("Declaración XML normalizada a UTF-8.");

    // 4.5 Check for unescaped ampersands (common error)
    if (/&(?!(amp|lt|gt|quot|apos|#\d+|#x[a-f\d]+);)/i.test(content)) {
      warnings.push("Alerta: Se detectaron símbolos '&' no escapados. Esto romperá la validación del SAT.");
    }

    // 5. Structural Validation (New)
    validateStructure(content, warnings);

    return {
      originalName: file.name,
      cleanedContent: content,
      warnings,
      success: true,
    };
  } catch (err) {
    return {
      originalName: file.name,
      cleanedContent: "",
      warnings,
      success: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}
