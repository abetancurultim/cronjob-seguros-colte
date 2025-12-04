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
const checkPaymentReminders_1 = require("./utils/checkPaymentReminders");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Check for test mode
const isTestMode = process.env.TEST_MODE === 'true';
const defaultSchedule = isTestMode ? "*/1 * * * *" : "*/15 * * * *"; // Cada minuto en test, cada 15 min en prod
const cronSchedule = process.env.CRON_SCHEDULE || defaultSchedule;
console.log(`🚀 Cronjob Seguros Colte iniciado...`);
console.log(`   - Modo: ${isTestMode ? 'TEST' : 'PROD'}`);
console.log(`   - Schedule: ${cronSchedule}`);
node_schedule_1.default.scheduleJob(cronSchedule, () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`[${new Date().toLocaleTimeString()}] Ejecutando chequeo de recordatorios...`);
    yield (0, checkPaymentReminders_1.checkPaymentReminders)();
}));
