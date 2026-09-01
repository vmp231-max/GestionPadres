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

export async function performCalendarSync(): Promise<CalendarSyncResponse> {
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

    // Obtener los perfiles de los padres
    const { data: parents, error: parentsError } = await supabase
      .from('parents')
      .select('id, name');

    if (parentsError || !parents || parents.length === 0) {
      const errorMsg = 'No se encontraron perfiles de padres en la base de datos.';
      console.error(`[CalendarSync] ${errorMsg}`, parentsError);
      return {
        success: false,
        timestamp,
        results: [],
        error: errorMsg,
      };
    }

    const mamaProfile = parents.find((p) => p.name === 'Mamá');
    const papaProfile = parents.find((p) => p.name === 'Papá');

    const calendarsToSync = [
      {
        profile: mamaProfile,
        calendarId: process.env.GOOGLE_CALENDAR_ID_MAMA,
        name: 'Mamá',
      },
      {
        profile: papaProfile,
        calendarId: process.env.GOOGLE_CALENDAR_ID_PAPA,
        name: 'Papá',
      },
    ];

    const syncResults: CalendarSyncResultItem[] = [];

    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 7);
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 90);

    for (const cal of calendarsToSync) {
      if (!cal.calendarId) {
        syncResults.push({
          name: cal.name,
          status: 'skipped',
          detail: 'ID de calendario no configurado',
        });
        continue;
      }

      if (!cal.profile) {
        syncResults.push({
          name: cal.name,
          status: 'failed',
          detail: 'Perfil no encontrado en la base de datos',
        });
        continue;
      }

      try {
        const response = await calendar.events.list({
          calendarId: cal.calendarId,
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
            parent_id: cal.profile.id,
            title: event.summary || 'Cita médica sin título',
            description: event.description || '',
            start_time: new Date(startStr).toISOString(),
            end_time: new Date(endStr).toISOString(),
            location: event.location || '',
            google_event_id: event.id,
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
        let deleteError;
        if (activeGoogleIds.length > 0) {
          const formattedIds = activeGoogleIds.map((id) => `"${id}"`).join(',');
          const result = await supabase
            .from('appointments')
            .delete()
            .eq('parent_id', cal.profile.id)
            .gte('start_time', timeMin.toISOString())
            .lte('start_time', timeMax.toISOString())
            .not('google_event_id', 'in', `(${formattedIds})`);
          deleteError = result.error;
        } else {
          const result = await supabase
            .from('appointments')
            .delete()
            .eq('parent_id', cal.profile.id)
            .gte('start_time', timeMin.toISOString())
            .lte('start_time', timeMax.toISOString());
          deleteError = result.error;
        }

        if (deleteError) {
          console.error(`[CalendarSync] Error al borrar citas huérfanas de ${cal.name}:`, deleteError);
        }

        syncResults.push({
          name: cal.name,
          status: 'success',
          syncedCount: events.length,
        });
      } catch (err: any) {
        console.error(`[CalendarSync] Error al sincronizar citas de ${cal.name}:`, err);
        syncResults.push({
          name: cal.name,
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
