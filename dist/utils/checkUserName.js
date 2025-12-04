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
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkUserName = void 0;
const supabase_1 = require("./supabase");
// Busca el nombre y servicio del cliente en la tabla maestra 'dentix_clients'
const checkUserName = (phoneNumber) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { data, error } = yield supabase_1.supabase
            .from("dentix_clients") // Tabla actualizada
            .select("name, service") // Traemos también el servicio
            .eq("phone_number", phoneNumber)
            .single();
        if (error) {
            return null;
        }
        return {
            name: (data === null || data === void 0 ? void 0 : data.name) || null,
            service: (data === null || data === void 0 ? void 0 : data.service) || null
        };
    }
    catch (error) {
        console.error("Error buscando datos en dentix_clients:", error);
        return null;
    }
});
exports.checkUserName = checkUserName;
