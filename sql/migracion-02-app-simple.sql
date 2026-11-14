-- Cuentas Claras · migración 2: la app más simple
-- Se sacaron las cuentas que rinden (TNA), las horas extras y los gastos de viaje.
-- Para una base que se creó con la versión anterior de esquema.sql.
alter table public.aportes      drop column cuenta_id;
alter table public.metas_ahorro drop column cuenta_id;
alter table public.movimientos  drop column viaje_id;
drop table public.viaje_gastos;
drop table public.viaje_miembros;
drop table public.viajes;
drop table public.horas_extras;
drop table public.cuentas_rinden;
