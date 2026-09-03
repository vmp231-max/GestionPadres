import { google } from 'googleapis';
import { supabase } from '@/lib/supabase';

export interface CalendarSyncResultItem {
  name: string;
  status: 'success' | 'failed' | 'skipped';
  syncedCount?: number;
  detail?: string;
}

export interface CalendarSyncResponse {
  success: boolean;
  timestamp: string;
  results: CalendarSyncResultItem[];
  error?: string;
}

// Intervalo de sincronización automática: 5 horas en milisegundos
export const AUTO_SYNC_INTERVAL_HOURS = 5;
export const AUTO_SYNC_INTERVAL_MS = AUTO_SYNC_INTERVAL_HOURS * 60 * 60 * 1000;

export async function performCalendarSync(accountId?: string): Promise<CalendarSyncResponse> {
  const timestamp = new Date().toISOString();

  try {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!email || !rawKey) {
      const errorMsg = 'Las credenciales de Google Service Account no están configuradas en .env.local.';
      console.warn(`[CalendarSync] ${errorMsg}`);
      return {
        success: false,
        timestamp,
        results: [],
        error: errorMsg,
      };
    }

    const privateKey = rawKey.replace(/\\n/g, '\n').replace(/"/g, '');

    const auth = new google.auth.JWT({
      email,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // Obtener los perfiles de los familiares
    let query = supabase.from('parents').select('id, name, account_id, calendar_id');
    if (accountId) {
      query = query.eq('account_id', accountId);
    }

    const { data: parents, error: parentsError } = await query;

    if (parentsError || !parents || parents.length === 0) {
      const errorMsg = 'No se encontraron perfiles de familiares en la base de datos para sincronizar.';
      console.warn(`[CalendarSync] ${errorMsg}`);
      return {
        success: true,
        timestamp,
        results: [],
        error: errorMsg,
      };
    }

    const syncResults: CalendarSyncResultItem[] = [];

    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 7);
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 90);

    for (const parent of parents) {
      // Usar exclusivamente el ID de calendario configurado en la base de datos para este familiar
      const calId = (parent.calendar_id || '').trim();

      if (!calId) {
        syncResults.push({
          name: parent.name,
          status: 'skipped',
          detail: 'ID de calendario no configurado. Edita el familiar en el panel para asignarle su ID de Google Calendar.',
        });
        continue;
      }

      try {
        const response = await calendar.events.list({
          calendarId: calId.trim(),
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
        });

        const events = response.data.items || [];
        const activeGoogleIds: string[] = [];

        for (const event of events) {
          if (!event.id) continue;
          activeGoogleIds.push(event.id);

          const startStr = event.start?.dateTime || event.start?.date;
          const endStr = event.end?.dateTime || event.end?.date;

          if (!startStr || !endStr) continue;

          const appointmentData = {
            account_id: parent.account_id || accountId || null,
            parent_id: parent.id,
            title: event.summary || 'Cita médica sin título',
            description: event.description || '',
            start_time: new Date(startStr).toISOString(),
            end_time: new Date(endStr).toISOString(),
            location: event.location || '',
            google_event_id: `${parent.id}_${event.id}`,
          };

          const { error: upsertErr } = await supabase
            .from('appointments')
            .upsert(appointmentData, { onConflict: 'google_event_id' });

          if (upsertErr) {
            console.error(`[CalendarSync] Error al insertar cita "${appointmentData.title}":`, upsertErr);
            throw upsertErr;
          }
        }

        // Limpieza de eventos cancelados
        if (activeGoogleIds.length > 0) {
          const formattedIds = activeGoogleIds.map((id) => `"${parent.id}_${id}"`).join(',');
          await supabase
            .from('appointments')
            .delete()
            .eq('parent_id', parent.id)
            .gte('start_time', timeMin.toISOString())
            .lte('start_time', timeMax.toISOString())
            .not('google_event_id', 'in', `(${formattedIds})`);
        } else {
          await supabase
            .from('appointments')
            .delete()
            .eq('parent_id', parent.id)
            .gte('start_time', timeMin.toISOString())
            .lte('start_time', timeMax.toISOString());
        }

        syncResults.push({
          name: parent.name,
          status: 'success',
          syncedCount: events.length,
        });
      } catch (err: any) {
        console.error(`[CalendarSync] Error al sincronizar citas de ${parent.name}:`, err);
        syncResults.push({
          name: parent.name,
          status: 'failed',
          detail: err.message || String(err),
        });
      }
    }

    const finalResponse: CalendarSyncResponse = {
      success: true,
      timestamp,
      results: syncResults,
    };

    (globalThis as any).__lastCalendarSync = finalResponse;
    console.log(`[CalendarSync] Sincronización completada exitosamente a las ${timestamp}`);
    return finalResponse;
  } catch (error: any) {
    console.error('[CalendarSync] Error general en performCalendarSync:', error);
    const errorResponse: CalendarSyncResponse = {
      success: false,
      timestamp,
      results: [],
      error: error.message || String(error),
    };
    (globalThis as any).__lastCalendarSync = errorResponse;
    return errorResponse;
  }
}

export function getLastCalendarSync(): CalendarSyncResponse | null {
  return (globalThis as any).__lastCalendarSync || null;
}
