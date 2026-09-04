import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

// Inicializar el cliente de Gemini (busca automáticamente la variable GEMINI_API_KEY en el entorno)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
  try {
    // 1. Verificación de Autenticación de Administrador
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: 'Acceso no autorizado. Se requiere iniciar sesión como administrador.' },
        { status: 401 }
      );
    }

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Configuración de autenticación no disponible en el servidor.' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Sesión no válida o expirada. Por favor vuelve a iniciar sesión.' },
        { status: 401 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'La clave GEMINI_API_KEY no está configurada en las variables de entorno.' },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No se ha subido ningún archivo PDF.' },
        { status: 400 }
      );
    }

    // Verificar tipo de archivo
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'El archivo debe ser un documento PDF.' },
        { status: 400 }
      );
    }

    // Convertir el archivo a Buffer y luego a Base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfBase64 = buffer.toString('base64');

    // Prompt detallado en español para la extracción médica
    const prompt = `Analiza este documento PDF de receta médica. Extrae la lista de todos los medicamentos activos que se indican en el documento. 
Para cada medicamento, identifica con precisión:
1. El nombre comercial o genérico del medicamento.
2. La dosis o presentación (ej. 500mg, 1 tableta, 10ml, 1 sobre).
3. La frecuencia de las tomas y horarios recomendados (ej. Cada 8 horas, En el desayuno y cena, 1 vez al día).
4. El momento del día correspondiente para la toma principal: debe ser exactamente uno de estos valores: "Mañana", "Mediodia", "Tarde" o "Noche" (ej. Desayuno = Mañana, Comida/Almuerzo = Mediodia, Merienda = Tarde, Cena/Dormir = Noche).
5. El tipo de periodicidad o pauta de administración:
   - "diario": Si se toma todos los días.
   - "dias_semana": Si se toma días específicos de la semana (ej. Lunes y Jueves, L-M-V). En 'schedule_days' pon las iniciales de los días separadas por comas usando: L, M, X, J, V, S, D (ej. "L,J" o "L,X,V").
   - "dias_alternos": Si se toma en días alternos o cada 2 días (cada 48 horas).
   - "semanal": Si se toma 1 día concreto a la semana (ej. todos los lunes pon "L" en 'schedule_days').
   - "mensual": Si se toma 1 día concreto del mes (ej. día 1 de cada mes pon "1" en 'schedule_days').
   - "segun_necesidad": Si es medicación "si precisa", "SOS", "en caso de dolor" o a demanda.
6. Cualquier comentario, advertencia o instrucción de administración especial (ej. Tomar con las comidas, No tomar con leche, Mantener en nevera).

Asegúrate de traducir términos complejos o abreviaturas médicas a lenguaje claro y sencillo comprensible para personas mayores.`;

    // Realizar la llamada a Gemini 3.5 Flash pasándole el PDF en línea
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64
          }
        },
        prompt
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            medications: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  name: { type: 'STRING', description: 'Nombre del medicamento' },
                  dose: { type: 'STRING', description: 'Dosis (ej. 500mg, 1 comprimido)' },
                  frequency: { type: 'STRING', description: 'Frecuencia de las tomas (ej. Cada 12 horas)' },
                  period: { 
                    type: 'STRING', 
                    description: 'Momento del día principal para la toma. Valores posibles: "Mañana", "Mediodia", "Tarde", "Noche"' 
                  },
                  schedule_type: {
                    type: 'STRING',
                    description: 'Tipo de periodicidad: "diario", "dias_semana", "dias_alternos", "semanal", "mensual", "segun_necesidad"'
                  },
                  schedule_days: {
                    type: 'STRING',
                    description: 'Días asociados a la pauta (ej. "L,J", "L,X,V", "L", "1" o vacío)'
                  },
                  comments: { type: 'STRING', description: 'Comentarios adicionales (ej. Con el desayuno)' }
                },
                required: ['name', 'dose', 'frequency', 'period', 'schedule_type']
              }
            }
          },
          required: ['medications']
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
      return NextResponse.json(
        { error: 'No se pudo obtener una respuesta válida de Gemini.' },
        { status: 500 }
      );
    }

    const parsedData = JSON.parse(responseText);

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error('Error al procesar el PDF con Gemini:', error);
    return NextResponse.json(
      { error: 'Error interno al procesar el PDF: ' + (error.message || error) },
      { status: 500 }
    );
  }
}
