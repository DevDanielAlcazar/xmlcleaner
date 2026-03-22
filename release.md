# Release Notes - XML Cleaner Web SaaS

## Estado Actual: v1.2.0 (Reliability & Advanced Validation)

### Realizado:
- **Fiabilidad de Webhooks de Stripe**: Se corrigió el procesamiento del *raw body* para la verificación de firmas, eliminando errores de integración y asegurando actualizaciones automáticas de créditos y planes.
- **Motor de Validación CFDI 4.0 Avanzado**: Implementación de 14+ reglas de negocio críticas (Cálculo de impuestos, precisión decimal, coherencia PPD/PUE, validación de complementos de pago, RFCs, fechas futuras y códigos postales).
- **Sincronización Automática de Suscripciones**: Los créditos (10,000) y el plan 'Pro Unlimited' se activan instantáneamente al detectar el pago en Stripe, sin intervención manual.
- **Panel de Administración Extendido**: Visualización en tiempo real de usuarios activos, sus emails, planes, créditos y `stripe_customer_id`.
- **Manejo de Errores Robusto**: Sistema de logs detallado para webhooks y procesos de limpieza, facilitando el diagnóstico técnico.
- **IDs de Producción Actualizados**: Configuración de Price IDs reales para planes Mensuales ($29) y Anuales ($290).
- **Flujo de Conversión Optimizado**: El botón "Probar gratis" ahora obliga al registro de usuario, asegurando la captura de leads.
- **UI de Facturación Mejorada**: Nueva interfaz de selección de planes con comparativa de beneficios y ahorro.

### Estado del Proyecto:
- **Stripe Infalible**: Webhooks configurados con secreto de respaldo y lógica de reintento/actualización automática.
- **Validación de Grado SAT**: Capacidad para detectar inconsistencias matemáticas y de negocio que otros validadores ignoran.
- **Base de Datos**: Migración estable y funcional con soporte para historial de procesos.
- **Funcionalidad**: 100% operativa con feedback visual mejorado y categorización de errores (Error vs Alerta).

### v1.3.0 (En Desarrollo / Desplegado)
- **Módulo de Extracción Masiva (Excel)**: Exportación de datos clave de XML a reportes profesionales `.xlsx`.
- **Módulo de Validación Estatus SAT**: Consulta en tiempo real del estado (Vigente/Cancelado) directamente desde el webservice del SAT "a pulmón".
- **Control de Módulos desde Admin**: Activación/desactivación granular de nuevas funcionalidades.
- **Límites de Plan Free Starter**: Restricción de procesamiento a un máximo de 5 archivos por lote para usuarios gratuitos.
- **Sincronización Pro Unlimited**: Capacidad de procesamiento masivo sin restricciones para suscriptores.

### Sugerencias de Próximos Módulos (v1.4.0):
1. **Módulo de Visualización (PDF Preview)**: Generación de una representación amigable (tipo factura) del XML para revisión rápida sin abrir el código.
2. **Módulo de Auditoría EFOS/EDOS**: Cruce automático de RFCs del emisor contra las listas negras del SAT (Empresas que Facturan Operaciones Simuladas).
3. **Módulo de Auditoría de Nómina**: Validación específica para complementos de nómina, detectando errores en retenciones de ISR y cuotas IMSS.

---
*Desarrollado con enfoque en cumplimiento fiscal y automatización de procesos contables.*
