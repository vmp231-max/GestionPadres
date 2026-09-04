import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyTabletToken } from '@/lib/tablet-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(req: NextRequest) {
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
    const parentId = req.nextUrl.searchParams.get('parentId');

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta.' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Cargar datos base de la familia
    const [accRes, parentsRes, photosRes, contactsRes] = await Promise.all([
      supabase
        .from('accounts')
        .select('id, name, weather_location')
        .eq('id', accountId)
        .maybeSingle(),
      supabase
        .from('parents')
        .select('*')
        .eq('account_id', accountId)
        .order('name', { ascending: true }),
      supabase
        .from('family_photos')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false }),
      supabase
        .from('emergency_contacts')
        .select('*')
        .eq('account_id', accountId)
        .order('is_emergency', { ascending: false })
        .order('order_num', { ascending: true })
        .order('created_at', { ascending: true }),
    ]);

    if (accRes.error) throw accRes.error;
    if (!accRes.data) {
      return NextResponse.json(
        { error: 'La cuenta familiar vinculada ya no existe.' },
        { status: 404 }
      );
    }

    const parents = parentsRes.data || [];
    const photos = photosRes.data || [];
    const contacts = contactsRes.data || [];

    // 3. Si se solicita información específica de un familiar (Dashboard)
    let appointments: any[] = [];
    let medications: any[] = [];
    let notices: any[] = [];

    if (parentId) {
      // Verificar que el familiar pertenezca a esta cuenta
      const parentBelongs = parents.some((p: any) => p.id === parentId);
      if (!parentBelongs) {
        return NextResponse.json(
          { error: 'El familiar solicitado no pertenece a esta cuenta familiar.' },
          { status: 403 }
        );
      }

      // Citas desde el inicio del día actual (00:00)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [apptsRes, medsRes, noticesRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('*')
          .eq('parent_id', parentId)
          .gte('end_time', todayStart.toISOString())
          .order('start_time', { ascending: true }),
        supabase
          .from('medications')
          .select('*')
          .eq('parent_id', parentId)
          .eq('active', true),
        supabase
          .from('notices')
          .select('*')
          .eq('account_id', accountId)
          .eq('is_read', false)
          .or(`parent_id.eq.${parentId},parent_id.is.null`)
          .order('created_at', { ascending: false }),
      ]);

      if (apptsRes.error) throw apptsRes.error;
      if (medsRes.error) throw medsRes.error;
      if (noticesRes.error) throw noticesRes.error;

      appointments = apptsRes.data || [];
      medications = medsRes.data || [];
      notices = noticesRes.data || [];
    }

    return NextResponse.json({
      account: accRes.data,
      parents,
      photos,
      contacts,
      ...(parentId ? { appointments, medications, notices } : {}),
    });
  } catch (err: any) {
    console.error('Error en /api/tablet/data:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno al cargar datos de la tablet.' },
      { status: 500 }
    );
  }
}
