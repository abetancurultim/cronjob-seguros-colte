import schedule from "node-schedule";
import { checkPaymentReminders } from './utils/checkPaymentReminders';
import { processSubscriptions } from './utils/processSubscriptions';
import dotenv from "dotenv";

dotenv.config();

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
schedule.scheduleJob(subscriptionsSchedule, async () => {
  console.log(`[${new Date().toLocaleTimeString()}] Ejecutando procesamiento de suscripciones...`);
  await processSubscriptions();
});