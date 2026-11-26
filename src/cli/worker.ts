import { ensureSeeded } from '@/db/seed';
import { catchUpMissedShifts, startShiftSchedulerDaemon } from '@/orchestrator/scheduler';

async function bootWorker() {
  ensureSeeded();
  console.log('🚀 VMS 7/24 Arka Plan Vardiya İşçisi Başlatıldı (Saat Dilimi: Europe/Istanbul)');
  const caughtUp = await catchUpMissedShifts('catchup');
  if (caughtUp.length > 0) {
    console.log(`⚡ Başlangıç telafisi tamamlandı: ${caughtUp.map((c) => c.shiftType).join(', ')}`);
  }
  startShiftSchedulerDaemon();
}

bootWorker().catch((err) => {
  console.error('Worker hatası:', err);
  process.exit(1);
});
