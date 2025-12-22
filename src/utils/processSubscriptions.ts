import axios from 'axios';
import { supabase } from './supabase';
import dotenv from 'dotenv';

dotenv.config();

const PAYMENTS_WAY_API_URL = process.env.PAYMENTS_WAY_API_URL;
const PAYMENTS_WAY_API_KEY = process.env.PAYMENTS_WAY_API_KEY;
const PAYMENTS_WAY_FORM_ID = process.env.PAYMENTS_WAY_FORM_ID;
const PAYMENTS_WAY_TERMINAL_ID = process.env.PAYMENTS_WAY_TERMINAL_ID;

interface Subscription {
    id: string;
    client_id: number;
    payment_person_id: string;
    identification_doc: string;
    amount: number;
    total_installments: number;
    installments_paid: number;
    status: string;
    next_payment_date: string;
}

export const processSubscriptions = async () => {
    console.log('🔄 [Subscriptions] Iniciando procesamiento de suscripciones...');

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
    const { data: subscriptions, error } = await supabase
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
    const pendingSubscriptions = (subscriptions as Subscription[]).filter(
        sub => sub.installments_paid < sub.total_installments
    );

    if (pendingSubscriptions.length === 0) {
        console.log('No hay suscripciones con cuotas pendientes hoy.');
        return;
    }

    console.log(`Procesando ${pendingSubscriptions.length} suscripciones...`);

    for (const sub of pendingSubscriptions) {
        try {
            await processSingleSubscription(sub);
        } catch (err) {
            console.error(`Error procesando suscripción ${sub.id}:`, err);
        }
    }
};

const processSingleSubscription = async (sub: Subscription) => {
    console.log(`💳 Procesando cobro para cliente ${sub.identification_doc} - Suscripción: ${sub.id}`);

    // PASO 1: ObtenerPersonaPorDocumento
    // Aquí obtenemos el card_uuid y confirmamos el idperson
    const personInfo = await getPersonByDocument(sub.identification_doc);
    if (!personInfo || !personInfo.card_uuid) {
        throw new Error(`No se encontró información de tarjeta para el documento ${sub.identification_doc}`);
    }

    const { card_uuid, idperson } = personInfo;

    // PASO 2: CrearTransaccion
    const transactionId = await createTransaction(idperson, sub.amount);
    if (!transactionId) {
        throw new Error('Error al crear la transacción en Payments Way');
    }

    // PASO 3: CrearOrdenTcCliente
    const orderUuid = await createOrder(transactionId);
    if (!orderUuid) {
        throw new Error('Error al crear la orden en Payments Way');
    }

    // PASO 4: EjecutarOrdenTcCliente
    const executionResult = await executeOrder(orderUuid, card_uuid, transactionId);
    
    if (executionResult.success) {
        console.log(`Cobro procesado para suscripción ${sub.id}. Transacción: ${transactionId}`);
        console.log(`La actualización de la base de datos se realizará a través del Webhook.`);
    } else {
        console.error(`Falló la ejecución del pago para la suscripción ${sub.id}:`, executionResult.message);
    }
};

// --- MÉTODOS PARA LA API DE PAYMENTS WAY ---

async function getPersonByDocument(doc: string) {
    console.log(`[API] Consultando persona por documento: ${doc}`);
    try {
        const response = await axios.post(`${PAYMENTS_WAY_API_URL}/ClientAPI/ObtenerPersonaPorDocumento`, {
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
        const activeCard = data.tarjetasguardadas?.find((card: any) => card.status === true);
        
        if (!activeCard) {
            console.error('La persona no tiene tarjetas guardadas activas');
            return null;
        }

        return {
            card_uuid: activeCard.uuidPl,
            idperson: data.id
        };
    } catch (error) {
        console.error('Error en ObtenerPersonaPorDocumento:', error);
        return null;
    }
}

async function createTransaction(idperson: string, amount: number) {
    console.log(`[API] Creando transacción para person ${idperson} por monto ${amount}`);
    try {
        // Generar un external_order único (timestamp + 6 dígitos aleatorios)
        const externalOrder = `${Date.now()}${Math.floor(100000 + Math.random() * 900000)}`;

        const response = await axios.post(`${PAYMENTS_WAY_API_URL}/ClientAPI/CrearTransaccion`, {
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
        
        if (response.data?.status && response.data?.data?.id) {
            return response.data.data.id;
        }
        
        console.error('Error en la respuesta de CrearTransaccion:', response.data);
        return null;
    } catch (error) {
        console.error('Error en CrearTransaccion:', error);
        return null;
    }
}

async function createOrder(transactionId: string) {
    console.log(`[API] Creando orden para transacción ${transactionId}`);
    try {
        const response = await axios.post(`${PAYMENTS_WAY_API_URL}/ClientAPI/CrearOrdenTcCliente`, {
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
        
        if (response.data?.code === 200 && response.data?.order?.uuid) {
            return response.data.order.uuid;
        }
        
        console.error('Error en la respuesta de CrearOrdenTcCliente:', response.data);
        return null;
    } catch (error) {
        console.error('Error en CrearOrdenTcCliente:', error);
        return null;
    }
}

async function executeOrder(orderUuid: string, cardUuid: string, transactionId: string) {
    console.log(`[API] Ejecutando orden ${orderUuid} con tarjeta ${cardUuid}`);
    try {
        const response = await axios.post(`${PAYMENTS_WAY_API_URL}/ClientAPI/EjecutarOrdenTcCliente`, {
            order_uuid: orderUuid,
            card_uuid: cardUuid,
            customer_ip: "127.0.0.1",
            idtransaction: transactionId,
            successResponse: true
        }, {
            headers: { 'Authorization': PAYMENTS_WAY_API_KEY }
        });
        
        const data = response.data;
        const isSuccess = data?.idstatus?.id === 34 || data?.idstatus?.nombre === 'Exitosa';

        return {
            success: isSuccess,
            message: data?.idstatus?.nombre || 'Error en ejecución',
            raw: data
        };
    } catch (error) {
        console.error('Error en EjecutarOrdenTcCliente:', error);
        return { success: false, message: 'Error en la ejecución', raw: error };
    }
}
