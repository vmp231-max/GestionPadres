import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClientIp, checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/rate-limiter';
import { generateTabletToken } from '@/lib/tablet-auth';

// Duración de la sesión en días (configurable con TABLET_SESSION_DAYS o 30 días por defecto)
const SESSION_DAYS = parseInt(process.env.TABLET_SESSION_DAYS || '30', 10);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Retardo artificial para mitigar ataques de temporización
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);

    // 1. Control de Tasa (Rate Limiting) Anti-Fuerza Bruta
    const rateCheck = checkRateLimit(clientIp, 5, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: rateCheck.error || 'Demasiados intentos fallidos. Acceso bloqueado temporalmente.',
          blockedSeconds: rateCheck.blockedSeconds,
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateCheck.blockedSeconds),
          }
        }
      );
    }

    const body = await req.json().catch(() => ({}));
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

    // Buscar directamente la familia correspondiente al PIN introducido
    const { data: account, error } = await supabase
      .from('accounts')
      .select('id, name, tablet_pin, weather_location')
      .eq('tablet_pin', pin)
      .maybeSingle();

    if (error) {
      console.error('Error al verificar PIN:', error);
      return NextResponse.json(
        { error: 'Error al comprobar el PIN en la base de datos.' },
        { status: 500 }
      );
    }

    // PIN INCORRECTO: Registrar intento fallido y aplicar retardo protector
    if (!account) {
      // Retardo de 400ms para ralentizar ataques automatizados
      await delay(400);

      const failResult = recordFailedAttempt(clientIp, 5, 15 * 60 * 1000);
      return NextResponse.json(
        { 
          error: failResult.error || 'PIN incorrecto. Ninguna familia está asociada a este PIN.',
          remainingAttempts: failResult.remainingAttempts,
        },
        { status: failResult.allowed ? 401 : 429 }
      );
    }

    // PIN CORRECTO: Restablecer contador de intentos de la IP
    resetRateLimit(clientIp);

    // Calcular fecha de expiración en milisegundos
    const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;

    // Generar token con HMAC-SHA256 y secreto del servidor
    const token = generateTabletToken(account.id, expiresAt);

    return NextResponse.json({
      success: true,
      token,
      expiresAt,
      sessionDays: SESSION_DAYS,
      account: {
        id: account.id,
        name: account.name,
        weather_location: account.weather_location || null
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Error interno en la verificación: ' + (error.message || String(error)) },
      { status: 500 }
    );
  }
}

