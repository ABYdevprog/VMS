import { ensureSeeded } from '@/db/seed';
import { processCeoWhatsAppCommand } from '@/integrations/whatsapp';
import { approveAllPendingItems } from '@/orchestrator/approvals';
import { catchUpMissedShifts, runShift, ShiftType } from '@/orchestrator/scheduler';

async function main() {
  ensureSeeded();
  const [cmd = 'status', ...rest] = process.argv.slice(2);

  if (cmd === 'status') {
    const out = await processCeoWhatsAppCommand('DURUM', 'cockpit');
    console.log(out);
    return;
  }

  if (cmd === 'shift:run') {
    const target = (rest[0] || 'morning').toLowerCase();
    if (target === 'all') {
      for (const s of ['morning', 'midday', 'afternoon', 'night'] as ShiftType[]) {
        const res = await runShift(s, 'antigravity');
        console.log(`✅ [${s}] ${res.summary}`);
      }
      return;
    }
    if (['morning', 'midday', 'afternoon', 'night'].includes(target)) {
      const res = await runShift(target as ShiftType, 'antigravity');
      console.log(`✅ [${target}] ${res.summary}`);
      return;
    }
    throw new Error(`Geçersiz vardiya tipi: ${target} (morning | midday | afternoon | night | all)`);
  }

  if (cmd === 'shift:catchup') {
    const results = await catchUpMissedShifts('antigravity');
    if (results.length === 0) {
      console.log('ℹ️ Bugün için saati geçmiş ve eksik kalmış vardiya yok.');
    } else {
      for (const r of results) {
        console.log(`✅ [catchup:${r.shiftType}] ${r.summary}`);
      }
    }
    return;
  }

  if (cmd === 'approve:all') {
    const res = await approveAllPendingItems('ceo_cockpit');
    console.log(`✅ Toplam ${res.approvedCount} onay bekleyen işlem onaylandı: ${res.codes.join(', ')}`);
    return;
  }

  if (cmd === 'directive') {
    const text = rest.join(' ').trim();
    if (!text) {
      throw new Error('Lütfen talimat metni girin.');
    }
    const out = await processCeoWhatsAppCommand(text, 'cockpit');
    console.log(out);
    return;
  }

  console.log(
    [
      'VMS Otonom Ajans CLI Kullanımı:',
      '  npm run vms -- status',
      '  npm run vms -- shift:run <morning|midday|afternoon|night|all>',
      '  npm run vms -- shift:catchup',
      '  npm run vms -- approve:all',
      '  npm run vms -- directive "Yarın Kadıköy diş kliniklerine odaklanın"',
    ].join('\n')
  );
}

main().catch((err) => {
  console.error('❌ VMS CLI Hatası:', err);
  process.exit(1);
});
