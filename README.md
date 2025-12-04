# Cronjob Seguros Colte - Recordatorios de Pago

Este servicio es un proceso en segundo plano (Cronjob) diseñado para automatizar el seguimiento de pagos pendientes de los clientes de **Seguros Colte**. Su objetivo es enviar recordatorios escalonados vía WhatsApp a aquellos usuarios que han recibido un link de pago pero no han enviado su comprobante, y detener automáticamente los recordatorios si el pago se detecta como exitoso.

## 🚀 Flujo de Trabajo (Producción)

El sistema se ejecuta automáticamente **cada 15 minutos** y realiza las siguientes operaciones en orden:

### 1. Sincronización de Pagos Exitosos (`syncSuccessfulPayments`)
Antes de enviar cualquier mensaje, el sistema verifica si los usuarios ya han pagado para evitar cobros innecesarios.
*   Consulta la tabla `payments_logs` buscando pagos con estado **"Exitosa"** de los últimos 5 días.
*   Cruza estos pagos con los chats pendientes en `chat_history` usando el número de teléfono.
*   Si hay coincidencia, marca el chat como `payment_proof_received = true`, deteniendo así el ciclo de recordatorios.

### 2. Consulta de Candidatos a Recordatorio
Busca en la base de datos Supabase (`chat_history`) a los clientes que cumplan:
*   Se les envió link de pago (`payment_link_sent_at` no es nulo).
*   **NO** han enviado comprobante (`payment_proof_received` es `false`).
*   **NO** han completado el ciclo de recordatorios (`payment_reminder_72h` es `false`).

### 3. Resolución de Identidad y Servicio
Para personalizar el mensaje, el sistema intenta obtener la mejor información disponible:
*   **Nombre:** Busca en la tabla maestra `dentix_clients`. Si no existe, usa el nombre del chat. Si falla, usa "Usuario".
*   **Servicio:** Busca en `dentix_clients`. Si no existe, usa el del chat. Default: "Bienestar".
*   **Link de Pago:** Asigna el ID del link de pago correspondiente al servicio (actualmente por defecto para "Bienestar").

### 4. Ventanas de Tiempo y Envío
Calcula el tiempo transcurrido desde el envío del link original y ejecuta acciones según la ventana. El envío se realiza **directamente usando la API de Twilio (Content API)**.

| Tiempo Transcurrido | Acción | Variable de Entorno (Template SID) | Actualización BD |
| :--- | :--- | :--- | :--- |
| **24 a 47 horas** | Primer Recordatorio | `TWILIO_CONTENT_SID_24H` | `payment_reminder_24h = true` |
| **48 a 71 horas** | Segundo Recordatorio | `TWILIO_CONTENT_SID_48H` | `payment_reminder_48h = true` |
| **72 horas o más** | Último Recordatorio | `TWILIO_CONTENT_SID_72H` | `payment_reminder_72h = true` |

*Nota: El sistema verifica que el recordatorio específico no se haya enviado previamente para evitar duplicados.*

## 🛠️ Stack Tecnológico

*   **Runtime:** Node.js & TypeScript
*   **Base de Datos:** Supabase (PostgreSQL)
*   **Scheduling:** node-schedule
*   **Mensajería:** Twilio SDK (WhatsApp Content API)
*   **Process Manager:** PM2 (para despliegue)

## ⚙️ Configuración y Variables de Entorno

El proyecto requiere un archivo `.env` en la raíz con las siguientes variables:

```env
# Supabase Configuration
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu-service-role-key

# Twilio Configuration
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+5742044840

# Twilio Content SIDs (Templates de WhatsApp)
TWILIO_CONTENT_SID_24H=HX...
TWILIO_CONTENT_SID_48H=HX...
TWILIO_CONTENT_SID_72H=HX...

# Configuración del Entorno
TEST_MODE=false # true para ciclos de minutos, false para horas
CRON_SCHEDULE="*/15 * * * *" # Opcional, por defecto cada 15 min en PROD
```

## 📦 Instalación y Ejecución

1.  **Instalar dependencias:**
    ```bash
    npm install
    ```

2.  **Ejecutar en Desarrollo:**
    ```bash
    npm run dev
    ```

3.  **Compilar para Producción:**
    ```bash
    npm run build
    ```

4.  **Ejecutar en Producción:**
    ```bash
    npm start
    ```

## 🚀 Despliegue (PM2)

El proyecto incluye un archivo `ecosystem.config.cjs` listo para ser gestionado por PM2.

```bash
# Iniciar el servicio
pm2 start ecosystem.config.cjs

# Ver logs
pm2 logs cronjob-seguros-colte

# Monitorear
pm2 monit
```

## 🧪 Modo de Pruebas (Development)

Para facilitar la validación sin esperar días, el sistema incluye un **Modo Test**.

1.  Configurar `TEST_MODE=true` en el archivo `.env`.
2.  El Cronjob se ejecutará **cada minuto**.
3.  La escala de tiempo se acelera: **1 minuto real = 1 hora virtual**.
    *   Recordatorio 24h -> Se envía a los **2 minutos**.
    *   Recordatorio 48h -> Se envía a los **4 minutos**.
    *   Recordatorio 72h -> Se envía a los **6 minutos**.
4.  **IMPORTANTE:** En modo test, los mensajes **SÍ se envían realmente** a los números registrados si el código no tiene el `return` comentado (verificar `checkPaymentReminders.ts`).

## 🗃️ Estructura de Base de Datos Requerida

Tabla: `chat_history`

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | uuid | Identificador único |
| `client_number` | text | Teléfono del cliente |
| `client_name` | text | Nombre del cliente |
| `payment_link_sent_at` | timestamptz | Fecha/Hora envío del link |
| `payment_proof_received` | boolean | Si ya pagó (True detiene el cron) |
| `payment_reminder_24h` | boolean | Flag de envío 24h |
| `payment_reminder_48h` | boolean | Flag de envío 48h |
| `payment_reminder_72h` | boolean | Flag de envío 72h |

Tabla: `payments_logs` (Para sincronización)

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| `payer_phone` | text | Teléfono del pagador |
| `status_name` | text | Estado del pago (debe ser "Exitosa") |
| `created_at` | timestamptz | Fecha del pago |

