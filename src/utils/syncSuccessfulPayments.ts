import { supabase } from "./supabase";

export const syncSuccessfulPayments = async (): Promise<void> => {
    console.log("🔄 [Sincronización] Verificando nuevos pagos en payment_logs...");

    try {
        // 1. Obtener pagos exitosos recientes (últimos 5 días para cubrir fines de semana o retrasos)
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

        const { data: payments, error } = await supabase
            .from("payments_logs")
            .select("payer_phone, created_at, order_id")
            .eq("status_name", "Exitosa")
            .gte("created_at", fiveDaysAgo.toISOString());

        if (error) {
            console.error("Error fetching payments_logs:", error);
            return;
        }

        if (!payments || payments.length === 0) {
            return;
        }

        // 2. Para cada pago exitoso, buscamos si hay un chat pendiente de validación
        let updatedCount = 0;

        for (const payment of payments) {
            // Normalización básica: asegurar que sea string y quitar espacios si los hubiera
            const phoneNumber = String(payment.payer_phone).trim();

            // Buscamos leads pendientes con ese número que ya tengan link enviado
            const { data: leadsToUpdate, error: searchError } = await supabase
                .from("chat_history")
                .select("id, client_name")
                .eq("client_number", phoneNumber)
                .eq("payment_proof_received", false)
                .not("payment_link_sent_at", "is", null);

            if (searchError) {
                console.error(`Error buscando lead para el teléfono ${phoneNumber}:`, searchError);
                continue;
            }

            if (leadsToUpdate && leadsToUpdate.length > 0) {
                for (const lead of leadsToUpdate) {
                    // Actualizamos el lead para detener recordatorios
                    const { error: updateError } = await supabase
                        .from("chat_history")
                        .update({ 
                            payment_proof_received: true
                        })
                        .eq("id", lead.id);

                    if (!updateError) {
                        console.log(`✅ Pago detectado (Orden: ${payment.order_id}). Recordatorios cancelados para: ${lead.client_name || 'Cliente'} (${phoneNumber})`);
                        updatedCount++;
                    } else {
                        console.error(`Error actualizando lead ${lead.id}:`, updateError);
                    }
                }
            }
        }

        if (updatedCount > 0) {
            console.log(`🔄 Sincronización completada. ${updatedCount} leads actualizados.`);
        }

    } catch (err) {
        console.error("Error crítico en syncSuccessfulPayments:", err);
    }
};
