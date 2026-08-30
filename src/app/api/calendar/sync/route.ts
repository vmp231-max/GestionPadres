import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    // 1. Verificar credenciales de Google
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!email || !rawKey) {
      return NextResponse.json(
        { error: 'Las credenciales de Google Service Account no están configuradas.' },
        { status: 500 }
      );
    }

    // Formatear la clave privada (reemplazar saltos de línea escapados)
    const privateKey = rawKey.replace(/\\n/g, '\n').replace(/"/g, '');

    // Inicializar cliente JWT de Google Auth
    const auth = new google.auth.JWT({
      email,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly']
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // 2. Obtener los perfiles de los padres en la base de datos
    const { data: parents, error: parentsError } = await supabase
      .from('parents')
      .select('id, name');

    if (parentsError || !parents || parents.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron perfiles de padres en la base de datos. Ejecuta el schema SQL primero.' },
        { status: 500 }
      );
    }

    const mamaProfile = parents.find(p => p.name === 'Mamá');
    const papaProfile = parents.find(p => p.name === 'Papá');

    const calendarsToSync = [
      {
        profile: mamaProfile,
        calendarId: process.env.GOOGLE_CALENDAR_ID_MAMA,
        name: 'Mamá'
      },
      {
        profile: papaProfile,
        calendarId: process.env.GOOGLE_CALENDAR_ID_PAPA,
        name: 'Papá'
      }
    ];

    const syncResults = [];

    // Rango de fechas para la sincronización (Desde hace 7 días hasta dentro de 90 días)
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 7);
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 90);

    for (const cal of calendarsToSync) {
      if (!cal.calendarId) {
        syncResults.push({ name: cal.name, status: 'skipped', detail: 'ID de calendario no configurado' });
        continue;
      }

      if (!cal.profile) {
        syncResults.push({ name: cal.name, status: 'failed', detail: 'Perfil no encontrado en la base de datos' });
        continue;
      }

      try {
        // Obtener eventos del Google Calendar
        const response = await calendar.events.list({
          calendarId: cal.calendarId,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
        });

        const events = response.data.items || [];
        const activeGoogleIds: string[] = [];

        // Insertar o actualizar eventos en Supabase
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

          // Upsert en Supabase utilizando google_event_id como conflicto
          const { error: upsertErr } = await supabase
            .from('appointments')
            .upsert(appointmentData, { onConflict: 'google_event_id' });
          
          if (upsertErr) {
            console.error(`Error de inserción en cita "${appointmentData.title}":`, upsertErr);
            throw upsertErr;
          }
        }

        // Eliminar eventos locales que ya no existen en Google Calendar (citas canceladas)
        // en el rango de fechas sincronizado
        let deleteError;
        if (activeGoogleIds.length > 0) {
          const formattedIds = activeGoogleIds.map(id => `"${id}"`).join(',');
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
          console.error(`Error al borrar citas huérfanas de ${cal.name}:`, deleteError);
        }

        syncResults.push({
          name: cal.name,
          status: 'success',
          syncedCount: events.length,
        });

      } catch (err: any) {
        console.error(`Error al sincronizar calendario de ${cal.name}:`, err);
        syncResults.push({
          name: cal.name,
          status: 'failed',
          detail: err.message || err,
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: syncResults
    });

  } catch (error: any) {
    console.error('Error general en la API de sincronización:', error);
    return NextResponse.json(
      { error: 'Error interno en la sincronización: ' + (error.message || error) },
      { status: 500 }
    );
  }
}
