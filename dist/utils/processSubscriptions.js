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
exports.processSubscriptions = void 0;
const axios_1 = __importDefault(require("axios"));
const supabase_1 = require("./supabase");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const PAYMENTS_WAY_API_URL = process.env.PAYMENTS_WAY_API_URL;
const PAYMENTS_WAY_API_KEY = process.env.PAYMENTS_WAY_API_KEY;
const PAYMENTS_WAY_FORM_ID = process.env.PAYMENTS_WAY_FORM_ID;
const PAYMENTS_WAY_TERMINAL_ID = process.env.PAYMENTS_WAY_TERMINAL_ID;
const processSubscriptions = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('[Subscriptions] Iniciando procesamiento de suscripciones...');
    const isTestMode = process.env.TEST_MODE === 'true';
    const now = new Date();
    // Si estamos en test, simulamos que estamos 120 días en el futuro 
    // para que tome las cuotas pendientes de los próximos meses.
    if (isTestMode) {
        console.log('[TEST] Simulando fecha futura (+120 días) para procesar cuotas pendientes...');
        now.setDate(now.getDate() + 120);
    }
    const comparisonDate = now.toISOString().split('T')[0];
    console.log(`Fecha de comparación: ${comparisonDate}`);
    // 1. Obtener suscripciones activas que deben cobrarse hoy o antes
    const { data: subscriptions, error } = yield supabase_1.supabase
        .from('suscripciones')
        .select('*')
        .eq('status', 'active')
        .lte('next_payment_date', comparisonDate);
    if (error) {
        console.error('Error al obtener suscripciones:', error);
        return;
    }
    if (!subscriptions || subscriptions.length === 0) {
        console.log('No hay suscripciones pendientes de cobro.');
        return;
    }
    // Filtrar las que aún tienen cuotas pendientes
    const pendingSubscriptions = subscriptions.filter(sub => sub.installments_paid < sub.total_installments);
    if (pendingSubscriptions.length === 0) {
        console.log('No hay suscripciones con cuotas pendientes hoy.');
        return;
    }
    console.log(`Procesando ${pendingSubscriptions.length} suscripciones...`);
    for (const sub of pendingSubscriptions) {
        try {
            yield processSingleSubscription(sub);
        }
        catch (err) {
            console.error(`Error procesando suscripción ${sub.id}:`, err);
        }
    }
});
exports.processSubscriptions = processSubscriptions;
const processSingleSubscription = (sub) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`Procesando cobro para cliente ${sub.identification_doc} - Suscripción: ${sub.id}`);
    // PASO 1: ObtenerPersonaPorDocumento
    // Aquí obtenemos el card_uuid y confirmamos el idperson
    const personInfo = yield getPersonByDocument(sub.identification_doc);
    if (!personInfo || !personInfo.card_uuid) {
        throw new Error(`No se encontró información de tarjeta para el documento ${sub.identification_doc}`);
    }
    const { card_uuid, idperson } = personInfo;
    // PASO 2: CrearTransaccion
    const transactionId = yield createTransaction(idperson, sub.amount);
    if (!transactionId) {
        throw new Error('Error al crear la transacción en Payments Way');
    }
    // PASO 3: CrearOrdenTcCliente
    const orderUuid = yield createOrder(transactionId);
    if (!orderUuid) {
        throw new Error('Error al crear la orden en Payments Way');
    }
    // PASO 4: EjecutarOrdenTcCliente
    const executionResult = yield executeOrder(orderUuid, card_uuid, transactionId);
    if (executionResult.success) {
        console.log(`Cobro procesado para suscripción ${sub.id}. Transacción: ${transactionId}`);
        console.log(`La actualización de la base de datos se realizará a través del Webhook.`);
    }
    else {
        console.error(`Falló la ejecución del pago para la suscripción ${sub.id}:`, executionResult.message);
    }
});
// --- MÉTODOS PARA LA API DE PAYMENTS WAY ---
function getPersonByDocument(doc) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        console.log(`[API] Consultando persona por documento: ${doc}`);
        try {
            const response = yield axios_1.default.post(`${PAYMENTS_WAY_API_URL}/ClientAPI/ObtenerPersonaPorDocumento`, {
                nroDocumento: doc
            }, {
                headers: { 'Authorization': PAYMENTS_WAY_API_KEY }
            });
            const data = response.data;
            if (!data || !data.id) {
                console.error('No se encontró la persona en Payments Way');
                return null;
            }
            // Buscamos la primera tarjeta guardada que esté activa
            const activeCard = (_a = data.tarjetasguardadas) === null || _a === void 0 ? void 0 : _a.find((card) => card.status === true);
            if (!activeCard) {
                console.error('La persona no tiene tarjetas guardadas activas');
                return null;
            }
            return {
                card_uuid: activeCard.uuidPl,
                idperson: data.id
            };
        }
        catch (error) {
            console.error('Error en ObtenerPersonaPorDocumento:', error);
            return null;
        }
    });
}
function createTransaction(idperson, amount) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        console.log(`[API] Creando transacción para person ${idperson} por monto ${amount}`);
        try {
            // Generar un external_order único (timestamp + 6 dígitos aleatorios)
            const externalOrder = `${Date.now()}${Math.floor(100000 + Math.random() * 900000)}`;
            const response = yield axios_1.default.post(`${PAYMENTS_WAY_API_URL}/ClientAPI/CrearTransaccion`, {
                form_id: PAYMENTS_WAY_FORM_ID,
                terminal_id: PAYMENTS_WAY_TERMINAL_ID,
                idperson: idperson,
                amount: amount.toString(),
                external_order: externalOrder,
                ip: "127.0.0.1",
                additionalData: "Cobro recurrente suscripción",
                currencycode: "COP"
            }, {
                headers: { 'Authorization': PAYMENTS_WAY_API_KEY }
            });
            if (((_a = response.data) === null || _a === void 0 ? void 0 : _a.status) && ((_c = (_b = response.data) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.id)) {
                return response.data.data.id;
            }
            console.error('Error en la respuesta de CrearTransaccion:', response.data);
            return null;
        }
        catch (error) {
            console.error('Error en CrearTransaccion:', error);
            return null;
        }
    });
}
function createOrder(transactionId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        console.log(`[API] Creando orden para transacción ${transactionId}`);
        try {
            const response = yield axios_1.default.post(`${PAYMENTS_WAY_API_URL}/ClientAPI/CrearOrdenTcCliente`, {
                url_ok: "",
                url_ko: "",
                description: `Cobro recurrente - Transacción ${transactionId}`,
                reference: transactionId,
                dynamic_descriptor: "Cobro Seguro Coltefinanciera",
                form_id: PAYMENTS_WAY_FORM_ID,
                terminal_id: PAYMENTS_WAY_TERMINAL_ID,
                extra_data: {
                    payment: {
                        installments: 1
                    }
                }
            }, {
                headers: { 'Authorization': PAYMENTS_WAY_API_KEY }
            });
            if (((_a = response.data) === null || _a === void 0 ? void 0 : _a.code) === 200 && ((_c = (_b = response.data) === null || _b === void 0 ? void 0 : _b.order) === null || _c === void 0 ? void 0 : _c.uuid)) {
                return response.data.order.uuid;
            }
            console.error('Error en la respuesta de CrearOrdenTcCliente:', response.data);
            return null;
        }
        catch (error) {
            console.error('Error en CrearOrdenTcCliente:', error);
            return null;
        }
    });
}
function executeOrder(orderUuid, cardUuid, transactionId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        console.log(`[API] Ejecutando orden ${orderUuid} con tarjeta ${cardUuid}`);
        try {
            const response = yield axios_1.default.post(`${PAYMENTS_WAY_API_URL}/ClientAPI/EjecutarOrdenTcCliente`, {
                order_uuid: orderUuid,
                card_uuid: cardUuid,
                customer_ip: "127.0.0.1",
                idtransaction: transactionId,
                successResponse: true
            }, {
                headers: { 'Authorization': PAYMENTS_WAY_API_KEY }
            });
            const data = response.data;
            const isSuccess = ((_a = data === null || data === void 0 ? void 0 : data.idstatus) === null || _a === void 0 ? void 0 : _a.id) === 34 || ((_b = data === null || data === void 0 ? void 0 : data.idstatus) === null || _b === void 0 ? void 0 : _b.nombre) === 'Exitosa';
            return {
                success: isSuccess,
                message: ((_c = data === null || data === void 0 ? void 0 : data.idstatus) === null || _c === void 0 ? void 0 : _c.nombre) || 'Error en ejecución',
                raw: data
            };
        }
        catch (error) {
            console.error('Error en EjecutarOrdenTcCliente:', error);
            return { success: false, message: 'Error en la ejecución', raw: error };
        }
    });
}
