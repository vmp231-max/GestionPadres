-- Esquema de Base de Datos para Gestión Médica de Padres (Multi-Cuenta / Multi-Familia)

-- Habilitar la extensión para UUIDs si no está habilitada
create extension if not exists "uuid-ossp";

-- 1. Tabla de Cuentas / Familias (Tenants)
create table if not exists public.accounts (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade unique,
    name text not null default 'Mi Familia',
    tablet_pin text not null unique, -- Cada familia tiene un PIN único e irrepetible para inferir su perfil
    weather_location jsonb, -- Ubicación meteorológica guardada para esta familia
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

-- 6. Tabla de Fotos Familiares (Marco Digital)
create table if not exists public.family_photos (
    id uuid default gen_random_uuid() primary key,
    account_id uuid references public.accounts(id) on delete cascade not null,
    image_url text not null, -- URL o Base64 optimizado
    caption text, -- Título o pie de foto cariñoso (ej. 'Cumpleaños de Lucas')
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Tabla de Contactos Familiares y Emergencias SOS
create table if not exists public.emergency_contacts (
    id uuid default gen_random_uuid() primary key,
    account_id uuid references public.accounts(id) on delete cascade not null,
    name text not null, -- ej. 'Vicente', 'Dra. Carmen', '112 Emergencias'
    relationship text, -- ej. 'Hijo', 'Hija', 'Médico de Familia', 'Servicio de Urgencias'
    phone text not null, -- Teléfono directo o número de emergencia
    is_emergency boolean default false not null, -- True si es SOS / 112 / Ambulancia
    avatar_url text, -- Foto o avatar opcional
    order_num integer default 0 not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Configurar Row Level Security (RLS)
alter table public.accounts enable row level security;
alter table public.parents enable row level security;
alter table public.medications enable row level security;
alter table public.appointments enable row level security;
alter table public.notices enable row level security;
alter table public.family_photos enable row level security;
alter table public.emergency_contacts enable row level security;

-- Función segura para generar PIN único sin exponer los PINs existentes al frontend
create or replace function public.generate_unique_tablet_pin()
returns text as $$
declare
    new_pin text;
    pin_exists boolean;
begin
    loop
        new_pin := floor(1000 + random() * 9000)::text;
        select exists(select 1 from public.accounts where tablet_pin = new_pin) into pin_exists;
        exit when not pin_exists;
    end loop;
    return new_pin;
end;
$$ language plpgsql security definer;

-- Limpiar políticas antiguas si existen
drop policy if exists "Permitir acceso a accounts" on public.accounts;
drop policy if exists "Permitir acceso a parents" on public.parents;
drop policy if exists "Permitir gestión completa de medicación" on public.medications;
drop policy if exists "Permitir gestión completa de citas" on public.appointments;
drop policy if exists "Permitir gestión completa de avisos" on public.notices;
drop policy if exists "Permitir gestión de fotos familiares" on public.family_photos;
drop policy if exists "Permitir gestión de contactos de emergencia" on public.emergency_contacts;

-- POLÍTICAS PARA ACCOUNTS
-- Los administradores autenticados solo pueden ver, crear y modificar su propia cuenta
create policy "Admin: ver y editar propia cuenta" on public.accounts
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- POLÍTICAS PARA PARENTS
-- Administradores: gestión completa de familiares de sus cuentas
create policy "Admin: gestión de familiares" on public.parents
    for all to authenticated
    using (account_id in (select id from public.accounts where user_id = auth.uid()))
    with check (account_id in (select id from public.accounts where user_id = auth.uid()));

-- Tablet (Anon): lectura de perfiles familiares
create policy "Tablet: consultar familiares" on public.parents
    for select to anon
    using (true);

-- POLÍTICAS PARA MEDICATIONS
-- Administradores: gestión completa de medicación de sus familiares
create policy "Admin: gestión de medicaciones" on public.medications
    for all to authenticated
    using (parent_id in (
        select p.id from public.parents p
        join public.accounts a on p.account_id = a.id
        where a.user_id = auth.uid()
    ))
    with check (parent_id in (
        select p.id from public.parents p
        join public.accounts a on p.account_id = a.id
        where a.user_id = auth.uid()
    ));

-- Tablet (Anon): lectura de medicación para el dashboard de la tablet
create policy "Tablet: consultar medicación" on public.medications
    for select to anon
    using (true);

-- POLÍTICAS PARA APPOINTMENTS
-- Administradores: gestión de citas médicas de sus familiares
create policy "Admin: gestión de citas" on public.appointments
    for all to authenticated
    using (parent_id in (
        select p.id from public.parents p
        join public.accounts a on p.account_id = a.id
        where a.user_id = auth.uid()
    ))
    with check (parent_id in (
        select p.id from public.parents p
        join public.accounts a on p.account_id = a.id
        where a.user_id = auth.uid()
    ));

-- Tablet (Anon): lectura de citas
create policy "Tablet: consultar citas" on public.appointments
    for select to anon
    using (true);

-- POLÍTICAS PARA NOTICES
-- Administradores: gestión completa de avisos para su familia
create policy "Admin: gestión de avisos" on public.notices
    for all to authenticated
    using (account_id in (select id from public.accounts where user_id = auth.uid()))
    with check (account_id in (select id from public.accounts where user_id = auth.uid()));

-- Tablet (Anon): lectura de avisos y confirmación de lectura
create policy "Tablet: consultar avisos" on public.notices
    for select to anon
    using (true);

create policy "Tablet: confirmar lectura de avisos" on public.notices
    for update to anon
    using (true)
    with check (true);

-- POLÍTICAS PARA FAMILY_PHOTOS
-- Administradores: gestión de fotos familiares
create policy "Admin: gestión de fotos familiares" on public.family_photos
    for all to authenticated
    using (account_id in (select id from public.accounts where user_id = auth.uid()))
    with check (account_id in (select id from public.accounts where user_id = auth.uid()));

-- Tablet (Anon): ver fotos del carrusel familiar
create policy "Tablet: consultar fotos familiares" on public.family_photos
    for select to anon
    using (true);

-- POLÍTICAS PARA EMERGENCY_CONTACTS
-- Administradores: gestión de contactos de emergencia
create policy "Admin: gestión de contactos de emergencia" on public.emergency_contacts
    for all to authenticated
    using (account_id in (select id from public.accounts where user_id = auth.uid()))
    with check (account_id in (select id from public.accounts where user_id = auth.uid()));

-- Tablet (Anon): ver contactos de emergencia y llamar
create policy "Tablet: consultar contactos de emergencia" on public.emergency_contacts
    for select to anon
    using (true);

-- 9. Habilitar Supabase Realtime para sincronización en tiempo real
alter publication supabase_realtime add table public.notices;
alter publication supabase_realtime add table public.medications;
alter publication supabase_realtime add table public.appointments;
alter publication supabase_realtime add table public.family_photos;
alter publication supabase_realtime add table public.emergency_contacts;
