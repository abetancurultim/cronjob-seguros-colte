import schedule from "node-schedule";
import { checkPaymentReminders } from './utils/checkPaymentReminders';
import dotenv from "dotenv";

dotenv.config();

// Check for test mode
const isTestMode = process.env.TEST_MODE === 'true';
const defaultSchedule = isTestMode ? "*/1 * * * *" : "*/15 * * * *"; // Cada minuto en test, cada 15 min en prod
const cronSchedule = process.env.CRON_SCHEDULE || defaultSchedule;

console.log(`🚀 Cronjob Seguros Colte iniciado...`);
console.log(`   - Modo: ${isTestMode ? 'TEST' : 'PROD'}`);
console.log(`   - Schedule: ${cronSchedule}`);

schedule.scheduleJob(cronSchedule, async () => {
  console.log(`[${new Date().toLocaleTimeString()}] Ejecutando chequeo de recordatorios...`);
  await checkPaymentReminders();
});