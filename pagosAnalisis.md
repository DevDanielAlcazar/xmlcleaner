# Análisis de Integración de Pagos (Stripe)

Este documento detalla el análisis del fallo reportado el 4 de marzo de 2026 y el plan de acción para asegurar que el sistema de suscripciones sea 100% confiable.

## 🔍 Diagnóstico del Problema

Basado en los logs y capturas de pantalla proporcionadas:

1.  **Causa Raíz Probable (Condición de Carrera):** Stripe dispara múltiples eventos casi simultáneamente (`checkout.session.completed`, `customer.subscription.created`, `invoice.paid`). 
    *   Si el evento de suscripción llega al servidor **milisegundos antes** de que el evento de sesión termine de guardar el `stripe_customer_id` en nuestra base de datos, el sistema no encuentra a quién asignar los créditos.
2.  **Falta de Webhook Activo:** Las capturas muestran la pantalla de "Añade un destino" en Stripe. Esto sugiere que **el webhook no está configurado en el dashboard de Stripe**, por lo que el servidor nunca recibe las notificaciones de pago.
3.  **Renovaciones:** El código actual no manejaba explícitamente el evento `invoice.paid`, que es el evento maestro para confirmar que un pago (ya sea inicial o de renovación) se ha efectuado con éxito.

---

## 🛠️ Plan de Acción (Lo que voy a hacer ahora)

1.  **Robustecer el Servidor:** Actualizaré `server.ts` para:
    *   Manejar `invoice.paid` como fuente principal de verdad para otorgar créditos.
    *   Vincular al usuario por Email si el ID falla (doble seguridad).
    *   Añadir logs detallados para que podamos ver exactamente qué recibe el servidor.
2.  **Soporte de Renovaciones:** Al detectar `invoice.paid`, el sistema reseteará los créditos a 10,000 cada mes/año automáticamente.

---

## 📋 Instrucciones para Ti (Paso a Paso en Stripe)

Para que esto funcione, **necesito que actives el Webhook** siguiendo estos pasos:

1.  **Entra a tu Dashboard de Stripe:** Ve a [Developers > Webhooks](https://dashboard.stripe.com/webhooks).
2.  **Haz clic en "Añadir un destino" (Add endpoint).**
3.  **Configura la URL del punto de conexión:**
    *   URL: `https://xmlclean.consafedev.qzz.io/api/billing/webhook`
4.  **Selecciona los eventos a escuchar (IMPORTANTE):**
    *   `checkout.session.completed`
    *   `invoice.paid`
    *   `customer.subscription.deleted`
    *   `customer.subscription.updated`
5.  **Obtén el "Secreto de firma" (Signing secret):**
    *   Una vez creado, verás un botón que dice "Revelar". Ese código empieza con `whsec_...`.
6.  **Configura la Variable de Entorno:**
    *   Copia ese secreto (`whsec_LVpUFuYMkRWMf2YayF7a3bVc8C2ypOgq`) y ponlo en la variable de entorno `STRIPE_WEBHOOK_SECRET` en tu panel de configuración de la aplicación.

---

## 🛡️ Garantía de Confiabilidad

Con estos cambios y la configuración del webhook:
*   **Pagos Nuevos:** Se detectarán por la sesión y la factura inicial.
*   **Renovaciones:** Cada mes, cuando Stripe cobre la tarjeta, disparará `invoice.paid` y el sistema le devolverá sus 10,000 créditos al usuario sin que tú hagas nada.
*   **Cancelaciones:** Si el pago falla o cancelan, `customer.subscription.deleted` los regresará al plan gratuito al instante.

**Procederé a actualizar el código del servidor ahora mismo.**
