import { supabase } from "./supabase";

// Busca el nombre y servicio del cliente en la tabla maestra 'dentix_clients'
export const checkUserName = async (phoneNumber: string): Promise<{ name: string; service: string } | null> => {
    try {
        const { data, error } = await supabase
        .from("dentix_clients") // Tabla actualizada
        .select("name, service") // Traemos también el servicio
        .eq("phone_number", phoneNumber)
        .single();
    
        if (error) {
            return null;
        }
    
        return {
            name: data?.name || null,
            service: data?.service || null
        };
    } catch (error) {
        console.error("Error buscando datos en dentix_clients:", error);
        return null;
    }
}