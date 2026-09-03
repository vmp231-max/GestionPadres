import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Duración de la sesión en días (configurable con TABLET_SESSION_DAYS o 30 días por defecto)
const SESSION_DAYS = parseInt(process.env.TABLET_SESSION_DAYS || '30', 10);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pin = typeof body.pin === 'string' ? body.pin.trim() : '';

    if (!pin) {
      return NextResponse.json(
        { error: 'Por favor introduce el PIN o clave de acceso.' },
        { status: 400 }
      );
    }

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Configuración de base de datos no disponible.' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar directamente la familia correspondiente al PIN único introducido
    const { data: account, error } = await supabase
      .from('accounts')
      .select('id, name, tablet_pin')
      .eq('tablet_pin', pin)
      .maybeSingle();

    if (error) {
      console.error('Error al verificar PIN:', error);
      return NextResponse.json(
        { error: 'Error al comprobar el PIN en la base de datos.' },
        { status: 500 }
      );
    }

    if (!account) {
      return NextResponse.json(
        { error: 'PIN incorrecto. Ninguna familia está asociada a este PIN.' },
        { status: 401 }
      );
    }

    // Calcular fecha de expiración en milisegundos
    const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;

    // Generar un token con firma HMAC para que no pueda ser alterado
    const secret = supabaseKey || 'secret_tablet_session_key';
    const payload = `${expiresAt}:${account.id}`;
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const token = `${expiresAt}.${account.id}.${signature}`;

    return NextResponse.json({
      success: true,
      token,
      expiresAt,
      sessionDays: SESSION_DAYS,
      account: {
        id: account.id,
        name: account.name
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Error interno en la verificación: ' + (error.message || String(error)) },
      { status: 500 }
    );
  }
}
