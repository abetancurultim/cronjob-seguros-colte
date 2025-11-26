import schedule from "node-schedule";
import { checkPaymentReminders } from './utils/checkPaymentReminders';
import dotenv from "dotenv";

dotenv.config();

const isTestMode = process.env.TEST_MODE === 'true';
const cronSchedule = isTestMode ? "*/1 * * * *" : "0 * * * *";

console.log(`🚀 Cronjob Seguros Colte iniciado... (Modo: ${isTestMode ? 'TEST - Cada minuto' : 'PROD - Cada hora'})`);

schedule.scheduleJob(cronSchedule, async () => {
  console.log(`[${new Date().toLocaleTimeString()}] Ejecutando chequeo de recordatorios...`);
  await checkPaymentReminders();
});