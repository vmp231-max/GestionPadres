-- Esquema de Base de Datos para Gestión Médica de Padres (Multi-Cuenta / Multi-Familia)

-- Habilitar la extensión para UUIDs si no está habilitada
create extension if not exists "uuid-ossp";

-- 1. Tabla de Cuentas / Familias (Tenants)
create table if not exists public.accounts (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade unique,
    name text not null default 'Mi Familia',
    tablet_pin text not null unique, -- Cada familia tiene un PIN único e irrepetible para inferir su perfil
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabla de Padres / Familiares
create table if not exists public.parents (
    id uuid default gen_random_uuid() primary key,
    account_id uuid references public.accounts(id) on delete cascade,
    name text not null, -- ej. 'Mamá', 'Papá', 'Abuela Carmen'
    calendar_id text, -- ID de Google Calendar específico del familiar
    avatar_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tabla de Medicamentos
create table if not exists public.medications (
    id uuid default gen_random_uuid() primary key,
    parent_id uuid references public.parents(id) on delete cascade not null,
    name text not null,
    dose text not null,
    frequency text not null,
    period text default 'Mañana' not null,
    schedule_type text default 'diario' not null,
    schedule_days text default '' not null,
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

create or replace trigger update_medications_updated_at
before update on public.medications
for each row execute function update_updated_at_column();

-- 4. Tabla de Citas Médicas (Sincronizadas con Google Calendar)
create table if not exists public.appointments (
    id uuid default gen_random_uuid() primary key,
    account_id uuid references public.accounts(id) on delete cascade,
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

create or replace trigger update_appointments_updated_at
before update on public.appointments
for each row execute function update_updated_at_column();

-- 5. Tabla de Avisos / Alertas enviadas
create table if not exists public.notices (
    id uuid default gen_random_uuid() primary key,
    account_id uuid references public.accounts(id) on delete cascade,
    parent_id uuid references public.parents(id) on delete cascade, -- null significa "Todos los familiares de esta cuenta"
    message text not null,
    type text default 'info'::text check (type in ('info', 'warning', 'alert')) not null,
    is_read boolean default false not null,
    read_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Configurar Row Level Security (RLS)
alter table public.accounts enable row level security;
alter table public.parents enable row level security;
alter table public.medications enable row level security;
alter table public.appointments enable row level security;
alter table public.notices enable row level security;

-- Políticas de acceso
create policy "Permitir acceso a accounts" on public.accounts
    for all using (true);

create policy "Permitir acceso a parents" on public.parents
    for all using (true);

create policy "Permitir gestión completa de medicación" on public.medications
    for all using (true);

create policy "Permitir gestión completa de citas" on public.appointments
    for all using (true);

create policy "Permitir gestión completa de avisos" on public.notices
    for all using (true);

-- 7. Habilitar Supabase Realtime para sincronización en tiempo real
alter publication supabase_realtime add table public.notices;
alter publication supabase_realtime add table public.medications;
alter publication supabase_realtime add table public.appointments;

-- 8. Migración para actualizar bases de datos existentes
-- Ejecuta este bloque en Supabase SQL Editor:
/*
create table if not exists public.accounts (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade unique,
    name text not null default 'Mi Familia',
    tablet_pin text default '1234' not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.accounts enable row level security;
create policy "Permitir acceso a accounts" on public.accounts for all using (true);

alter table public.parents add column if not exists account_id uuid references public.accounts(id) on delete cascade;
alter table public.parents add column if not exists calendar_id text;
alter table public.appointments add column if not exists account_id uuid references public.accounts(id) on delete cascade;
alter table public.notices add column if not exists account_id uuid references public.accounts(id) on delete cascade;
alter table public.medications add column if not exists schedule_type text default 'diario' not null;
alter table public.medications add column if not exists schedule_days text default '' not null;
*/
