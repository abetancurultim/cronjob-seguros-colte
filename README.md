# Cronjob Seguros Colte - Recordatorios de Pago

Este servicio es un proceso en segundo plano (Cronjob) diseñado para automatizar el seguimiento de pagos pendientes de los clientes de **Seguros Colte**. Su objetivo es enviar recordatorios escalonados vía WhatsApp a aquellos usuarios que han recibido un link de pago pero no han enviado su comprobante.

## 🚀 Flujo de Trabajo (Producción)

El sistema se ejecuta automáticamente **cada hora** (en el minuto 0) y realiza las siguientes validaciones:

1.  **Consulta de Candidatos:** Busca en la base de datos Supabase (`chat_history`) a los clientes que cumplan:
    *   Se les envió link de pago (`payment_link_sent_at` no es nulo).
    *   **NO** han enviado comprobante (`payment_proof_received` es `false`).
    *   **NO** han completado el ciclo de recordatorios (`payment_reminder_72h` es `false`).

2.  **Resolución de Identidad:**
    *   Intenta obtener el nombre oficial del cliente cruzando el número de teléfono con la tabla maestra `dentix_clients`.
    *   Si no existe, usa el nombre capturado en el chat.
    *   Si no hay datos, usa "Usuario".

3.  **Ventanas de Tiempo y Envío:**
    Calcula el tiempo transcurrido desde el envío del link y ejecuta acciones según la ventana:

    | Tiempo Transcurrido | Acción | Template ID | Actualización BD |
    | :--- | :--- | :--- | :--- |
    | **24 a 47 horas** | Primer Recordatorio | `TEMPLATE_ID_COLTE_24H` | `payment_reminder_24h = true` |
    | **48 a 71 horas** | Segundo Recordatorio | `TEMPLATE_ID_COLTE_48H` | `payment_reminder_48h = true` |
    | **72 horas o más** | Último Recordatorio | `TEMPLATE_ID_COLTE_72H` | `payment_reminder_72h = true` |

    *Nota: El sistema verifica que el recordatorio específico no se haya enviado previamente para evitar duplicados.*

4.  **Envío de Mensajes:**
    *   Delega el envío del mensaje a través de una petición POST al endpoint externo: `https://ultim.online/seguros-colte/send-template`.

## 🛠️ Stack Tecnológico

*   **Runtime:** Node.js & TypeScript
*   **Base de Datos:** Supabase (PostgreSQL)
*   **Scheduling:** node-schedule
*   **HTTP Client:** Axios
*   **Process Manager:** PM2 (para despliegue)

## ⚙️ Configuración y Variables de Entorno

El proyecto requiere un archivo `.env` en la raíz con las siguientes variables:

```env
# Supabase Configuration
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu-service-role-key

# Configuración del Entorno
# 'true' para activar modo pruebas (minutos en vez de horas), 'false' para producción.
TEST_MODE=false 
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
pm2 logs seguros-colte

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
4.  Los envíos de WhatsApp se simulan (se muestran en consola `[MOCK SEND]`) para no gastar saldo ni molestar a usuarios reales.

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
