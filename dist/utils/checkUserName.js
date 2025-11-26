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
// traer el name del cliente de la tabla users en supabase recibiendo como para parámetro de búsqueda el teléfono del cliente.
const checkUserName = (phoneNumber) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Checking user name for phone number:", phoneNumber);
    try {
        const { data, error } = yield supabase_1.supabase
            .from("users")
            .select("name")
            .eq("phone", phoneNumber)
            .single();
        if (error) {
            console.error("Error fetching user name:", error);
            return null;
        }
        return (data === null || data === void 0 ? void 0 : data.name) || null;
    }
    catch (error) {
        console.error("Error:", error);
        return null;
    }
});
exports.checkUserName = checkUserName;
