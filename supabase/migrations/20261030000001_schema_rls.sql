-- TukoSafe core schema + Row Level Security.
-- All sensitive writes go through SECURITY DEFINER functions (see 0002).
-- Clients get SELECT (restricted by RLS) and a few narrow column-level UPDATEs.

create extension if not exists pgcrypto;

-- ───────────────────────── Profiles ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null check (char_length(display_name) between 2 and 80),
  phone text,
  created_at timestamptz not null default now()
);
create unique index profiles_email_key on public.profiles (lower(email));

-- ───────────────────────── Trust graph ─────────────────────────
create table public.friend_invitations (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_email text not null,
  invitee_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create unique index friend_invitations_pending_key
  on public.friend_invitations (inviter_id, lower(invitee_email)) where status = 'pending';
create index friend_invitations_invitee_idx on public.friend_invitations (invitee_id) where status = 'pending';

-- Symmetric: accepting creates two rows. Flags are per direction:
-- row (user_id=A, contact_id=B) says whether B receives A's SOS / check-in alerts.
create table public.trusted_contacts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null references public.profiles(id) on delete cascade,
  receives_sos boolean not null default true,
  receives_checkins boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, contact_id),
  check (user_id <> contact_id)
);
create index trusted_contacts_contact_idx on public.trusted_contacts (contact_id);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- ───────────────────────── Messaging ─────────────────────────
-- A conversation is the (sender, recipient) pair; no separate table is needed.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  client_id uuid not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,   -- set by the recipient's client when it receives the row
  read_at timestamptz,        -- set when the recipient opens the conversation
  unique (sender_id, client_id),
  check (sender_id <> recipient_id)
);
create index messages_pair_idx on public.messages (sender_id, recipient_id, created_at desc);
create index messages_recipient_idx on public.messages (recipient_id, created_at desc);
create index messages_unread_idx on public.messages (recipient_id) where read_at is null;

-- ───────────────────────── Notifications ─────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in (
    'friend_invitation','invitation_accepted','message','sos','help_request','sos_acknowledged',
    'checkin','missed_checkin','arrived','outing_invitation','location_share')),
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- ───────────────────────── Outings ─────────────────────────
create table public.outings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  venue text not null check (char_length(venue) between 1 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active','ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  check (ends_at > starts_at)
);
create index outings_host_idx on public.outings (host_id);

create table public.outing_members (
  outing_id uuid not null references public.outings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited','accepted','declined','left','removed')),
  shares_location boolean not null default false,
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (outing_id, user_id)
);
create index outing_members_user_idx on public.outing_members (user_id);

-- ───────────────────────── Location sharing ─────────────────────────
-- Being a trusted contact grants NOTHING here. Access exists only while a row
-- is active, unexpired, and names the viewer. One row per (owner, viewer).
create table public.location_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  outing_id uuid references public.outings(id) on delete cascade,
  status text not null default 'active' check (status in ('active','paused','stopped','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  stopped_at timestamptz,
  check (owner_id <> viewer_id)
);
create index location_shares_owner_idx on public.location_shares (owner_id) where status in ('active','paused');
create index location_shares_viewer_idx on public.location_shares (viewer_id) where status = 'active';

-- Latest position only (no history is kept).
create table public.live_locations (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy double precision check (accuracy >= 0),
  heading double precision,
  updated_at timestamptz not null default now()
);

-- ───────────────────────── Return-home plans ─────────────────────────
create table public.return_home_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  destination text not null check (char_length(destination) between 1 and 200),
  expected_arrival timestamptz not null,
  grace_minutes int not null default 15 check (grace_minutes between 0 and 240),
  notify_ids uuid[] not null default '{}',
  status text not null default 'planned' check (status in ('planned','active','arrived','cancelled','overdue')),
  started_at timestamptz,
  arrived_at timestamptz,
  overdue_alerted_at timestamptz,
  created_at timestamptz not null default now()
);
create index return_home_user_idx on public.return_home_plans (user_id, created_at desc);
create index return_home_overdue_idx on public.return_home_plans (expected_arrival) where status = 'active';

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.return_home_plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index checkins_plan_idx on public.checkins (plan_id, created_at desc);

-- ───────────────────────── SOS / help requests ─────────────────────────
create table public.sos_alerts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'sos' check (kind in ('sos','help_request')),
  status text not null default 'active' check (status in ('active','resolved','cancelled')),
  message text check (char_length(message) <= 1000),
  -- Only populated when the sender explicitly chose to include location.
  lat double precision,
  lng double precision,
  accuracy double precision,
  client_id uuid not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (sender_id, client_id)
);
create index sos_alerts_sender_idx on public.sos_alerts (sender_id, created_at desc);

create table public.sos_recipients (
  alert_id uuid not null references public.sos_alerts(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  acknowledged_at timestamptz,
  primary key (alert_id, recipient_id)
);
create index sos_recipients_recipient_idx on public.sos_recipients (recipient_id);

-- One row per recipient notification. 'recorded' = in our DB; 'delivered' = the
-- recipient's device confirmed receipt. No SMS/email/push provider is connected.
create table public.delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.sos_alerts(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete set null,
  channel text not null default 'in_app' check (channel in ('in_app')),
  status text not null default 'recorded' check (status in ('recorded','delivered','failed')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create index delivery_attempts_alert_idx on public.delivery_attempts (alert_id);

-- ───────────────────────── Audit ─────────────────────────
create table public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_user_idx on public.audit_log (user_id, created_at desc);

-- ───────────────────────── Privileges ─────────────────────────
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant update (display_name, phone) on public.profiles to authenticated;
grant update (read_at, delivered_at) on public.notifications to authenticated;
-- anon gets nothing: every table requires a signed-in user.

alter table public.profiles enable row level security;
alter table public.friend_invitations enable row level security;
alter table public.trusted_contacts enable row level security;
alter table public.blocks enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.outings enable row level security;
alter table public.outing_members enable row level security;
alter table public.location_shares enable row level security;
alter table public.live_locations enable row level security;
alter table public.return_home_plans enable row level security;
alter table public.checkins enable row level security;
alter table public.sos_alerts enable row level security;
alter table public.sos_recipients enable row level security;
alter table public.delivery_attempts enable row level security;
alter table public.audit_log enable row level security;

-- Helper predicates used by policies. SECURITY DEFINER so they bypass RLS and
-- cannot cause policy recursion.
create or replace function public.is_trusted(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trusted_contacts where user_id = a and contact_id = b)
$$;

create or replace function public.shares_outing(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from outing_members x join outing_members y on x.outing_id = y.outing_id
    where x.user_id = a and y.user_id = b
      and x.status in ('invited','accepted') and y.status in ('invited','accepted'))
$$;

create or replace function public.is_outing_participant(o uuid, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from outing_members where outing_id = o and user_id = u and status in ('invited','accepted'))
     or exists (select 1 from outings where id = o and host_id = u)
$$;

create or replace function public.is_alert_recipient(a uuid, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from sos_recipients where alert_id = a and recipient_id = u)
$$;

create or replace function public.is_alert_sender(a uuid, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from sos_alerts where id = a and sender_id = u)
$$;

create or replace function public.can_view_location(p_owner uuid, p_viewer uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_owner = p_viewer or exists (
    select 1 from location_shares s
    where s.owner_id = p_owner and s.viewer_id = p_viewer
      and s.status = 'active' and s.expires_at > now())
$$;

-- profiles: yourself, trusted contacts, pending-invite counterparts, outing co-members.
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or public.is_trusted(auth.uid(), id)
  or public.shares_outing(auth.uid(), id)
  or exists (select 1 from friend_invitations i where i.status = 'pending'
             and ((i.invitee_id = auth.uid() and i.inviter_id = profiles.id)
               or (i.inviter_id = auth.uid() and i.invitee_id = profiles.id)))
  or exists (select 1 from sos_alerts a join sos_recipients r on r.alert_id = a.id
             where a.sender_id = profiles.id and r.recipient_id = auth.uid())
);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy invitations_select on public.friend_invitations for select to authenticated
  using (inviter_id = auth.uid() or invitee_id = auth.uid());

create policy trusted_select on public.trusted_contacts for select to authenticated
  using (user_id = auth.uid() or contact_id = auth.uid());

create policy blocks_select on public.blocks for select to authenticated using (blocker_id = auth.uid());

create policy messages_select on public.messages for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy outings_select on public.outings for select to authenticated
  using (host_id = auth.uid() or public.is_outing_participant(id, auth.uid()));
create policy outing_members_select on public.outing_members for select to authenticated
  using (user_id = auth.uid() or public.is_outing_participant(outing_id, auth.uid()));

create policy shares_select on public.location_shares for select to authenticated
  using (owner_id = auth.uid() or (viewer_id = auth.uid() and status = 'active' and expires_at > now()));

-- Coordinates: owner, or a viewer with an active, unexpired, explicit share.
create policy live_locations_select on public.live_locations for select to authenticated
  using (public.can_view_location(owner_id, auth.uid()));

create policy plans_select on public.return_home_plans for select to authenticated
  using (user_id = auth.uid() or auth.uid() = any (notify_ids));
create policy checkins_select on public.checkins for select to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from return_home_plans p where p.id = plan_id and auth.uid() = any (p.notify_ids)));

create policy alerts_select on public.sos_alerts for select to authenticated
  using (sender_id = auth.uid() or public.is_alert_recipient(id, auth.uid()));
create policy sos_recipients_select on public.sos_recipients for select to authenticated
  using (recipient_id = auth.uid() or public.is_alert_sender(alert_id, auth.uid()));
create policy delivery_select on public.delivery_attempts for select to authenticated
  using (recipient_id = auth.uid() or public.is_alert_sender(alert_id, auth.uid()));

create policy audit_select on public.audit_log for select to authenticated using (user_id = auth.uid());
