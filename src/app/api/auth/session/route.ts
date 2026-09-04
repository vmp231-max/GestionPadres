import { NextRequest, NextResponse } from 'next/server';
import { verifyTabletToken } from '@/lib/tablet-auth';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get('authorization');
    const token = body.token || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'Token de sesión no proporcionado.' },
        { status: 401 }
      );
    }

    // 1. Verificación criptográfica HMAC y expiración
    const verification = verifyTabletToken(token);
    if (!verification.valid || !verification.accountId) {
      return NextResponse.json(
        { valid: false, error: verification.error || 'Token inválido o expirado.' },
        { status: 401 }
      );
    }

    // 2. Comprobar que la cuenta sigue existiendo activamente en la base de datos
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: account, error } = await supabase
        .from('accounts')
        .select('id, name, weather_location')
        .eq('id', verification.accountId)
        .maybeSingle();

      if (error || !account) {
        return NextResponse.json(
          { valid: false, error: 'La cuenta asociada al token ya no existe.' },
          { status: 401 }
        );
      }

      return NextResponse.json({
        valid: true,
        expiresAt: verification.expiresAt,
        account: {
          id: account.id,
          name: account.name,
          weather_location: account.weather_location || null,
        },
      });
    }

    return NextResponse.json({
      valid: true,
      expiresAt: verification.expiresAt,
      account: {
        id: verification.accountId,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { valid: false, error: 'Error al verificar la sesión: ' + (error.message || String(error)) },
      { status: 500 }
    );
  }
}
