export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureSeeded } = await import('@/db/seed');
    const { startShiftSchedulerDaemon } = await import('@/orchestrator/scheduler');
    ensureSeeded();
    startShiftSchedulerDaemon();
  }
}
