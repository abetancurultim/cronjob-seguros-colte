import { supabase } from "./supabase";

// Busca el nombre del cliente en la tabla maestra 'dentix_clients'
export const checkUserName = async (phoneNumber: string): Promise<string | null> => {
    try {
        const { data, error } = await supabase
        .from("dentix_clients_test") // Tabla actualizada
        .select("name")
        .eq("phone_number", phoneNumber) // Campo según tu JSON
        .single();
    
        if (error) {
            // Si no existe, no es un error crítico, simplemente retornamos null
            return null;
        }
    
        return data?.name || null;
    } catch (error) {
        console.error("Error buscando nombre en dentix_clients_test:", error);
        return null;
    }
}