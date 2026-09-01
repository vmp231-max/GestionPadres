export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { performCalendarSync, AUTO_SYNC_INTERVAL_MS, AUTO_SYNC_INTERVAL_HOURS } = await import('@/lib/calendar-sync');

    console.log(`[AutoSync] Programador de servidor activo: sincronización cada ${AUTO_SYNC_INTERVAL_HOURS} horas.`);

    // Sincronización inicial brevemente tras el arranque
    setTimeout(async () => {
      try {
        console.log('[AutoSync] Sincronización inicial al arrancar servidor...');
        await performCalendarSync();
      } catch (err) {
        console.error('[AutoSync] Error en sincronización inicial:', err);
      }
    }, 15000);

    // Bucle recurrente cada 5 horas
    setInterval(async () => {
      try {
        console.log(`[AutoSync] Ejecutando sincronización automática periódica (cada ${AUTO_SYNC_INTERVAL_HOURS} horas)...`);
        await performCalendarSync();
      } catch (err) {
        console.error('[AutoSync] Error en sincronización periódica:', err);
      }
    }, AUTO_SYNC_INTERVAL_MS);
  }
}
