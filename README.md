# 🏥 Portal de Gestión Médica Familiar (GestiónPadres)

Aplicación web integral y accesible diseñada para ejecutarse en una tablet para personas mayores y un panel de administración para gestionar citas médicas, medicación activa y avisos familiares en tiempo real.

---

## 🌟 Características Principales

### 📱 Vista Tablet (Padres) - `/`
- **Interfaz Accesible & Premium:** Tipografía amplia de alto contraste, modo claro/oscuro y diseño con glassmorphism pensado para pantallas táctiles.
- **Reloj y Fecha en Vivo:** Cabecera con fecha y hora en tamaño grande para fácil lectura y orientación.
- **Citas Médicas:** Visualización clara de las citas de hoy y próximas citas sincronizadas con Google Calendar.
- **Medicación del Día:** Medicamentos organizados en franjas (Mañana ☀️, Tarde ⛅, Noche 🌙) con botón de confirmación de toma y persistencia local diaria.
- **Avisos Familiares en Tiempo Real:** Recepción instantánea de mensajes enviados desde el panel de control vía Supabase Realtime.
- **Lector de Voz (Text-to-Speech):** Alerta sonora y locución por voz automática en español para que escuchen el mensaje sin necesidad de leer la pantalla.

### ⚙️ Panel de Administración - `/admin`
- **Acceso Protegido:** Autenticación segura mediante Supabase Auth.
- **Sincronización Automática cada 5 horas:** Descarga y actualización automática de citas de Google Calendar de Mamá y Papá cada 5 horas (mediante temporizador en servidor Next.js `instrumentation.ts`, auto-chequeo en la tablet al estar activa/despertar y soporte para cron de Vercel). Permite además sincronización manual bajo demanda en un clic.
- **Importación Inteligente de Recetas (Gemini IA):** Subida de recetas médicas en PDF y análisis automático mediante Gemini Flash para estructurar medicamentos, dosis, frecuencias y comentarios. Permite editar antes de guardar y activar en la tablet.
- **Gestión de Avisos:** Envío de mensajes a Mamá, Papá o Ambos con selección de prioridad (Info, Advertencia, Alerta) y monitorización de lectura (hora de confirmación).

---

## 🛠️ Stack Tecnológico

- **Framework:** Next.js (App Router, TypeScript)
- **Estilos:** Vanilla CSS moderno con variables CSS y Glassmorphism
- **Base de Datos & Auth:** Supabase (PostgreSQL, Row Level Security, Realtime)
- **Integraciones:**
  - **Google Calendar API** (Service Account con `googleapis`)
  - **Google Gemini API** (`@google/genai`)
  - **Lucide Icons** (`lucide-react`)

---

## 🚀 Puesta en Marcha Local

### 1. Clonar el repositorio e instalar dependencias
```bash
git clone https://github.com/vmp231-max/GestionPadres.git
cd GestionPadres
npm install
```

### 2. Configuración de Variables de Entorno
Copia el archivo de plantilla `.env.example` a `.env.local`:
```bash
cp .env.example .env.local
```

Rellena las siguientes variables en `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`: URL de tu proyecto en Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Clave pública anon de Supabase.
- `GEMINI_API_KEY`: Tu clave de Google AI Studio.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Email de tu cuenta de servicio de Google Cloud.
- `GOOGLE_PRIVATE_KEY`: Clave privada de la cuenta de servicio (`"-----BEGIN PRIVATE KEY-----\n..."`).
- `GOOGLE_CALENDAR_ID_MAMA`: ID del calendario de Google de Mamá.
- `GOOGLE_CALENDAR_ID_PAPA`: ID del calendario de Google de Papá.

### 3. Configurar Base de Datos en Supabase
1. Accede a tu proyecto en Supabase.
2. Entra en el **SQL Editor**.
3. Pega y ejecuta el contenido del archivo [`supabase/schema.sql`](supabase/schema.sql). Esto creará las tablas `parents`, `medications`, `appointments` y `notices`, con sus correspondientes políticas RLS.

### 4. Ejecutar el servidor de desarrollo
```bash
npm run dev
```

- **Vista Tablet:** [http://localhost:3000](http://localhost:3000)
- **Panel Admin:** [http://localhost:3000/admin](http://localhost:3000/admin)
