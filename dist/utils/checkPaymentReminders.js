"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPaymentReminders = void 0;
const supabase_1 = require("./supabase");
const twilio_1 = __importDefault(require("twilio"));
const dotenv_1 = __importDefault(require("dotenv"));
const checkUserName_1 = require("./checkUserName"); // Importamos la función de cruce
const syncSuccessfulPayments_1 = require("./syncSuccessfulPayments");
dotenv_1.default.config();
const twilioClient = (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const checkPaymentReminders = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`💳 [Seguros Colte] Verificando pagos pendientes... (Modo: ${process.env.TEST_MODE === 'true' ? 'TEST' : 'PROD'})`);
    // Sincronizar pagos exitosos antes de procesar recordatorios
    yield (0, syncSuccessfulPayments_1.syncSuccessfulPayments)();
    const now = new Date();
    const { data: leads, error } = yield supabase_1.supabase
        .from("chat_history")
        .select("*")
        .not("payment_link_sent_at", "is", null)
        .eq("payment_proof_received", false)
        .eq("payment_reminder_72h", false);
    if (error) {
        console.error("Error fetching leads:", error);
        return;
    }
    if (!leads || leads.length === 0) {
        console.log("No hay recordatorios pendientes.");
        return;
    }
    for (const lead of leads) {
        const sentDate = new Date(lead.payment_link_sent_at);
        const timeDiff = now.getTime() - sentDate.getTime();
        const isTestMode = process.env.TEST_MODE === 'true';
        // En TEST_MODE: 1 unidad = 1 minuto. En PROD: 1 unidad = 1 hora.
        const elapsedUnits = isTestMode
            ? timeDiff / (1000 * 60)
            : timeDiff / (1000 * 60 * 60);
        // Umbrales dinámicos
        const T24 = isTestMode ? 2 : 24;
        const T48 = isTestMode ? 4 : 48;
        const T72 = isTestMode ? 6 : 72;
        // --- LÓGICA DE CRUCE DE DATOS ---
        // 1. Intentamos buscar datos oficiales (nombre y servicio) en la tabla dentix_clients
        const clientData = yield (0, checkUserName_1.checkUserName)(lead.client_number);
        // 2. Definir Nombre
        const finalName = (clientData === null || clientData === void 0 ? void 0 : clientData.name) || lead.client_name || "Usuario";
        // 3. Definir Servicio
        // Prioridad: Tabla Maestra > Tabla Chat > Default
        const serviceName = (clientData === null || clientData === void 0 ? void 0 : clientData.service) || lead.service || "Bienestar";
        // 4. Definir Link de Pago según el servicio
        let linkId = "";
        const serviceLower = serviceName.toLowerCase().trim();
        if (serviceLower.includes("bienestar")) {
            linkId = "13aosv";
        }
        else {
            // TODO: Agregar más condicionales para mascotas, soat, etc.
            // Por defecto o si no coincide, podemos dejarlo vacío o poner un link genérico si existe.
            // De momento, si no es bienestar, asumimos bienestar como fallback o dejamos vacío (lo que podría romper el link).
            // Asumiré fallback a bienestar por seguridad en esta fase inicial.
            linkId = "13aosv";
        }
        try {
            // 24 HORAS (o 2 minutos en test)
            if (elapsedUnits >= T24 && elapsedUnits < T48 && !lead.payment_reminder_24h) {
                console.log(`Enviando recordatorio 24H a ${finalName} (${lead.client_number})`);
                yield sendPaymentTemplate(lead.client_number, finalName, serviceName, linkId, 'TEMPLATE_ID_COLTE_24H');
                yield supabase_1.supabase.from("chat_history").update({ payment_reminder_24h: true }).eq("id", lead.id);
            }
            // 48 HORAS (o 4 minutos en test)
            else if (elapsedUnits >= T48 && elapsedUnits < T72 && !lead.payment_reminder_48h) {
                console.log(`Enviando recordatorio 48H a ${finalName} (${lead.client_number})`);
                yield sendPaymentTemplate(lead.client_number, finalName, serviceName, linkId, 'TEMPLATE_ID_COLTE_48H');
                yield supabase_1.supabase.from("chat_history").update({ payment_reminder_48h: true }).eq("id", lead.id);
            }
            // 72 HORAS (o 6 minutos en test)
            else if (elapsedUnits >= T72 && !lead.payment_reminder_72h) {
                console.log(`Enviando recordatorio 72H a ${finalName} (${lead.client_number})`);
                yield sendPaymentTemplate(lead.client_number, finalName, serviceName, linkId, 'TEMPLATE_ID_COLTE_72H');
                yield supabase_1.supabase.from("chat_history").update({ payment_reminder_72h: true }).eq("id", lead.id);
            }
        }
        catch (err) {
            console.error(`Error con lead ${lead.client_number}:`, err);
        }
    }
});
exports.checkPaymentReminders = checkPaymentReminders;
// Función de envío directa con Twilio
const sendPaymentTemplate = (phoneNumber, name, service, linkId, templateId) => __awaiter(void 0, void 0, void 0, function* () {
    if (process.env.TEST_MODE === 'true') {
        console.log(`[TEST MODE] ⚠️ Enviando mensaje REAL a ${name} (${phoneNumber}) - Link: ${linkId}`);
        // return; // <--- COMENTADO: Permitimos que el código continúe y envíe el mensaje real a Twilio
    }
    // Mapeo de IDs internos a Content SIDs de Twilio (HX...)
    // Asegúrate de tener estas variables en tu .env
    const templateMap = {
        'TEMPLATE_ID_COLTE_24H': process.env.TWILIO_CONTENT_SID_24H || 'HX1ecde92daa40f22042e07a02b12786ec',
        'TEMPLATE_ID_COLTE_48H': process.env.TWILIO_CONTENT_SID_48H || 'HX1ecde92daa40f22042e07a02b12786ec',
        'TEMPLATE_ID_COLTE_72H': process.env.TWILIO_CONTENT_SID_72H || 'HX1ecde92daa40f22042e07a02b12786ec',
    };
    const contentSid = templateMap[templateId];
    if (!contentSid) {
        console.error(`Error: No se encontró Content SID configurado para ${templateId}`);
        return;
    }
    // Asegurar formato E.164 para WhatsApp (ej: +57300...)
    let formattedPhone = phoneNumber.replace(/\D/g, ''); // Solo números
    if (!formattedPhone.startsWith('57')) {
        formattedPhone = '57' + formattedPhone; // Asumimos Colombia si no tiene prefijo
    }
    formattedPhone = '+' + formattedPhone;
    // Preparar número de origen (remitente)
    // Se usa la variable de entorno o el número fijo proporcionado: +57 42044840
    let sender = process.env.TWILIO_PHONE_NUMBER || '+5742044840';
    sender = sender.replace(/\s+/g, ''); // Quitar espacios por seguridad
    if (!sender.startsWith('+'))
        sender = '+' + sender;
    try {
        const message = yield twilioClient.messages.create({
            from: `whatsapp:${sender}`,
            to: `whatsapp:${formattedPhone}`,
            contentSid: contentSid,
            contentVariables: JSON.stringify({
                "1": name, // {{1}} Nombre
                "2": service, // {{2}} Nombre de la asistencia
                "3": linkId // {{3}} patch enlace de pago
            })
        });
        console.log(`Template enviado a ${name} (${formattedPhone}). SID: ${message.sid}`);
    }
    catch (error) {
        console.error('Error enviando template con Twilio:', error.message);
    }
});
