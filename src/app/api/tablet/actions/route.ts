import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyTabletToken } from '@/lib/tablet-auth';

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  try {
    // 1. Validar Token Criptográfico de la Tablet
    const token = req.headers.get('x-tablet-token');
    const session = verifyTabletToken(token);

    if (!session.valid || !session.accountId) {
      return NextResponse.json(
        { error: session.error || 'Acceso denegado. Sesión no válida o expirada.' },
        { status: 401 }
      );
    }

    const accountId = session.accountId;
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Parámetro action no especificado.' },
        { status: 400 }
      );
    }

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta.' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Ejecutar la acción solicitada verificando aislamiento por account_id
    if (action === 'mark_notice_read') {
      const { noticeId } = body;
      if (!noticeId) {
        return NextResponse.json(
          { error: 'ID de aviso no proporcionado.' },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from('notices')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', noticeId)
        .eq('account_id', accountId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'update_weather_location') {
      const { location } = body;
      if (!location) {
        return NextResponse.json(
          { error: 'Ubicación no proporcionada.' },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from('accounts')
        .update({ weather_location: location })
        .eq('id', accountId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'toggle_medication_taken') {
      const { medicationId, parentId, taken } = body;
      if (!medicationId || !parentId) {
        return NextResponse.json(
          { error: 'Parámetros incompletos (medicationId y parentId requeridos).' },
          { status: 400 }
        );
      }

      // Verificar que el familiar pertenezca a la cuenta del token
      const { data: parentCheck } = await supabase
        .from('parents')
        .select('id')
        .eq('id', parentId)
        .eq('account_id', accountId)
        .maybeSingle();

      if (!parentCheck) {
        return NextResponse.json(
          { error: 'El familiar no pertenece a esta cuenta.' },
          { status: 403 }
        );
      }

      const todayDateStr = new Date().toISOString().split('T')[0];

      if (taken) {
        const { error } = await supabase
          .from('medication_logs')
          .upsert(
            {
              parent_id: parentId,
              medication_id: medicationId,
              taken_date: todayDateStr,
              taken_at: new Date().toISOString(),
            },
            { onConflict: 'medication_id,taken_date' }
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('medication_logs')
          .delete()
          .eq('medication_id', medicationId)
          .eq('taken_date', todayDateStr);
        if (error) throw error;
      }

      return NextResponse.json({ success: true, taken });
    }

    return NextResponse.json(
      { error: `Acción '${action}' no soportada.` },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('Error en /api/tablet/actions:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno al procesar acción de la tablet.' },
      { status: 500 }
    );
  }
}
