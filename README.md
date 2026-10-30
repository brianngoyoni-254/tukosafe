# TukoSafe

Go out. Have fun. Get home safe. React 19 + Vite + Tailwind 4 frontend on a Supabase backend
(Auth, Postgres with Row Level Security, Realtime, pg_cron, one Edge Function).

## Setup

1. Create a Supabase project. Auth > Providers > Email: keep "Confirm email" on.
   Auth > URL configuration: add your site URL (e.g. `http://localhost:5173`) and its `/reset-password` path.
2. Copy `.env.example` to `.env.local` and fill in the project URL and **anon** key.
   Never put the `service_role` key in the frontend.
3. Apply migrations:
   ```
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
   or paste `supabase/migrations/*.sql` in order into the SQL editor.
4. Database > Extensions: enable `pg_cron` and `pg_net`. `pg_cron` runs the overdue check-in scheduler and
   outing/share expiry every minute **on the server**, so alerts do not depend on any browser being open.
   Without `pg_cron` those jobs do not run.
5. `npm install && npm run dev`

## Notifications (in-app, web push, email, SMS)

In-app notifications work with no extra setup. Extra channels are optional, opt-in per user, and **unverified until
you configure providers and test them**. Every attempt is logged in `notification_deliveries` with an honest status:
`queued`, `sending`, `provider_accepted` (the provider took it; not proof it was read), `failed`, `not_configured`.
Email and SMS are used only for critical alerts (SOS, help request, missed check-in).

1. Generate VAPID keys: `npx web-push generate-vapid-keys`. Put the public key in `.env.local` as `VITE_VAPID_PUBLIC_KEY`.
2. Set the worker secrets (server side only):
   ```
   supabase secrets set DELIVERY_SECRET=<long random string> \
     VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com \
     RESEND_API_KEY=... EMAIL_FROM="TukoSafe <alerts@your-domain>" \
     AT_API_KEY=... AT_USERNAME=... AT_SENDER_ID=... AT_SANDBOX=false
   ```
   Leave any provider unset and its deliveries are recorded as `not_configured` (nothing is sent).
   Email uses Resend (verify your sending domain). SMS uses Africa's Talking (`AT_SANDBOX=true` with username `sandbox` for testing).
3. Deploy the worker: `supabase functions deploy deliver-notifications --no-verify-jwt`
4. Tell the database where the worker is (run once in the SQL editor, using the same secret):
   ```sql
   insert into app_settings (key, value) values
     ('delivery_url',    'https://<ref>.supabase.co/functions/v1/deliver-notifications'),
     ('delivery_secret', '<the same DELIVERY_SECRET>')
   on conflict (key) do update set value = excluded.value;
   ```
   New notifications then trigger the worker through `pg_net`, and a per-minute `pg_cron` job retries stragglers.
5. Users enable push/email/SMS under Profile > How you are notified.

Browser push is best effort. Browsers and phones can delay or drop it, and nothing arrives on a device that is off or offline.

## Commands

| What | Command |
| --- | --- |
| Lint | `npm run lint` |
| Production build | `npm run build` |
| Worker unit tests (fake providers) | `npm run test:unit` |
| Database tests (RLS, functions, 3 accounts, embedded Postgres) | `npm run test:db` |
| Browser tests (Playwright, stub auth server) | `npx playwright install chromium` then `npm run test:e2e` |
| Everything | `npm test` |

`test:db` needs no Docker or Supabase: it starts a throwaway Postgres and a small stand-in for Supabase's `auth` schema and roles.

### What the tests do and do not prove

- `test:db` exercises our real schema, RLS policies and functions as three separate users. It does not exercise GoTrue, PostgREST or Realtime.
- `test:e2e` runs the real app in Chromium against `e2e/mock-supabase.mjs`, a stub of Supabase Auth. It verifies our client's
  session storage (Remember Me), restart simulation, refresh, expiry, logout, route guards and per-browser isolation. It does
  not test real email delivery or GoTrue itself, and it cannot test cross-user flows (those are covered in SQL).
- Not covered by any automated test: live Realtime delivery between two real browsers, real push/email/SMS delivery, geolocation on a phone.
  Test those manually against a real Supabase project with two accounts.

## Security model

- Clients get `SELECT` filtered by RLS. Every write goes through a `SECURITY DEFINER` function that takes the actor from
  `auth.uid()` and re-checks authorization. Only an explicit allowlist of functions is executable by API roles
  (asserted in `supabase/tests/01_privacy.sql`); internal helpers that take arbitrary user ids are not callable.
- Trusted friend does not mean location access. Coordinates are readable only through an explicit, active, unexpired
  `location_shares` row naming the viewer.
- "Delivered" for an in-app alert means the recipient's device confirmed receipt. Provider statuses are shown as such.
- TukoSafe does not contact emergency services. 999 / 112 are `tel:` links.
