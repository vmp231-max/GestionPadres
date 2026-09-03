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
    const accountId = typeof body.accountId === 'string' ? body.accountId.trim() : undefined;

    if (!pin) {
      return NextResponse.json(
        { error: 'Por favor introduce el PIN o clave de acceso.' },
        { status: 400 }
      );
    }

    const defaultEnvPin = (process.env.TABLET_PIN || '1234').trim();
    let validatedAccount: { id: string; name: string } | null = null;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      if (accountId) {
        // Verificar PIN contra una cuenta específica
        const { data: account, error } = await supabase
          .from('accounts')
          .select('id, name, tablet_pin')
          .eq('id', accountId)
          .single();

        if (error || !account) {
          return NextResponse.json(
            { error: 'La cuenta familiar seleccionada no existe o no es válida.' },
            { status: 404 }
          );
        }

        const expectedAccountPin = (account.tablet_pin || defaultEnvPin).trim();
        if (pin !== expectedAccountPin && pin !== defaultEnvPin) {
          return NextResponse.json(
            { error: 'PIN incorrecto para esta familia. Inténtalo de nuevo.' },
            { status: 401 }
          );
        }

        validatedAccount = { id: account.id, name: account.name };
      } else {
        // Si no se especifica accountId, buscar si coincide con el PIN de alguna cuenta registrada
        const { data: accounts } = await supabase
          .from('accounts')
          .select('id, name, tablet_pin');

        if (accounts && accounts.length > 0) {
          const matched = accounts.find(acc => (acc.tablet_pin || '').trim() === pin || pin === defaultEnvPin);
          if (matched) {
            validatedAccount = { id: matched.id, name: matched.name };
          }
        }
      }
    }

    // Si aún no se validó ninguna cuenta pero coincide con el PIN de entorno
    if (!validatedAccount) {
      if (pin === defaultEnvPin) {
        validatedAccount = { id: 'default', name: 'Mi Familia' };
      } else {
        return NextResponse.json(
          { error: 'PIN o clave incorrecta. Inténtalo de nuevo.' },
          { status: 401 }
        );
      }
    }

    // Calcular fecha de expiración en milisegundos
    const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;

    // Generar un token con firma HMAC para que no pueda ser alterado
    const secret = process.env.SUPABASE_ANON_KEY || defaultEnvPin || 'secret_tablet_key';
    const payload = `${expiresAt}:${validatedAccount.id}`;
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const token = `${expiresAt}.${validatedAccount.id}.${signature}`;

    return NextResponse.json({
      success: true,
      token,
      expiresAt,
      sessionDays: SESSION_DAYS,
      account: validatedAccount
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Error interno en la verificación: ' + (error.message || String(error)) },
      { status: 500 }
    );
  }
}
