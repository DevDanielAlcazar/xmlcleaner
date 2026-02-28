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
    const parseError = xmlDoc.getElementsByTagName("parsererror");
    if (parseError.length > 0) {
      throw new Error("Error de parseo estructural.");
    }

    const root = xmlDoc.documentElement;
    
    // Basic CFDI validation if applicable
    if (root.nodeName.includes("Comprobante")) {
      const version = root.getAttribute("Version");
      if (version !== "4.0") {
        warnings.push(`Versión de CFDI detectada: ${version || 'Desconocida'}. El estándar actual es 4.0.`);
      }

      const rfcEmisor = xmlDoc.getElementsByTagNameNS("*", "Emisor")[0]?.getAttribute("Rfc");
      if (rfcEmisor && !/^[A-Z&Ñ]{3,4}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{2}[0-9A]$/.test(rfcEmisor)) {
        warnings.push(`RFC del Emisor parece tener un formato inválido: ${rfcEmisor}`);
      }

      const requiredAttrs = ["Version", "Fecha", "Sello", "NoCertificado", "Certificado", "SubTotal", "Moneda", "Total", "TipoDeComprobante", "LugarExpedicion"];
      requiredAttrs.forEach(attr => {
        if (!root.hasAttribute(attr)) {
          warnings.push(`Atributo CFDI obligatorio faltante: ${attr}`);
        }
      });

      const requiredNodes = ["Emisor", "Receptor", "Conceptos"];
      requiredNodes.forEach(node => {
        const elements = xmlDoc.getElementsByTagNameNS("*", node);
        const elementsNoNS = xmlDoc.getElementsByTagName(node);
        if (elements.length === 0 && elementsNoNS.length === 0) {
          warnings.push(`Nodo CFDI obligatorio faltante: ${node}`);
        } else {
          const el = elements[0] || elementsNoNS[0];
          if (node === "Emisor") {
            if (!el.hasAttribute("RegimenFiscal")) warnings.push("Emisor: Falta atributo 'RegimenFiscal' (Requerido en 4.0)");
            if (!el.hasAttribute("Nombre")) warnings.push("Emisor: Falta atributo 'Nombre' (Requerido en 4.0)");
          }
          if (node === "Receptor") {
            if (!el.hasAttribute("UsoCFDI")) warnings.push("Receptor: Falta atributo 'UsoCFDI' (Requerido en 4.0)");
            if (!el.hasAttribute("RegimenFiscalReceptor")) warnings.push("Receptor: Falta atributo 'RegimenFiscalReceptor' (Requerido en 4.0)");
            if (!el.hasAttribute("DomicilioFiscalReceptor")) warnings.push("Receptor: Falta atributo 'DomicilioFiscalReceptor' (Requerido en 4.0)");
          }
        }
      });
    }
  } catch (err) {
    warnings.push("No se pudo realizar la validación estructural avanzada.");
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
