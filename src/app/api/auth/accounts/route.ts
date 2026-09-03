import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET() {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ accounts: [] });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener la lista pública de cuentas familiares (solo ID y Nombre para el selector)
    const { data: accounts, error } = await supabase
      .from('accounts')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error al listar cuentas familiares:', error);
      return NextResponse.json({ accounts: [] });
    }

    return NextResponse.json({ accounts: accounts || [] });
  } catch (err: any) {
    console.error('Error en /api/auth/accounts:', err);
    return NextResponse.json({ accounts: [] });
  }
}
