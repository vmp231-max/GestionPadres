import { NextRequest, NextResponse } from 'next/server';
import { performCalendarSync, getLastCalendarSync, AUTO_SYNC_INTERVAL_HOURS } from '@/lib/calendar-sync';

export async function GET(req: NextRequest) {
  try {
    const onlyStatus = req.nextUrl.searchParams.get('status') === 'true';

    if (onlyStatus) {
      const lastSync = getLastCalendarSync();
      return NextResponse.json({
        lastSync,
        autoSyncIntervalHours: AUTO_SYNC_INTERVAL_HOURS,
      });
    }

    const result = await performCalendarSync();
    return NextResponse.json({
      ...result,
      autoSyncIntervalHours: AUTO_SYNC_INTERVAL_HOURS,
    }, { status: result.success ? 200 : 500 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Error interno en la ruta de sincronización: ' + (error.message || String(error)) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
