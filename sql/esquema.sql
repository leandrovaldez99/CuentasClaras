-- Cuentas Claras · esquema de la base de datos (PostgreSQL, en Supabase)
--
-- Idea general
--   · Cada usuario (auth.users) tiene un PERFIL y un ESPACIO propio: ahí viven sus datos.
--   · Un grupo familiar es un espacio con varios miembros: todos ven y cargan en el mismo.
--   · Todas las tablas de datos llevan espacio_id, y la clave es (espacio_id, id).
--   · Seguridad por filas (RLS): cada usuario sólo llega a las filas de los espacios donde es miembro.
--   · La columna "extra" (jsonb) guarda los datos internos de la app que no hacen falta para consultar.

-- ---------------------------------------------------------------- usuarios y espacios
create table public.perfiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  nombre         text not null default '',
  espacio_actual uuid,
  creado_el      timestamptz not null default now()
);

create table public.espacios (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null default 'Mis cuentas',
  codigo     text unique,                       -- código para invitar a otro usuario (grupo familiar)
  creado_por uuid not null references public.perfiles(id) on delete cascade,
  creado_el  timestamptz not null default now()
);
alter table public.perfiles
  add constraint perfiles_espacio_actual_fk foreign key (espacio_actual) references public.espacios(id) on delete set null;

create table public.personas (
  espacio_id    uuid not null references public.espacios(id) on delete cascade,
  id            text not null,
  nombre        text not null,
  se_sumo_el    timestamptz,
  modificado_el timestamptz,
  fuera         boolean not null default false,  -- salió del grupo: queda para el historial
  orden         integer not null default 0,
  primary key (espacio_id, id)
);

create table public.espacio_miembros (
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  persona_id text,                               -- qué persona del grupo es este usuario
  se_sumo_el timestamptz not null default now(),
  primary key (espacio_id, usuario_id),
  foreign key (espacio_id, persona_id) references public.personas(espacio_id, id) on delete set null (persona_id)
);
create index espacio_miembros_usuario_idx on public.espacio_miembros(usuario_id);

-- ---------------------------------------------------------------- catálogos
create table public.medios_pago (
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  id         text not null,
  nombre     text not null,
  dia_cuotas smallint,                           -- día en que vencen las cuotas de esa tarjeta
  orden      integer not null default 0,
  primary key (espacio_id, id)
);

create table public.grupos_categorias (
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  id         text not null,
  nombre     text not null,
  color      text,
  orden      integer not null default 0,
  primary key (espacio_id, id)
);

create table public.categorias (
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  tipo       text not null check (tipo in ('gasto', 'ingreso')),
  nombre     text not null,
  grupo_id   text,
  orden      integer not null default 0,
  activa     boolean not null default true,      -- false: ya no se ofrece, pero la usan movimientos viejos
  primary key (espacio_id, tipo, nombre),
  foreign key (espacio_id, grupo_id) references public.grupos_categorias(espacio_id, id) on delete set null (grupo_id)
);

-- ---------------------------------------------------------------- movimientos, cuotas y fijos
create table public.movimientos (
  espacio_id  uuid not null references public.espacios(id) on delete cascade,
  id          text not null,
  tipo        text not null check (tipo in ('gasto', 'ingreso')),
  monto       numeric not null,
  moneda      text,                              -- vacío = pesos
  cotizacion  numeric,
  fecha       date,
  categoria   text,
  medio_id    text,
  nota        text,
  persona_id  text,                              -- de quién es (grupo familiar)
  cargado_por text,
  a_medias    jsonb,                             -- entre qué personas se divide
  viaje_id    text,
  orden       bigint not null default 0,
  extra       jsonb not null default '{}',
  primary key (espacio_id, id),
  foreign key (espacio_id, tipo, categoria) references public.categorias(espacio_id, tipo, nombre),
  foreign key (espacio_id, medio_id)   references public.medios_pago(espacio_id, id) on delete set null (medio_id),
  foreign key (espacio_id, persona_id) references public.personas(espacio_id, id)    on delete set null (persona_id)
);
create index movimientos_fecha_idx on public.movimientos(espacio_id, fecha);

create table public.compras_cuotas (
  espacio_id  uuid not null references public.espacios(id) on delete cascade,
  id          text not null,
  tipo        text not null default 'gasto' check (tipo = 'gasto'),
  descripcion text,
  total       numeric not null,
  cuotas      integer not null,
  dia         smallint,
  primer_mes  text,                              -- AAAA-MM
  categoria   text,
  medio_id    text,
  persona_id  text,
  a_medias    jsonb,
  orden       bigint not null default 0,
  extra       jsonb not null default '{}',
  primary key (espacio_id, id),
  foreign key (espacio_id, tipo, categoria) references public.categorias(espacio_id, tipo, nombre),
  foreign key (espacio_id, medio_id)   references public.medios_pago(espacio_id, id) on delete set null (medio_id),
  foreign key (espacio_id, persona_id) references public.personas(espacio_id, id)    on delete set null (persona_id)
);

create table public.gastos_fijos (
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  id         text not null,
  tipo       text not null check (tipo in ('gasto', 'ingreso')),
  nombre     text not null,
  cuando     text,                               -- día del mes, o 'primerHabil', 'ultimoHabil', 'nHabil', 'quincena'
  categoria  text,
  medio_id   text,
  persona_id text,
  desde      text,                               -- AAAA-MM
  hasta      text,
  moneda     text,
  a_medias   jsonb,
  orden      bigint not null default 0,
  extra      jsonb not null default '{}',
  primary key (espacio_id, id),
  foreign key (espacio_id, tipo, categoria) references public.categorias(espacio_id, tipo, nombre),
  foreign key (espacio_id, medio_id)   references public.medios_pago(espacio_id, id) on delete set null (medio_id),
  foreign key (espacio_id, persona_id) references public.personas(espacio_id, id)    on delete set null (persona_id)
);

create table public.precios_fijo (
  espacio_id uuid not null,
  fijo_id    text not null,
  orden      integer not null,
  desde      text not null,                      -- AAAA-MM desde que vale este precio
  monto      numeric not null,
  cotizacion numeric,
  primary key (espacio_id, fijo_id, orden),
  foreign key (espacio_id, fijo_id) references public.gastos_fijos(espacio_id, id) on delete cascade
);

create table public.pases (
  espacio_id    uuid not null references public.espacios(id) on delete cascade,
  id            text not null,
  fecha         date,
  monto         numeric not null,
  medio_origen  text,
  medio_destino text,
  nota          text,
  persona_id    text,
  orden         bigint not null default 0,
  extra         jsonb not null default '{}',
  primary key (espacio_id, id),
  foreign key (espacio_id, medio_origen)  references public.medios_pago(espacio_id, id) on delete set null (medio_origen),
  foreign key (espacio_id, medio_destino) references public.medios_pago(espacio_id, id) on delete set null (medio_destino),
  foreign key (espacio_id, persona_id)    references public.personas(espacio_id, id)    on delete set null (persona_id)
);

-- ---------------------------------------------------------------- ahorro
create table public.cuentas_rinden (
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  id         text not null,
  entidad    text,                               -- banco o billetera
  tna        numeric,
  manual     boolean,
  medio_id   text,
  orden      integer not null default 0,
  extra      jsonb not null default '{}',
  primary key (espacio_id, id),
  foreign key (espacio_id, medio_id) references public.medios_pago(espacio_id, id) on delete set null (medio_id)
);

create table public.metas_ahorro (
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  id         text not null,
  nombre     text not null,
  objetivo   numeric,
  moneda     text,
  desde      date,
  cuenta_id  text,
  orden      integer not null default 0,
  extra      jsonb not null default '{}',
  primary key (espacio_id, id),
  foreign key (espacio_id, cuenta_id) references public.cuentas_rinden(espacio_id, id) on delete set null (cuenta_id)
);

create table public.aportes (
  espacio_id uuid not null,
  meta_id    text not null,
  id         text not null,
  monto      numeric not null,
  fecha      date,
  moneda     text,
  cotizacion numeric,
  cuenta_id  text,
  persona_id text,
  orden      bigint not null default 0,
  extra      jsonb not null default '{}',
  primary key (espacio_id, meta_id, id),
  foreign key (espacio_id, meta_id)    references public.metas_ahorro(espacio_id, id)   on delete cascade,
  foreign key (espacio_id, cuenta_id)  references public.cuentas_rinden(espacio_id, id) on delete set null (cuenta_id),
  foreign key (espacio_id, persona_id) references public.personas(espacio_id, id)       on delete set null (persona_id)
);

create table public.horas_extras (
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  id         text not null,
  fecha      date,
  horas      numeric not null,
  recargo    numeric,                            -- porcentaje de recargo
  persona_id text,
  orden      bigint not null default 0,
  extra      jsonb not null default '{}',
  primary key (espacio_id, id),
  foreign key (espacio_id, persona_id) references public.personas(espacio_id, id) on delete set null (persona_id)
);

-- ---------------------------------------------------------------- viajes
create table public.viajes (
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  id         text not null,
  nombre     text not null,
  clave      text,
  creado_el  timestamptz,
  orden      integer not null default 0,
  extra      jsonb not null default '{}',
  primary key (espacio_id, id)
);

create table public.viaje_miembros (
  espacio_id uuid not null,
  viaje_id   text not null,
  id         text not null,
  nombre     text not null,
  orden      integer not null default 0,
  extra      jsonb not null default '{}',
  primary key (espacio_id, viaje_id, id),
  foreign key (espacio_id, viaje_id) references public.viajes(espacio_id, id) on delete cascade
);

create table public.viaje_gastos (
  espacio_id  uuid not null,
  viaje_id    text not null,
  id          text not null,
  pagado_por  text,
  monto       numeric not null,
  descripcion text,
  categoria   text,
  fecha       date,
  orden       integer not null default 0,
  extra       jsonb not null default '{}',
  primary key (espacio_id, viaje_id, id),
  foreign key (espacio_id, viaje_id) references public.viajes(espacio_id, id) on delete cascade,
  foreign key (espacio_id, viaje_id, pagado_por) references public.viaje_miembros(espacio_id, viaje_id, id) on delete set null (pagado_por)
);

-- ---------------------------------------------------------------- configuración del espacio
create table public.ajustes (
  espacio_id    uuid primary key references public.espacios(id) on delete cascade,
  datos         jsonb not null default '{}',     -- presupuestos, orden de los paneles, reparto del grupo, recordatorio…
  modificado_el timestamptz not null default now()
);

-- ---------------------------------------------------------------- seguridad por filas (RLS)
create or replace function public.es_miembro(p_espacio uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.espacio_miembros m
                 where m.espacio_id = p_espacio and m.usuario_id = (select auth.uid()));
$$;
revoke execute on function public.es_miembro(uuid) from public, anon;
grant  execute on function public.es_miembro(uuid) to authenticated;

alter table public.perfiles         enable row level security;
alter table public.espacios         enable row level security;
alter table public.espacio_miembros enable row level security;

create policy perfil_propio_ver on public.perfiles for select to authenticated using (id = (select auth.uid()));
create policy perfil_propio_cambiar on public.perfiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and (espacio_actual is null or public.es_miembro(espacio_actual)));

create policy espacio_ver on public.espacios for select to authenticated using (public.es_miembro(id));
create policy espacio_cambiar on public.espacios for update to authenticated
  using (creado_por = (select auth.uid())) with check (creado_por = (select auth.uid()));

create policy miembros_ver on public.espacio_miembros for select to authenticated using (public.es_miembro(espacio_id));
create policy miembro_propio_cambiar on public.espacio_miembros for update to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
-- sacar a alguien del grupo: sólo quien creó el espacio (salir uno mismo va por salir_del_espacio)
create policy miembros_sacar on public.espacio_miembros for delete to authenticated
  using (usuario_id <> (select auth.uid())
         and exists (select 1 from public.espacios e where e.id = espacio_id and e.creado_por = (select auth.uid())));

-- las tablas de datos: todo lo del espacio, sólo para sus miembros
do $$
declare t text;
begin
  foreach t in array array['personas', 'medios_pago', 'grupos_categorias', 'categorias', 'movimientos', 'compras_cuotas',
                           'gastos_fijos', 'precios_fijo', 'pases', 'cuentas_rinden', 'metas_ahorro', 'aportes',
                           'horas_extras', 'viajes', 'viaje_miembros', 'viaje_gastos', 'ajustes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.es_miembro(espacio_id)) with check (public.es_miembro(espacio_id))', t || '_del_espacio', t);
  end loop;
end $$;

-- Permisos: sólo usuarios con sesión, y en las tablas de usuarios sólo las columnas que la app cambia
-- (así nadie puede "mudar" su fila de miembro a un espacio ajeno).
revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.perfiles, public.espacios from authenticated;
revoke insert, update on public.espacio_miembros from authenticated;
grant update (nombre, espacio_actual) on public.perfiles         to authenticated;
grant update (nombre, codigo)         on public.espacios         to authenticated;
grant update (persona_id)             on public.espacio_miembros to authenticated;

-- ---------------------------------------------------------------- alta automática al crear la cuenta
create or replace function public.alta_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare e uuid;
begin
  insert into public.perfiles (id, nombre) values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', ''));
  insert into public.espacios (creado_por) values (new.id) returning id into e;
  insert into public.espacio_miembros (espacio_id, usuario_id) values (e, new.id);
  update public.perfiles set espacio_actual = e where id = new.id;
  return new;
end $$;
revoke execute on function public.alta_usuario() from public, anon, authenticated;
create trigger al_crear_usuario after insert on auth.users for each row execute function public.alta_usuario();

-- ---------------------------------------------------------------- grupo familiar
-- Sumarse al espacio de otro con su código de invitación.
create or replace function public.unirse_a_espacio(p_codigo text, p_persona text, p_nombre text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e uuid; u uuid := (select auth.uid());
begin
  if u is null then raise exception 'sin_sesion'; end if;
  select id into e from public.espacios where codigo = upper(trim(p_codigo));
  if e is null then raise exception 'codigo_invalido'; end if;
  if p_persona !~ '^[A-Za-z0-9]{4,24}$' or length(trim(p_nombre)) = 0 then raise exception 'datos_invalidos'; end if;
  if (select count(*) from public.espacio_miembros where espacio_id = e) >= 12 then raise exception 'grupo_lleno'; end if;
  insert into public.personas (espacio_id, id, nombre, se_sumo_el, modificado_el, orden)
    values (e, p_persona, left(trim(p_nombre), 28), now(), now(),
            (select count(*) from public.personas where espacio_id = e))
    on conflict (espacio_id, id) do nothing;
  insert into public.espacio_miembros (espacio_id, usuario_id, persona_id) values (e, u, p_persona)
    on conflict (espacio_id, usuario_id) do update set persona_id = excluded.persona_id;
  update public.perfiles set espacio_actual = e where id = u;
  return e;
end $$;
revoke execute on function public.unirse_a_espacio(text, text, text) from public, anon;
grant  execute on function public.unirse_a_espacio(text, text, text) to authenticated;

-- Salir del grupo y volver al espacio propio. Lo que cargó queda en el grupo, con su nombre.
create or replace function public.salir_del_espacio() returns uuid
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); actual uuid; propio uuid; per text;
begin
  if u is null then raise exception 'sin_sesion'; end if;
  select espacio_actual into actual from public.perfiles where id = u;
  select id into propio from public.espacios where creado_por = u order by creado_el limit 1;
  if actual is null or actual = propio then return propio; end if;
  select persona_id into per from public.espacio_miembros where espacio_id = actual and usuario_id = u;
  update public.personas set fuera = true, modificado_el = now() where espacio_id = actual and id = per;
  delete from public.espacio_miembros where espacio_id = actual and usuario_id = u;
  update public.perfiles set espacio_actual = propio where id = u;
  return propio;
end $$;
revoke execute on function public.salir_del_espacio() from public, anon;
grant  execute on function public.salir_del_espacio() to authenticated;
