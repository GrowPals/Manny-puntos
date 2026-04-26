# Supabase Snapshot — manny puntos

Snapshot tomado antes de eliminar el proyecto Supabase para ahorrar costos.

- **Proyecto eliminado:** `manny puntos` (ref `kuftyqupibyjliaukpxn`, region `us-east-1`)
- **Postgres:** 17.6.1.025
- **Estado al momento del snapshot:** ACTIVE_HEALTHY, 28 objetos en schema `public` (24 tablas + 4 vistas), 25 edge functions, 10 migrations aplicadas, 0 usuarios en `auth.users`, 1 bucket de storage (`recompensas`, 3 objetos).

## Contenido

| Archivo | Qué contiene |
|---|---|
| `schema-public.sql` | DDL completo del schema `public`: tablas, vistas, funciones (RPCs), triggers, RLS policies, índices, constraints, secuencias, tipos. |
| `roles.sql` | Custom roles a nivel cluster. |
| `data.sql` | Datos (`pg_dump --data-only`) — ~1101 filas. Restaurar con `--disable-triggers` para evitar conflictos de FK. |
| `migrations-applied.txt` | Lista de las 10 migrations que estaban aplicadas en el momento del snapshot. |
| `storage-recompensas/` | 3 archivos del bucket público `recompensas` (~2.3 MB, banners de regalos). |

Las 25 edge functions se descargaron a `../functions/` (ahí también deben vivir para redeploy).

## Cómo restaurar en un proyecto nuevo

1. Crear nuevo proyecto en Supabase.
2. Linkear: `supabase link --project-ref <NUEVO_REF>`.
3. Aplicar schema:
   ```bash
   supabase db push --include-all                       # opción A: usa /supabase/migrations
   psql "$DATABASE_URL" -f supabase/snapshot/schema-public.sql   # opción B: aplicar dump directo
   ```
4. (Opcional) Cargar datos: `psql "$DATABASE_URL" --single-transaction --set ON_ERROR_STOP=on -f supabase/snapshot/data.sql` (puede requerir `SET session_replication_role = replica;` para saltarse triggers/FKs durante la carga).
5. Redeploy edge functions: `supabase functions deploy --project-ref <NUEVO_REF>`.
6. Crear bucket `recompensas` (público) y resubir archivos de `storage-recompensas/`.
7. Reconfigurar secrets/env vars (ver `.env.example`).

## Lo que NO se guarda en este snapshot

- Usuarios de `auth.users` (estaba en 0 de todos modos).
- Cron jobs configurados vía dashboard (ver `pg_cron` jobs si los había).
- Webhooks/queues configurados fuera de migrations.
- Secrets de edge functions (hay que reconfigurarlos en el nuevo proyecto).
