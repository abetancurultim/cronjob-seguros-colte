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
exports.checkConversations = void 0;
const supabase_1 = require("./supabase");
const dotenv_1 = __importDefault(require("dotenv"));
const axios_1 = __importDefault(require("axios"));
const checkUserName_1 = require("./checkUserName");
// --------------------------------------------------
dotenv_1.default.config();
// Función principal para verificar conversaciones y enviar notificaciones
const checkConversations = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Checking conversations...");
    // Consultar las conversaciones donde el acuerdo no se ha completado
    const { data: conversations, error } = yield supabase_1.supabase
        .from("chat_history")
        .select("*")
        .eq("notifications", true);
    if (error) {
        console.error("Error fetching conversations:", error);
        return;
    }
    const now = new Date();
    for (const conversation of conversations) {
        const isNotification = conversation.notifications;
        const notification_1 = conversation.notification_1;
        const notification_3 = conversation.notification_3;
        const notification_5 = conversation.notification_5;
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        const lastMessageDate = new Date(lastMessage.date);
        const timeDiff = now.getTime() - lastMessageDate.getTime();
        let clientName;
        // Si el campo conversation.client_name está vacío, buscar el nombre del cliente en la tabla users
        if (!conversation.client_name) {
            let checkUser = yield (0, checkUserName_1.checkUserName)(conversation.client_number);
            if (checkUser) {
                clientName = checkUser;
                // Actualizar el nombre del cliente en la conversación ***
                yield supabase_1.supabase
                    .from("chat_history")
                    // .from("chat_history")
                    .update({ client_name: checkUser })
                    .eq("id", conversation.id);
                console.log("Updated client name:", checkUser);
            }
            else {
                clientName = conversation.client_name;
            }
        }
        else {
            clientName = conversation.client_name;
        }
        //* Producción --------------------------------------------------
        // Enviar un recordatorio después de 24 horas
        if (timeDiff >= 24 * 60 * 60 * 1000 && timeDiff < 48 * 60 * 60 * 1000 && isNotification && !notification_1) {
            simulateMessage(conversation.client_number, clientName, "Reminder after 24 hours");
            yield sendTemplate(conversation.client_number, clientName, conversation.service);
            yield markNotification_1(conversation.id);
        }
        // Enviar un recordatorio después de 3 días
        if (timeDiff >= 3 * 24 * 60 * 60 * 1000 && timeDiff < 4 * 24 * 60 * 60 * 1000 && isNotification && !notification_3) {
            simulateMessage(conversation.client_number, clientName, "Reminder after 3 days");
            yield sendTemplate(conversation.client_number, clientName, conversation.service);
            yield markNotification_3(conversation.id);
        }
        // Enviar un recordatorio final después de 5 días
        if (timeDiff >= 5 * 24 * 60 * 60 * 1000 && timeDiff < 6 * 24 * 60 * 60 * 1000 && isNotification && !notification_5) {
            simulateMessage(conversation.client_number, clientName, "Final reminder after 5 days");
            yield sendTemplate(conversation.client_number, clientName, conversation.service);
            yield markNotification_5(conversation.id);
            yield markNotification(conversation.id);
        }
        //* --------------------------------------------------
        //! Pruebas --------------------------------------------------
        // Enviar un recordatorio después de 1 minuto
        // if (timeDiff >= 1 * 60 * 1000 && timeDiff < 2 * 60 * 1000 && isNotification && !notification_1) {
        //   simulateMessage(conversation.client_number, clientName, "Reminder after 1 minute");
        //   await sendTemplate(conversation.client_number, clientName, conversation.service);
        //   // await markNotification_1(conversation.id);
        //   console.log('notification_1:', notification_1);
        // }
        // // Enviar un recordatorio después de 3 minutos
        // if (timeDiff >= 3 * 60 * 1000 && timeDiff < 5 * 60 * 1000 && isNotification && !notification_3) {
        //   simulateMessage(conversation.client_number, clientName, "Reminder after 3 minutes");
        //   await sendTemplate(conversation.client_number, clientName, conversation.service);
        //   // await markNotification_3(conversation.id);
        //   console.log('notification_3:', notification_3);
        // }
        // // Enviar un recordatorio final después de 5 minutos
        // if (timeDiff >= 5 * 60 * 1000 && timeDiff < 6 * 60 * 1000 && isNotification && !notification_5) {
        //   simulateMessage(conversation.client_number, clientName, "Final reminder after 5 minutes");
        //   await sendTemplate(conversation.client_number, clientName, conversation.service);
        //   // await markNotification_5(conversation.id);
        //   console.log('notification_5:', notification_5);
        //   // await markNotification(conversation.id);
        // }
        //! --------------------------------------------------
    }
});
exports.checkConversations = checkConversations;
// Función para simular el envío de un mensaje al cliente
const simulateMessage = (phoneNumber, clientName = 'señor usuario', message) => {
    console.log(`Sending message to ${clientName} (${phoneNumber}): ${message}`);
};
// Función para marcar una conversación como notificada en la base de datos
const markNotification = (conversationId) => __awaiter(void 0, void 0, void 0, function* () {
    yield supabase_1.supabase
        .from("chat_history")
        .update({ notifications: false })
        .eq("id", conversationId);
});
// Función para marcar notification_1 como true
const markNotification_1 = (conversationId) => __awaiter(void 0, void 0, void 0, function* () {
    yield supabase_1.supabase
        .from("chat_history")
        .update({ notification_1: true })
        .eq("id", conversationId);
});
// Función para marcar notification_3 como true
const markNotification_3 = (conversationId) => __awaiter(void 0, void 0, void 0, function* () {
    yield supabase_1.supabase
        .from("chat_history")
        .update({ notification_3: true })
        .eq("id", conversationId);
});
// Función para marcar notification_5 como true
const markNotification_5 = (conversationId) => __awaiter(void 0, void 0, void 0, function* () {
    yield supabase_1.supabase
        .from("chat_history")
        .update({ notification_5: true })
        .eq("id", conversationId);
});
const sendTemplate = (phoneNumber, name, service) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield axios_1.default.post('https://ultim.online/russell/send-template', {
            to: phoneNumber,
            name: name,
            service: service,
            templateId: 'HXa0168c042624758267465be5f5d1635f',
        });
        console.log('Response:', response.data);
    }
    catch (error) {
        if (error.response) {
            console.error('Error:', error.response.data);
        }
        else if (error.request) {
            console.error('Error: No response received from server', error.request);
        }
        else {
            console.error('Error:', error.message);
        }
    }
});
