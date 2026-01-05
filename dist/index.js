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
const node_schedule_1 = __importDefault(require("node-schedule"));
const processSubscriptions_1 = require("./utils/processSubscriptions");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Check for test mode
const isTestMode = process.env.TEST_MODE === 'true';
// Schedules
// const remindersSchedule = process.env.REMINDERS_CRON_SCHEDULE || (isTestMode ? "*/2 * * * *" : "*/15 * * * *");
const subscriptionsSchedule = process.env.SUBSCRIPTIONS_CRON_SCHEDULE || (isTestMode ? "*/2 * * * *" : "0 5 * * *"); // Por defecto 5:00 AM en prod
console.log(`🚀 Cronjob Seguros Colte iniciado...`);
console.log(`   - Modo: ${isTestMode ? 'TEST' : 'PROD'}`);
// console.log(`   - Schedule Recordatorios: ${remindersSchedule}`);
console.log(`   - Schedule Suscripciones: ${subscriptionsSchedule}`);
// Job para Recordatorios de Pago
// schedule.scheduleJob(remindersSchedule, async () => {
//   console.log(`[${new Date().toLocaleTimeString()}] Ejecutando chequeo de recordatorios...`);
//   await checkPaymentReminders();
// });
// Job para Procesamiento de Suscripciones
node_schedule_1.default.scheduleJob(subscriptionsSchedule, () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`[${new Date().toLocaleTimeString()}] Ejecutando procesamiento de suscripciones...`);
    yield (0, processSubscriptions_1.processSubscriptions)();
}));
