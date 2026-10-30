# TukoSafe

Go out. Have fun. Get home safe. React 19 + Vite + Tailwind 4 frontend on a Supabase backend
(Auth, Postgres with Row Level Security, Realtime, pg_cron).

## Setup

1. Create a Supabase project. Auth > Providers > Email: keep "Confirm email" on.
   Auth > URL configuration: add your site URL (e.g. `http://localhost:5173`) and `/reset-password`.
2. Copy `.env.example` to `.env.local` and fill in the project URL and **anon** key.
   Never put the `service_role` key in the frontend.
3. Apply the migrations (either way):
   ```
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
   or paste `supabase/migrations/*.sql` in order into the SQL editor.
4. Database > Extensions: enable `pg_cron` (the migration tries to enable it and schedules
   `process_overdue_plans()` and `expire_stale()` every minute). Without it, overdue check-ins
   will NOT fire when the browser is closed.
5. `npm install && npm run dev`

## Tests

- Backend (RLS + functions, three accounts, rolls back): 
  `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/multi_user.sql`
  Use a local/dev database, not production.
- Frontend: `npm run lint` and `npm run build`.

## Security model

- Clients only get `SELECT` (filtered by RLS). Every write goes through a `SECURITY DEFINER`
  function that derives the user from `auth.uid()` and re-checks authorization.
- Trusted friend != location access. Coordinates are readable only through an explicit,
  active, unexpired `location_shares` row naming the viewer.
- Alerts reach friends inside TukoSafe only. No SMS/email/WhatsApp/push provider is connected,
  and the UI says so. "Delivered" means the recipient's device confirmed receipt.
- TukoSafe does not contact emergency services. 999 / 112 are `tel:` links.
