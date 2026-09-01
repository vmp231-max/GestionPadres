import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Duración de la sesión en días (configurable con TABLET_SESSION_DAYS o 30 días por defecto)
const SESSION_DAYS = parseInt(process.env.TABLET_SESSION_DAYS || '30', 10);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pin = typeof body.pin === 'string' ? body.pin.trim() : '';

    const expectedPin = (process.env.TABLET_PIN || '1234').trim();

    if (!pin || pin !== expectedPin) {
      return NextResponse.json(
        { error: 'Clave o PIN incorrecto. Inténtalo de nuevo.' },
        { status: 401 }
      );
    }

    // Calcular fecha de expiración en milisegundos
    const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;

    // Generar un token con firma HMAC para que no pueda ser alterado
    const secret = process.env.SUPABASE_ANON_KEY || expectedPin || 'secret_tablet_key';
    const signature = crypto.createHmac('sha256', secret).update(String(expiresAt)).digest('hex');
    const token = `${expiresAt}.${signature}`;

    return NextResponse.json({
      success: true,
      token,
      expiresAt,
      sessionDays: SESSION_DAYS,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Error interno en la verificación: ' + (error.message || String(error)) },
      { status: 500 }
    );
  }
}
