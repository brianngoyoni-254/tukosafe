# TukoSafe

**Go out. Have fun. Get home safe.**

## The problem

Going out at night should be fun, but safety apps often make it stressful:

- **Panic buttons trigger chaos.** One press blasts alerts to everyone with no context, so friends panic or ignore it.
- **Location sharing never turns off.** Once you share, you're tracked indefinitely - or you forget to stop sharing.
- **AI decides for you.** Bots auto-message responders without your approval, and you can't turn them off.
- **One-size-fits-all look.** Bright, clinical colours that feel like a hospital, not a night out with friends.
- **No safe way to ask for help quietly.** If you feel unsafe, there's no discreet, calm way to tell a friend.

## The solution

TukoSafe is a people-first safety companion built around one principle: **AI assists, people decide.**

- **Quiet SOS** - press and hold to alert contacts immediately, with context so they know what to do.
- **Opt-in, expiring sharing** - friends share location for one night only, and anyone can leave at any time.
- **Human-centred AI** - AI only drafts and suggests. You always review, edit, and send. Every AI feature has a plain fallback.
- **Four safe, clean colour themes** - Harbor, Grove, Coast, Ember - that blend with the shield logo and match your mood.
- **Calm, human design** - soft edges, gentle animations, and a shield logo of hands cradling a growing tree.

> From the Swahili *tuko salama* - "we are safe."

TukoSafe is a prototype for looking out for friends on nights out in Kenya. Notifying friends is not dispatching responders - call 999 or 112 in an emergency.

## What it does

- **Create an outing** - pick friends, a time window, and a return-home plan. Sharing expires on its own.
- **Opt-in check-ins** - friends agree to share location; anyone can leave at any time.
- **Quiet SOS** - press and hold to alert contacts immediately; no noisy panic.
- **Get Me Home** - send a calm, pre-approved message to friends when you're on your way back.
- **Live map** - see where your friends are (only while they've consented and sharing is active).
- **Trust Panel** - see who has consented, who's joined, and who's been told first.
- **Safety resources** - emergency numbers (999, 112, 1195, 116) and a before-you-go checklist.

## Design

TukoSafe is built to feel safe, clean, and human - a direct answer to the problems above:

- **Four colour themes** that blend with the shield logo - Harbor (deep blue trust), Grove (forest green safe haven), Coast (teal calm), Ember (warm terracotta connection). Pick one in the theme dropdown; your choice is remembered.
- **Logo** - a protection shield with two hands cradling a growing tree, used across the header, footer, mobile dock, and browser tab.
- **Human-centred AI** - AI only drafts and suggests; you always review, edit, and send. Every AI feature has a plain fallback, so help is never blocked by AI being off.
- **Safety first** - SOS red stays red regardless of theme. Notifying friends is not dispatching responders; this is a prototype, not an emergency service.

## Tech stack

React 19 + Vite + Tailwind 4 frontend on a Supabase backend (Auth, Postgres with Row Level Security, Realtime, pg_cron, one Edge Function).

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
