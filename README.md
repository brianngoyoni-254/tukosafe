# TukoSafe

Go out. Have fun. Get home safe. React 19 + Vite + Tailwind 4 frontend on a Supabase backend
(Auth, Postgres with Row Level Security, Realtime, pg_cron, one Edge Function).

## Setup

1. Create a Supabase project (supabase.com > New project).
2. Connect the frontend. Open `.env.local` (a placeholder file is already there; it is git-ignored) and set:
   - `VITE_SUPABASE_URL` = *Project Settings > API > Project URL*
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = *Project Settings > API > publishable / anon public key*
     (`VITE_SUPABASE_ANON_KEY` also works for older projects; the publishable name wins if both are set)

   Never use the `service_role` / secret key here: anything prefixed `VITE_` is sent to every browser.
   The app refuses to start sign-in if it detects one, and tells you why.
3. Dashboard settings you must do by hand (no code can do these for you):
   - **Authentication > Sign In / Providers > Email**: enabled, **Confirm email = ON**, sign-ups not disabled.
   - **Authentication > URL Configuration**: *Site URL* = your site (e.g. `http://localhost:5173` while developing) and add
     *Redirect URLs*: `http://localhost:5173/login` and `http://localhost:5173/reset-password` (plus your production
     equivalents). Without these, verification and password-reset links land on the wrong page or are rejected.
   - **Authentication > Emails**: for real use, configure custom SMTP. Supabase's built-in mailer is heavily rate-limited
     and only meant for testing.
4. Apply migrations:
   ```
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
   or paste `supabase/migrations/*.sql` in order into the SQL editor.
5. Database > Extensions: enable `pg_cron` and `pg_net`. `pg_cron` runs the overdue check-in scheduler and
   outing/share expiry every minute **on the server**, so alerts do not depend on any browser being open.
   Without `pg_cron` those jobs do not run.
6. `npm install`, restart the dev server (Vite only reads `.env.local` at start-up), then verify the connection:

   ```sh
   npm run check:supabase   # validates your settings and probes the live project (auth settings, migrations, RLS)
   npm run dev
   ```

   `check:supabase` uses only the public key. It reports exactly what is missing: wrong URL/key, sign-ups disabled,
   email confirmation off, migrations not applied, or functions callable by anonymous visitors.

Sign-in behaviour: **Remember me** checked keeps the session in `localStorage` (survives closing the browser); unchecked
keeps it in `sessionStorage` (gone when the browser session ends). Registration sends a confirmation email; opening the
link signs the user in. A profile row is created by a database trigger at registration (and `ensure_profile()` repairs it
if it is ever missing).

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
