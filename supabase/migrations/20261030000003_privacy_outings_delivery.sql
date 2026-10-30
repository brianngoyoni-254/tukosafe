-- 1. Close the relationship/sharing "oracle": no client-callable function takes an arbitrary identity.
-- 2. Outing edit/delete/expiry.
-- 3. Multi-channel notification delivery (web push, email, SMS) with an auditable log.

-- ═════════════ 1. Privacy: replace two-identity helpers with caller-bound ones ═════════════
drop policy if exists profiles_select on public.profiles;
drop policy if exists outings_select on public.outings;
drop policy if exists outing_members_select on public.outing_members;
drop policy if exists live_locations_select on public.live_locations;
drop policy if exists alerts_select on public.sos_alerts;
drop policy if exists sos_recipients_select on public.sos_recipients;
drop policy if exists delivery_select on public.delivery_attempts;

drop function if exists public.shares_outing(uuid, uuid);
drop function if exists public.is_outing_participant(uuid, uuid);
drop function if exists public.is_alert_recipient(uuid, uuid);
drop function if exists public.is_alert_sender(uuid, uuid);
drop function if exists public.can_view_location(uuid, uuid);

-- Each helper answers only about the CALLER (auth.uid()), never about two arbitrary people,
-- and only about facts the caller is entitled to see anyway through RLS.
create or replace function public.i_trust(p_other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trusted_contacts where user_id = auth.uid() and contact_id = p_other)
$$;

create or replace function public.shares_outing_with_me(p_other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from outing_members x join outing_members y on x.outing_id = y.outing_id
    where x.user_id = auth.uid() and y.user_id = p_other
      and x.status in ('invited','accepted') and y.status in ('invited','accepted'))
$$;

create or replace function public.i_am_outing_participant(p_outing uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from outing_members where outing_id = p_outing and user_id = auth.uid()
                 and status in ('invited','accepted'))
      or exists (select 1 from outings where id = p_outing and host_id = auth.uid())
$$;

create or replace function public.i_am_alert_recipient(p_alert uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from sos_recipients where alert_id = p_alert and recipient_id = auth.uid())
$$;

create or replace function public.i_am_alert_sender(p_alert uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from sos_alerts where id = p_alert and sender_id = auth.uid())
$$;

create or replace function public.i_can_view_location(p_owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_owner = auth.uid() or exists (
    select 1 from location_shares s
    where s.owner_id = p_owner and s.viewer_id = auth.uid() and s.status = 'active' and s.expires_at > now())
$$;

create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or public.i_trust(id)
  or public.shares_outing_with_me(id)
  or exists (select 1 from friend_invitations i where i.status = 'pending'
             and ((i.invitee_id = auth.uid() and i.inviter_id = profiles.id)
               or (i.inviter_id = auth.uid() and i.invitee_id = profiles.id)))
  or exists (select 1 from sos_alerts a join sos_recipients r on r.alert_id = a.id
             where a.sender_id = profiles.id and r.recipient_id = auth.uid())
);
create policy outings_select on public.outings for select to authenticated
  using (host_id = auth.uid() or public.i_am_outing_participant(id));
create policy outing_members_select on public.outing_members for select to authenticated
  using (user_id = auth.uid() or public.i_am_outing_participant(outing_id));
create policy live_locations_select on public.live_locations for select to authenticated
  using (public.i_can_view_location(owner_id));
create policy alerts_select on public.sos_alerts for select to authenticated
  using (sender_id = auth.uid() or public.i_am_alert_recipient(id));
create policy sos_recipients_select on public.sos_recipients for select to authenticated
  using (recipient_id = auth.uid() or public.i_am_alert_sender(alert_id));
create policy delivery_select on public.delivery_attempts for select to authenticated
  using (recipient_id = auth.uid() or public.i_am_alert_sender(alert_id));

-- A blocked inviter must not learn they are blocked: return a plausible id, store nothing.
create or replace function public.send_invitation(p_email text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user(); v_email text := lower(trim(p_email)); v_target uuid; v_id uuid;
begin
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'Enter a valid email address.'; end if;
  select id into v_target from profiles where lower(email) = v_email;
  if v_target = v_me then raise exception 'You cannot invite yourself.'; end if;
  if v_target is not null and is_trusted(v_me, v_target) then raise exception 'You are already trusted friends.'; end if;
  if v_target is not null and is_blocked_between(v_me, v_target) then return gen_random_uuid(); end if;
  if exists (select 1 from friend_invitations where inviter_id = v_me and lower(invitee_email) = v_email and status = 'pending') then
    raise exception 'An invitation to this address is already pending.';
  end if;
  insert into friend_invitations (inviter_id, invitee_email, invitee_id)
  values (v_me, v_email, v_target) returning id into v_id;
  if v_target is not null then
    perform notify(v_target, 'friend_invitation', 'Trusted-friend invitation',
                   display_name_of(v_me) || ' invited you to be a trusted friend.',
                   jsonb_build_object('invitation_id', v_id, 'from', v_me));
  end if;
  return v_id;
end $$;

-- Lock EXECUTE down to an explicit allowlist. Anything not listed is internal.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.i_trust(uuid), public.shares_outing_with_me(uuid), public.i_am_outing_participant(uuid),
  public.i_am_alert_recipient(uuid), public.i_am_alert_sender(uuid), public.i_can_view_location(uuid)
  to authenticated;   -- RLS policy helpers; caller-bound

-- ═════════════ 2. Outings: edit / delete / expiry ═════════════
alter table public.outing_members drop constraint if exists outing_members_status_check;
alter table public.outing_members add constraint outing_members_status_check
  check (status in ('invited','accepted','declined','left','removed','expired'));

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'friend_invitation','invitation_accepted','message','sos','help_request','sos_acknowledged',
  'checkin','missed_checkin','arrived','outing_invitation','outing_update','outing_cancelled','location_share'));

create or replace function public.respond_outing(p_outing uuid, p_accept boolean, p_share_location boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user(); v_host uuid;
begin
  update outing_members m set status = case when p_accept then 'accepted' else 'declined' end,
         shares_location = p_accept and coalesce(p_share_location, false), responded_at = now()
  where m.outing_id = p_outing and m.user_id = v_me and m.status = 'invited'
    and exists (select 1 from outings o where o.id = p_outing and o.status = 'active' and o.ends_at > now());
  if not found then raise exception 'This invitation has expired or is no longer open.'; end if;
  select host_id into v_host from outings where id = p_outing;
  perform notify(v_host, 'outing_invitation', display_name_of(v_me) || case when p_accept then ' joined' else ' declined' end || ' your outing',
                 null, jsonb_build_object('outing_id', p_outing, 'from', v_me));
  perform sync_outing_shares(p_outing);
  perform audit(v_me, 'outing.responded', jsonb_build_object('outing', p_outing, 'accept', p_accept, 'share', p_share_location));
end $$;

create or replace function public.end_outing(p_outing uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user();
begin
  update outings set status = 'ended', ended_at = now() where id = p_outing and host_id = v_me and status = 'active';
  if not found then raise exception 'Outing not found or already ended.'; end if;
  update outing_members set status = 'expired' where outing_id = p_outing and status = 'invited';
  perform sync_outing_shares(p_outing);
  perform audit(v_me, 'outing.ended', jsonb_build_object('outing', p_outing));
end $$;

create or replace function public.update_outing(p_outing uuid, p_title text, p_venue text,
                                                p_starts timestamptz, p_ends timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user(); v_m record;
begin
  if p_ends <= p_starts then raise exception 'The outing must end after it starts.'; end if;
  if p_ends <= now() then raise exception 'The end time is in the past.'; end if;
  update outings set title = trim(p_title), venue = trim(p_venue), starts_at = p_starts, ends_at = p_ends
  where id = p_outing and host_id = v_me and status = 'active';
  if not found then raise exception 'Only the host can edit an active outing.'; end if;
  -- Sharing windows follow the outing end time.
  update location_shares set expires_at = p_ends
  where outing_id = p_outing and status in ('active','paused');
  for v_m in select user_id from outing_members where outing_id = p_outing and user_id <> v_me and status in ('invited','accepted') loop
    perform notify(v_m.user_id, 'outing_update', 'Outing updated', trim(p_title) || ' at ' || trim(p_venue),
                   jsonb_build_object('outing_id', p_outing, 'from', v_me));
  end loop;
end $$;

create or replace function public.delete_outing(p_outing uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user(); v_o outings%rowtype; v_m record; v_ids uuid[]; v_u uuid;
begin
  select * into v_o from outings where id = p_outing and host_id = v_me for update;
  if not found then raise exception 'Only the host can delete an outing.'; end if;
  for v_m in select user_id from outing_members where outing_id = p_outing and user_id <> v_me and status in ('invited','accepted') loop
    perform notify(v_m.user_id, 'outing_cancelled', 'Outing cancelled', '"' || v_o.title || '" was cancelled by the host.',
                   jsonb_build_object('from', v_me));
  end loop;
  select coalesce(array_agg(user_id), '{}') into v_ids from outing_members where outing_id = p_outing;
  delete from outings where id = p_outing;   -- cascades members + outing shares
  foreach v_u in array v_ids loop perform cleanup_location(v_u); end loop;
  perform audit(v_me, 'outing.deleted', jsonb_build_object('outing', p_outing));
end $$;

create or replace function public.expire_stale() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  update location_shares set status = 'expired', stopped_at = now()
  where status in ('active','paused') and expires_at <= now();
  update outing_members set status = 'expired'
  where status = 'invited' and outing_id in (select id from outings where status = 'ended' or ends_at <= now());
  update outings set status = 'ended', ended_at = now() where status = 'active' and ends_at <= now();
  for r in select distinct owner_id from live_locations loop perform cleanup_location(r.owner_id); end loop;
end $$;

grant execute on function
  public.update_outing(uuid, text, text, timestamptz, timestamptz), public.delete_outing(uuid),
  public.respond_outing(uuid, boolean, boolean), public.end_outing(uuid), public.send_invitation(text)
  to authenticated;

-- ═════════════ 3. Notification delivery ═════════════
create table public.notification_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push boolean not null default true,
  email boolean not null default false,
  sms boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count int not null default 0
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- One row per (notification, channel). Honest statuses:
--   queued            waiting for the delivery worker
--   sending           claimed by the worker
--   provider_accepted the push service / email API / SMS gateway accepted it (NOT proof it reached a person)
--   failed            provider rejected it or retries ran out
--   not_configured    no provider credentials on the server; nothing was sent
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('push','email','sms')),
  status text not null default 'queued' check (status in ('queued','sending','provider_accepted','failed','not_configured')),
  provider_ref text,
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, channel)
);
create index notification_deliveries_queue_idx on public.notification_deliveries (created_at) where status in ('queued','sending');

-- Worker configuration (function URL + shared secret). Not readable by clients.
create table public.app_settings (key text primary key, value text not null);

alter table public.notification_prefs enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.app_settings enable row level security;

revoke all on public.notification_prefs, public.push_subscriptions, public.notification_deliveries, public.app_settings
  from anon, authenticated;
grant select on public.notification_prefs to authenticated;
grant select (id, user_id, created_at, last_success_at) on public.push_subscriptions to authenticated;
-- Senders may see channel + status of deliveries for their own alerts; never endpoints, errors or refs.
grant select (id, notification_id, user_id, channel, status, updated_at) on public.notification_deliveries to authenticated;

create policy prefs_select on public.notification_prefs for select to authenticated using (user_id = auth.uid());
create policy subs_select on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy deliveries_select on public.notification_deliveries for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from delivery_attempts da
             where da.notification_id = notification_deliveries.notification_id and public.i_am_alert_sender(da.alert_id)));

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user();
begin
  if p_endpoint !~ '^https://' then raise exception 'Invalid push endpoint.'; end if;
  insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (v_me, p_endpoint, p_p256dh, p_auth, left(p_ua, 300))
  on conflict (endpoint) do update set user_id = v_me, p256dh = excluded.p256dh, auth = excluded.auth,
    user_agent = excluded.user_agent, failure_count = 0;
  insert into notification_prefs (user_id, push) values (v_me, true)
  on conflict (user_id) do update set push = true, updated_at = now();
end $$;

create or replace function public.remove_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid()
$$;

create or replace function public.set_notification_prefs(p_push boolean, p_email boolean, p_sms boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user();
begin
  if p_sms and coalesce((select phone from profiles where id = v_me), '') = '' then
    raise exception 'Add a phone number to your profile before enabling SMS.';
  end if;
  insert into notification_prefs (user_id, push, email, sms) values (v_me, p_push, p_email, p_sms)
  on conflict (user_id) do update set push = excluded.push, email = excluded.email, sms = excluded.sms, updated_at = now();
  perform audit(v_me, 'notifications.prefs', jsonb_build_object('push', p_push, 'email', p_email, 'sms', p_sms));
end $$;

-- Tell the worker there is work. Failure here must never block the notification itself.
create or replace function public.kick_delivery() returns void
language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  select value into v_url from app_settings where key = 'delivery_url';
  select value into v_secret from app_settings where key = 'delivery_secret';
  if v_url is null or v_secret is null or to_regproc('net.http_post') is null then return; end if;
  execute format('select net.http_post(url := %L, body := %L::jsonb, headers := %L::jsonb)',
    v_url, '{}', jsonb_build_object('Content-Type', 'application/json', 'x-delivery-secret', v_secret)::text);
exception when others then
  raise warning 'kick_delivery failed: %', sqlerrm;
end $$;

create or replace function public.enqueue_deliveries() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pref notification_prefs%rowtype; v_critical boolean; v_phone text; v_any boolean := false;
begin
  v_critical := new.type in ('sos','help_request','missed_checkin');
  select * into v_pref from notification_prefs where user_id = new.user_id;
  if not found then v_pref.push := true; v_pref.email := false; v_pref.sms := false; end if;

  if v_pref.push and exists (select 1 from push_subscriptions where user_id = new.user_id) then
    insert into notification_deliveries (notification_id, user_id, channel) values (new.id, new.user_id, 'push');
    v_any := true;
  end if;
  -- Email and SMS are limited to critical alerts (cost, privacy) and need explicit opt-in.
  if v_critical and v_pref.email then
    insert into notification_deliveries (notification_id, user_id, channel) values (new.id, new.user_id, 'email');
    v_any := true;
  end if;
  select phone into v_phone from profiles where id = new.user_id;
  if v_critical and v_pref.sms and coalesce(v_phone, '') <> '' then
    insert into notification_deliveries (notification_id, user_id, channel) values (new.id, new.user_id, 'sms');
    v_any := true;
  end if;
  if v_any then perform kick_delivery(); end if;
  return new;
end $$;
drop trigger if exists notifications_enqueue on public.notifications;
create trigger notifications_enqueue after insert on public.notifications
  for each row execute function public.enqueue_deliveries();

-- Worker API: service_role only (the Edge Function uses the service key server-side).
create or replace function public.claim_deliveries(p_limit int default 25) returns table (
  id uuid, channel text, attempts int, type text, title text, body text, data jsonb,
  email text, phone text, subscriptions jsonb)
language plpgsql security definer set search_path = public as $$
begin
  update notification_deliveries set status = 'queued' where status = 'sending' and updated_at < now() - interval '5 minutes';
  return query
  with c as (
    select d.id from notification_deliveries d where d.status = 'queued'
    order by d.created_at limit p_limit for update skip locked)
  , u as (
    update notification_deliveries d set status = 'sending', attempts = d.attempts + 1, updated_at = now()
    from c where d.id = c.id returning d.*)
  select u.id, u.channel, u.attempts, n.type, n.title, n.body, n.data, p.email, p.phone,
         case when u.channel = 'push' then
           (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]'::jsonb)
            from push_subscriptions s where s.user_id = u.user_id)
         else '[]'::jsonb end
  from u join notifications n on n.id = u.notification_id join profiles p on p.id = u.user_id;
end $$;

create or replace function public.finish_delivery(p_id uuid, p_status text, p_ref text, p_error text, p_retry boolean default false)
returns void language sql security definer set search_path = public as $$
  update notification_deliveries set
    status = case when p_retry and attempts < 3 then 'queued' else p_status end,
    provider_ref = p_ref, error = left(p_error, 500), updated_at = now()
  where id = p_id
$$;

create or replace function public.record_push_result(p_subscription uuid, p_ok boolean, p_gone boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_gone then
    delete from push_subscriptions where id = p_subscription;        -- 404/410: browser unsubscribed
  elsif p_ok then
    update push_subscriptions set last_success_at = now(), failure_count = 0 where id = p_subscription;
  else
    update push_subscriptions set failure_count = failure_count + 1 where id = p_subscription;
    delete from push_subscriptions where id = p_subscription and failure_count >= 5;
  end if;
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.i_trust(uuid), public.shares_outing_with_me(uuid), public.i_am_outing_participant(uuid),
  public.i_am_alert_recipient(uuid), public.i_am_alert_sender(uuid), public.i_can_view_location(uuid)
  to authenticated;
grant execute on function
  public.send_invitation(text), public.respond_invitation(uuid, boolean), public.cancel_invitation(uuid),
  public.remove_contact(uuid), public.block_user(uuid), public.unblock_user(uuid),
  public.update_contact_prefs(uuid, boolean, boolean), public.list_blocked(),
  public.send_message(uuid, text, uuid), public.mark_messages_delivered(), public.mark_conversation_read(uuid),
  public.start_location_share(uuid[], int), public.set_share_status(uuid, text),
  public.push_location(double precision, double precision, double precision, double precision),
  public.create_outing(text, text, timestamptz, timestamptz, uuid[]), public.invite_to_outing(uuid, uuid),
  public.respond_outing(uuid, boolean, boolean), public.set_outing_consent(uuid, boolean),
  public.leave_outing(uuid), public.remove_outing_member(uuid, uuid), public.end_outing(uuid),
  public.update_outing(uuid, text, text, timestamptz, timestamptz), public.delete_outing(uuid),
  public.create_return_plan(text, timestamptz, int, uuid[]), public.start_return_plan(uuid),
  public.plan_checkin(uuid, text), public.arrive_safely(uuid), public.cancel_return_plan(uuid),
  public.create_alert(text, text, uuid[], double precision, double precision, double precision, uuid),
  public.ack_alert(uuid), public.close_alert(uuid, text), public.delete_my_account(),
  public.save_push_subscription(text, text, text, text), public.remove_push_subscription(text),
  public.set_notification_prefs(boolean, boolean, boolean)
  to authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.claim_deliveries(int), public.finish_delivery(uuid, text, text, text, boolean),
      public.record_push_result(uuid, boolean, boolean) to service_role;
  end if;
end $$;

alter publication supabase_realtime add table public.notification_deliveries;

do $$
begin
  perform cron.schedule('tukosafe-deliver', '* * * * *', 'select public.kick_delivery()');
exception when others then
  raise warning 'pg_cron unavailable (%). Schedule public.kick_delivery() every minute.', sqlerrm;
end $$;
