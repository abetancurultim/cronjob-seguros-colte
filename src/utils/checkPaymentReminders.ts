import { supabase } from "./supabase";
import axios from "axios";
import dotenv from "dotenv";
import { checkUserName } from "./checkUserName"; // Importamos la función de cruce

dotenv.config();

type PaymentConversation = {
    id: string;
    client_number: string;
    client_name: string;
    service: string;
    payment_link_sent_at: string;
    payment_reminder_24h: boolean;
    payment_reminder_48h: boolean;
    payment_reminder_72h: boolean;
};

export const checkPaymentReminders = async (): Promise<void> => {
    console.log(`💳 [Seguros Colte] Verificando pagos pendientes... (Modo: ${process.env.TEST_MODE === 'true' ? 'TEST' : 'PROD'})`);

    const now = new Date();

    const { data: leads, error } = await supabase
        .from("chat_history_test")
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

    for (const lead of leads as PaymentConversation[]) {
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
        // 1. Intentamos buscar el nombre oficial en la tabla dentix_clients
        const officialName = await checkUserName(lead.client_number);
        
        // 2. Si existe, lo usamos. Si no, usamos el del chat. Si no, "Usuario".
        const finalName = officialName || lead.client_name || "Usuario";
        
        // Asumimos que el link de pago ya lo gestiona el backend o es parte del template
        // Si necesitas enviar el link dinámicamente, deberíamos tenerlo en la BD.
        
        try {
            // 24 HORAS (o 2 minutos en test)
            if (elapsedUnits >= T24 && elapsedUnits < T48 && !lead.payment_reminder_24h) {
                console.log(`Enviando recordatorio 24H a ${finalName} (${lead.client_number})`);
                await sendPaymentTemplate(lead.client_number, finalName, 'TEMPLATE_ID_COLTE_24H');
                await supabase.from("chat_history_test").update({ payment_reminder_24h: true }).eq("id", lead.id);
            }

            // 48 HORAS (o 4 minutos en test)
            else if (elapsedUnits >= T48 && elapsedUnits < T72 && !lead.payment_reminder_48h) {
                console.log(`Enviando recordatorio 48H a ${finalName} (${lead.client_number})`);
                await sendPaymentTemplate(lead.client_number, finalName, 'TEMPLATE_ID_COLTE_48H');
                await supabase.from("chat_history_test").update({ payment_reminder_48h: true }).eq("id", lead.id);
            }

            // 72 HORAS (o 6 minutos en test)
            else if (elapsedUnits >= T72 && !lead.payment_reminder_72h) {
                console.log(`Enviando recordatorio 72H a ${finalName} (${lead.client_number})`);
                await sendPaymentTemplate(lead.client_number, finalName, 'TEMPLATE_ID_COLTE_72H');
                await supabase.from("chat_history_test").update({ payment_reminder_72h: true }).eq("id", lead.id);
            }

        } catch (err) {
            console.error(`Error con lead ${lead.client_number}:`, err);
        }
    }
};

// Función de envío simplificada (solo nombre y teléfono, el servicio ya no es necesario para el template simple)
const sendPaymentTemplate = async (phoneNumber: string, name: string, templateId: string): Promise<void> => {
    if (process.env.TEST_MODE === 'true') {
        console.log(`[MOCK SEND] Enviando template ${templateId} a ${name} (${phoneNumber})`);
        return;
    }

    try {
        const response = await axios.post('https://ultim.online/seguros-colte/send-template', { 
            to: phoneNumber,
            name: name,
            // service: service, // Comentado si el template ya no lo usa, pero puedes descomentarlo si el backend lo requiere obligatoriamente
            templateId: templateId,
        });
        console.log('Template enviado:', response.data);
    } catch (error: any) {
        console.error('Error enviando template:', error.message);
    }
};