import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyTabletToken } from '@/lib/tablet-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
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
