-- Esquema de Base de Datos para Gestión Médica de Padres

-- Habilitar la extensión para UUIDs si no está habilitada
create extension if not exists "uuid-ossp";

-- 1. Tabla de Padres (perfiles)
create table public.parents (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    avatar_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insertar datos iniciales para Papá y Mamá
insert into public.parents (name) values ('Mamá'), ('Papá');

-- 2. Tabla de Medicamentos
create table public.medications (
    id uuid default gen_random_uuid() primary key,
    parent_id uuid references public.parents(id) on delete cascade not null,
    name text not null,
    dose text not null,
    frequency text not null,
    comments text,
    active boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Trigger para actualizar updated_at automáticamente
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger update_medications_updated_at
before update on public.medications
for each row execute function update_updated_at_column();

-- 3. Tabla de Citas Médicas (Sincronizadas con Google Calendar)
create table public.appointments (
    id uuid default gen_random_uuid() primary key,
    parent_id uuid references public.parents(id) on delete cascade not null,
    title text not null,
    description text,
    start_time timestamp with time zone not null,
    end_time timestamp with time zone not null,
    location text,
    google_event_id text unique,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create trigger update_appointments_updated_at
before update on public.appointments
for each row execute function update_updated_at_column();

-- 4. Tabla de Avisos / Alertas enviadas
create table public.notices (
    id uuid default gen_random_uuid() primary key,
    parent_id uuid references public.parents(id) on delete cascade, -- null significa "Ambos"
    message text not null,
    type text default 'info'::text check (type in ('info', 'warning', 'alert')) not null,
    is_read boolean default false not null,
    read_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Configurar Row Level Security (RLS)
alter table public.parents enable row level security;
alter table public.medications enable row level security;
alter table public.appointments enable row level security;
alter table public.notices enable row level security;

-- Crear políticas básicas para permitir lectura de padres
create policy "Permitir lectura de padres a cualquiera" on public.parents
    for select using (true);

create policy "Permitir gestión de parents a usuarios autenticados" on public.parents
    for all to authenticated using (true);

-- Políticas para 'medications' que permiten lectura y escritura completa
create policy "Permitir gestión completa de medicación a cualquiera" on public.medications
    for all using (true);

-- Políticas para 'appointments' que permiten lectura y escritura completa
create policy "Permitir gestión completa de citas a cualquiera" on public.appointments
    for all using (true);

-- Políticas para 'notices' que permiten lectura y escritura completa
create policy "Permitir gestión completa de avisos a cualquiera" on public.notices
    for all using (true);

-- 6. Habilitar Supabase Realtime para que los avisos, citas y medicación lleguen en tiempo real
alter publication supabase_realtime add table public.notices;
alter publication supabase_realtime add table public.medications;
alter publication supabase_realtime add table public.appointments;
