import { NextRequest, NextResponse } from 'next/server';
import { performCalendarSync, getLastCalendarSync, AUTO_SYNC_INTERVAL_HOURS } from '@/lib/calendar-sync';
import { verifyTabletToken } from '@/lib/tablet-auth';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(req: NextRequest) {
  try {
    const onlyStatus = req.nextUrl.searchParams.get('status') === 'true';
    let targetAccountId = req.nextUrl.searchParams.get('accountId') || undefined;

    if (onlyStatus) {
      const lastSync = getLastCalendarSync();
      return NextResponse.json({
        lastSync,
        autoSyncIntervalHours: AUTO_SYNC_INTERVAL_HOURS,
      });
    }

    // Comprobación de seguridad: 
    // 1) ¿Viene con cabecera interna/cron secreta?
    const syncSecret = req.headers.get('x-sync-secret') || req.nextUrl.searchParams.get('secret');
    const expectedSecret = process.env.CALENDAR_SYNC_SECRET;
    const isCronAuthorized = expectedSecret && syncSecret === expectedSecret;

    // 2) ¿Viene desde una tablet autenticada con token HMAC válido?
    const tabletToken = req.headers.get('x-tablet-token');
    const tabletAuth = tabletToken ? verifyTabletToken(tabletToken) : null;

    // 3) ¿Viene desde un usuario administrador autenticado en Supabase?
    const authHeader = req.headers.get('authorization');
    const userToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    let isAdminAuthorized = false;

    if (userToken && supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: { user } } = await supabase.auth.getUser(userToken);
      if (user) {
        isAdminAuthorized = true;
      }
    }

    if (!isCronAuthorized && !tabletAuth?.valid && !isAdminAuthorized) {
      return NextResponse.json(
        { error: 'Acceso no autorizado a la sincronización de calendario.' },
        { status: 401 }
      );
    }

    // Si viene desde una tablet, forzar que solo sincronice su propio accountId
    if (tabletAuth?.valid && tabletAuth.accountId) {
      targetAccountId = tabletAuth.accountId;
    }

    const result = await performCalendarSync(targetAccountId);
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

