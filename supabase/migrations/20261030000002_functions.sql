-- TukoSafe backend logic. Every client-callable function is SECURITY DEFINER,
-- derives the actor from auth.uid() (never from a parameter) and validates
-- authorization itself. Execute rights are granted only to `authenticated`.

-- ───────────────────────── Internal helpers ─────────────────────────
create or replace function public.audit(p_user uuid, p_action text, p_details jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into audit_log (user_id, action, details) values (p_user, p_action, coalesce(p_details, '{}'::jsonb))
$$;

create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text default null,
                                         p_data jsonb default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into notifications (user_id, type, title, body, data)
  values (p_user, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.require_user() returns uuid
language plpgsql stable as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  return auth.uid();
end $$;

create or replace function public.display_name_of(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select display_name from profiles where id = p_user
$$;

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

-- Remove the location row if the owner has no live (active/paused) share left.
create or replace function public.cleanup_location(p_owner uuid) returns void
language sql security definer set search_path = public as $$
  delete from live_locations l where l.owner_id = p_owner
    and not exists (select 1 from location_shares s where s.owner_id = p_owner and s.status in ('active','paused'))
$$;

-- ───────────────────────── Signup trigger ─────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text; v_inv record;
begin
  v_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  if v_name is null or char_length(v_name) < 2 then v_name := split_part(new.email, '@', 1); end if;
  if char_length(v_name) < 2 then v_name := v_name || '_'; end if;
  insert into profiles (id, email, display_name, phone)
  values (new.id, lower(new.email), left(v_name, 80), nullif(new.raw_user_meta_data ->> 'phone', ''));

  -- Attach invitations that were sent to this address before the account existed.
  for v_inv in
    update friend_invitations set invitee_id = new.id
    where invitee_id is null and lower(invitee_email) = lower(new.email) and status = 'pending'
    returning id, inviter_id
  loop
    perform notify(new.id, 'friend_invitation', 'Trusted-friend invitation',
                   display_name_of(v_inv.inviter_id) || ' invited you to be a trusted friend.',
                   jsonb_build_object('invitation_id', v_inv.id, 'from', v_inv.inviter_id));
  end loop;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── Trust graph ─────────────────────────
create or replace function public.send_invitation(p_email text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user(); v_email text := lower(trim(p_email)); v_target uuid; v_id uuid;
begin
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'Enter a valid email address.'; end if;
  select id into v_target from profiles where lower(email) = v_email;
  if v_target = v_me then raise exception 'You cannot invite yourself.'; end if;
  if v_target is not null and is_trusted(v_me, v_target) then raise exception 'You are already trusted friends.'; end if;
  -- If the other person blocked you, behave as if sent (no existence/block leak).
  if v_target is not null and is_blocked_between(v_me, v_target) then return null; end if;
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

create or replace function public.respond_invitation(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user(); v_inv friend_invitations%rowtype;
begin
  select * into v_inv from friend_invitations where id = p_id and invitee_id = v_me and status = 'pending' for update;
  if not found then raise exception 'Invitation not found or already answered.'; end if;
  if is_blocked_between(v_me, v_inv.inviter_id) then raise exception 'This invitation is no longer available.'; end if;
  update friend_invitations set status = case when p_accept then 'accepted' else 'rejected' end,
                                responded_at = now() where id = p_id;
  if p_accept then
    insert into trusted_contacts (user_id, contact_id) values (v_me, v_inv.inviter_id), (v_inv.inviter_id, v_me)
      on conflict do nothing;
    perform notify(v_inv.inviter_id, 'invitation_accepted', 'Invitation accepted',
                   display_name_of(v_me) || ' accepted your invitation.', jsonb_build_object('from', v_me));
    perform audit(v_me, 'trust.accepted', jsonb_build_object('with', v_inv.inviter_id));
  end if;
end $$;

create or replace function public.cancel_invitation(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user();
begin
  update friend_invitations set status = 'cancelled', responded_at = now()
  where id = p_id and inviter_id = v_me and status = 'pending';
  if not found then raise exception 'Invitation not found.'; end if;
end $$;

-- Ends trust AND all location sharing in both directions.
create or replace function public.sever_ties(p_a uuid, p_b uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from trusted_contacts where (user_id = p_a and contact_id = p_b) or (user_id = p_b and contact_id = p_a);
  update location_shares set status = 'stopped', stopped_at = now()
  where status in ('active','paused') and ((owner_id = p_a and viewer_id = p_b) or (owner_id = p_b and viewer_id = p_a));
  perform cleanup_location(p_a); perform cleanup_location(p_b);
  update friend_invitations set status = 'cancelled', responded_at = now()
  where status = 'pending' and ((inviter_id = p_a and invitee_id = p_b) or (inviter_id = p_b and invitee_id = p_a));
end $$;

create or replace function public.remove_contact(p_contact uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user();
begin
  perform sever_ties(v_me, p_contact);
  perform audit(v_me, 'trust.removed', jsonb_build_object('contact', p_contact));
end $$;

create or replace function public.block_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user();
begin
  if p_user = v_me then raise exception 'You cannot block yourself.'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'User not found.'; end if;
  perform sever_ties(v_me, p_user);
  insert into blocks (blocker_id, blocked_id) values (v_me, p_user) on conflict do nothing;
  perform audit(v_me, 'user.blocked', jsonb_build_object('user', p_user));
end $$;

create or replace function public.unblock_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user();
begin
  delete from blocks where blocker_id = v_me and blocked_id = p_user;
  perform audit(v_me, 'user.unblocked', jsonb_build_object('user', p_user));
end $$;

create or replace function public.update_contact_prefs(p_contact uuid, p_sos boolean, p_checkins boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user();
begin
  update trusted_contacts set receives_sos = p_sos, receives_checkins = p_checkins
  where user_id = v_me and contact_id = p_contact;
  if not found then raise exception 'Contact not found.'; end if;
end $$;

-- Blocked users the caller may list (profiles RLS hides them otherwise).
create or replace function public.list_blocked() returns table (id uuid, display_name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name from blocks b join profiles p on p.id = b.blocked_id where b.blocker_id = auth.uid()
$$;

-- ───────────────────────── Messaging ─────────────────────────
create or replace function public.send_message(p_to uuid, p_body text, p_client_id uuid) returns messages
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user(); v_msg messages%rowtype; v_body text := trim(p_body);
begin
  if v_body is null or v_body = '' then raise exception 'Message is empty.'; end if;
  -- Idempotent retry: same client_id returns the stored row.
  select * into v_msg from messages where sender_id = v_me and client_id = p_client_id;
  if found then return v_msg; end if;
  if not is_trusted(v_me, p_to) or is_blocked_between(v_me, p_to) then
    raise exception 'You can only message trusted friends.';
  end if;
  insert into messages (sender_id, recipient_id, body, client_id)
  values (v_me, p_to, v_body, p_client_id) returning * into v_msg;
  -- One unread-message notification per sender, not one per message.
  if not exists (select 1 from notifications where user_id = p_to and type = 'message' and read_at is null
                 and data ->> 'from' = v_me::text) then
    perform notify(p_to, 'message', 'New message from ' || display_name_of(v_me), left(v_body, 120),
                   jsonb_build_object('from', v_me));
  end if;
  return v_msg;
end $$;

create or replace function public.mark_messages_delivered() returns void
language sql security definer set search_path = public as $$
  update messages set delivered_at = now() where recipient_id = auth.uid() and delivered_at is null
$$;

create or replace function public.mark_conversation_read(p_other uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user();
begin
  update messages set read_at = now(), delivered_at = coalesce(delivered_at, now())
  where recipient_id = v_me and sender_id = p_other and read_at is null;
  update notifications set read_at = now()
  where user_id = v_me and type = 'message' and read_at is null and data ->> 'from' = p_other::text;
end $$;

-- Server-controlled timestamps on notification updates + delivery confirmation.
create or replace function public.notifications_before_update() returns trigger
language plpgsql as $$
begin
  new.delivered_at := coalesce(old.delivered_at, new.delivered_at);
  if new.delivered_at is not null and old.delivered_at is null then new.delivered_at := now(); end if;
  if new.read_at is not null and old.read_at is null then
    new.read_at := now();
    new.delivered_at := coalesce(new.delivered_at, now());
  else
    new.read_at := old.read_at;
  end if;
  return new;
end $$;
drop trigger if exists notifications_before_update on public.notifications;
create trigger notifications_before_update before update on public.notifications
  for each row execute function public.notifications_before_update();

create or replace function public.notifications_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.delivered_at is not null and old.delivered_at is null then
    update delivery_attempts set status = 'delivered', confirmed_at = new.delivered_at
    where notification_id = new.id and status = 'recorded';
  end if;
  return new;
end $$;
drop trigger if exists notifications_after_update on public.notifications;
create trigger notifications_after_update after update on public.notifications
  for each row execute function public.notifications_after_update();

-- ───────────────────────── Location sharing ─────────────────────────
create or replace function public.start_location_share(p_viewers uuid[], p_minutes int) returns int
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user(); v_viewer uuid; v_n int := 0; v_exp timestamptz;
begin
  if p_minutes is null or p_minutes < 1 or p_minutes > 1440 then raise exception 'Choose a duration between 1 minute and 24 hours.'; end if;
  if coalesce(array_length(p_viewers, 1), 0) = 0 then raise exception 'Choose at least one trusted friend.'; end if;
  v_exp := now() + make_interval(mins => p_minutes);
  foreach v_viewer in array p_viewers loop
    if not is_trusted(v_me, v_viewer) or is_blocked_between(v_me, v_viewer) then
      raise exception 'You can only share with trusted friends.';
    end if;
    -- Replace any standalone share to this viewer (outing shares are managed separately).
    update location_shares set status = 'stopped', stopped_at = now()
    where owner_id = v_me and viewer_id = v_viewer and outing_id is null and status in ('active','paused');
    insert into location_shares (owner_id, viewer_id, expires_at) values (v_me, v_viewer, v_exp);
    perform notify(v_viewer, 'location_share', display_name_of(v_me) || ' is sharing their location with you',
                   'Until ' || to_char(v_exp at time zone 'Africa/Nairobi', 'HH24:MI'),
                   jsonb_build_object('from', v_me, 'expires_at', v_exp));
    v_n := v_n + 1;
  end loop;
  perform audit(v_me, 'location.share_started', jsonb_build_object('viewers', p_viewers, 'expires_at', v_exp));
  return v_n;
end $$;

-- p_viewer null = all of the caller's shares. p_status: 'paused' | 'active' | 'stopped'.
create or replace function public.set_share_status(p_viewer uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user(); r record;
begin
  if p_status not in ('paused','active','stopped') then raise exception 'Invalid status.'; end if;
  if p_status = 'stopped' then
    update location_shares set status = 'stopped', stopped_at = now()
    where owner_id = v_me and status in ('active','paused') and (p_viewer is null or viewer_id = p_viewer);
  elsif p_status = 'paused' then
    update location_shares set status = 'paused'
    where owner_id = v_me and status = 'active' and (p_viewer is null or viewer_id = p_viewer);
  else
    update location_shares set status = 'active'
    where owner_id = v_me and status = 'paused' and expires_at > now() and (p_viewer is null or viewer_id = p_viewer);
  end if;
  for r in select distinct viewer_id from location_shares
           where owner_id = v_me and (p_viewer is null or viewer_id = p_viewer) loop
    perform notify(r.viewer_id, 'location_share',
                   display_name_of(v_me) || case p_status when 'stopped' then ' stopped sharing location'
                     when 'paused' then ' paused location sharing' else ' resumed location sharing' end,
                   null, jsonb_build_object('from', v_me, 'status', p_status));
  end loop;
  perform cleanup_location(v_me);
  perform audit(v_me, 'location.share_' || p_status, jsonb_build_object('viewer', p_viewer));
end $$;

create or replace function public.push_location(p_lat double precision, p_lng double precision,
                                                p_accuracy double precision default null,
                                                p_heading double precision default null) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user(); v_ts timestamptz := now();
begin
  -- No active consented share => nothing is stored.
  if not exists (select 1 from location_shares where owner_id = v_me and status = 'active' and expires_at > now()) then
    raise exception 'Location sharing is not active.' using errcode = 'P0002';
  end if;
  insert into live_locations (owner_id, lat, lng, accuracy, heading, updated_at)
  values (v_me, p_lat, p_lng, p_accuracy, p_heading, v_ts)
  on conflict (owner_id) do update set lat = excluded.lat, lng = excluded.lng,
    accuracy = excluded.accuracy, heading = excluded.heading, updated_at = excluded.updated_at;
  return v_ts;
end $$;

-- ───────────────────────── Outings ─────────────────────────
create or replace function public.sync_outing_shares(p_outing uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_o outings%rowtype;
begin
  select * into v_o from outings where id = p_outing;
  if not found then return; end if;
  update location_shares s set status = 'stopped', stopped_at = now()
  where s.outing_id = p_outing and s.status in ('active','paused') and (
    v_o.status <> 'active' or not exists (
      select 1 from outing_members a join outing_members b on b.outing_id = a.outing_id
      where a.outing_id = p_outing and a.user_id = s.owner_id and b.user_id = s.viewer_id
        and a.status = 'accepted' and a.shares_location and b.status = 'accepted'));
  if v_o.status = 'active' and v_o.ends_at > now() then
    insert into location_shares (owner_id, viewer_id, outing_id, expires_at)
    select a.user_id, b.user_id, p_outing, v_o.ends_at
    from outing_members a join outing_members b on b.outing_id = a.outing_id and b.user_id <> a.user_id
    where a.outing_id = p_outing and a.status = 'accepted' and a.shares_location and b.status = 'accepted'
      and not exists (select 1 from location_shares s where s.owner_id = a.user_id and s.viewer_id = b.user_id
                      and s.outing_id = p_outing and s.status in ('active','paused'));
  end if;
  perform cleanup_location(m.user_id) from outing_members m where m.outing_id = p_outing;
end $$;

create or replace function public.create_outing(p_title text, p_venue text, p_starts timestamptz,
                                                p_ends timestamptz, p_invitees uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user(); v_id uuid; v_u uuid;
begin
  if p_ends <= p_starts then raise exception 'The outing must end after it starts.'; end if;
  if p_ends <= now() then raise exception 'The end time is in the past.'; end if;
  insert into outings (host_id, title, venue, starts_at, ends_at)
  values (v_me, trim(p_title), trim(p_venue), p_starts, p_ends) returning id into v_id;
  insert into outing_members (outing_id, user_id, status, shares_location, responded_at)
  values (v_id, v_me, 'accepted', false, now());
  foreach v_u in array coalesce(p_invitees, '{}') loop
    perform invite_to_outing(v_id, v_u);
  end loop;
  return v_id;
end $$;

create or replace function public.invite_to_outing(p_outing uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user(); v_o outings%rowtype;
begin
  select * into v_o from outings where id = p_outing and host_id = v_me and status = 'active';
  if not found then raise exception 'Only the host of an active outing can invite.'; end if;
  if not is_trusted(v_me, p_user) or is_blocked_between(v_me, p_user) then
    raise exception 'You can only invite trusted friends.';
  end if;
  insert into outing_members (outing_id, user_id, status) values (p_outing, p_user, 'invited')
  on conflict (outing_id, user_id) do update
    set status = 'invited', shares_location = false, invited_at = now(), responded_at = null
    where outing_members.status in ('declined','left','removed');
  if found then
    perform notify(p_user, 'outing_invitation', 'Outing invitation',
                   display_name_of(v_me) || ' invited you to "' || v_o.title || '"',
                   jsonb_build_object('outing_id', p_outing, 'from', v_me));
  end if;
end $$;

-- Accepting does not imply location consent; p_share_location is explicit.
create or replace function public.respond_outing(p_outing uuid, p_accept boolean, p_share_location boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user(); v_host uuid;
begin
  update outing_members m set status = case when p_accept then 'accepted' else 'declined' end,
         shares_location = p_accept and coalesce(p_share_location, false), responded_at = now()
  where m.outing_id = p_outing and m.user_id = v_me and m.status = 'invited'
    and exists (select 1 from outings o where o.id = p_outing and o.status = 'active');
  if not found then raise exception 'Invitation not found or no longer open.'; end if;
  select host_id into v_host from outings where id = p_outing;
  perform notify(v_host, 'outing_invitation', display_name_of(v_me) || case when p_accept then ' joined' else ' declined' end || ' your outing',
                 null, jsonb_build_object('outing_id', p_outing, 'from', v_me));
  perform sync_outing_shares(p_outing);
  perform audit(v_me, 'outing.responded', jsonb_build_object('outing', p_outing, 'accept', p_accept, 'share', p_share_location));
end $$;

create or replace function public.set_outing_consent(p_outing uuid, p_share boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user();
begin
  update outing_members set shares_location = p_share
  where outing_id = p_outing and user_id = v_me and status = 'accepted';
  if not found then raise exception 'You are not a member of this outing.'; end if;
  perform sync_outing_shares(p_outing);
  perform audit(v_me, 'outing.consent', jsonb_build_object('outing', p_outing, 'share', p_share));
end $$;

create or replace function public.leave_outing(p_outing uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user();
begin
  if exists (select 1 from outings where id = p_outing and host_id = v_me) then
    raise exception 'The host cannot leave; end the outing instead.';
  end if;
  update outing_members set status = 'left', shares_location = false, responded_at = now()
  where outing_id = p_outing and user_id = v_me and status in ('invited','accepted');
  if not found then raise exception 'You are not in this outing.'; end if;
  perform sync_outing_shares(p_outing);
end $$;

create or replace function public.remove_outing_member(p_outing uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user();
begin
  if not exists (select 1 from outings where id = p_outing and host_id = v_me) then
    raise exception 'Only the host can remove participants.';
  end if;
  if p_user = v_me then raise exception 'The host cannot be removed.'; end if;
  update outing_members set status = 'removed', shares_location = false, responded_at = now()
  where outing_id = p_outing and user_id = p_user and status in ('invited','accepted');
  perform sync_outing_shares(p_outing);
end $$;

create or replace function public.end_outing(p_outing uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user();
begin
  update outings set status = 'ended', ended_at = now() where id = p_outing and host_id = v_me and status = 'active';
  if not found then raise exception 'Outing not found or already ended.'; end if;
  update outing_members set status = 'declined' where outing_id = p_outing and status = 'invited';
  perform sync_outing_shares(p_outing);
  perform audit(v_me, 'outing.ended', jsonb_build_object('outing', p_outing));
end $$;

-- ───────────────────────── Return-home & check-ins ─────────────────────────
create or replace function public.create_return_plan(p_destination text, p_expected timestamptz,
                                                     p_grace int, p_notify uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user(); v_u uuid; v_id uuid;
begin
  if p_expected <= now() then raise exception 'Expected arrival must be in the future.'; end if;
  if coalesce(array_length(p_notify, 1), 0) = 0 then raise exception 'Choose at least one contact to notify.'; end if;
  foreach v_u in array p_notify loop
    if not is_trusted(v_me, v_u) then raise exception 'You can only notify trusted friends.'; end if;
  end loop;
  insert into return_home_plans (user_id, destination, expected_arrival, grace_minutes, notify_ids)
  values (v_me, trim(p_destination), p_expected, coalesce(p_grace, 15), p_notify) returning id into v_id;
  return v_id;
end $$;

create or replace function public.notify_plan_contacts(p_plan uuid, p_type text, p_title text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare v_p return_home_plans%rowtype; v_c uuid;
begin
  select * into v_p from return_home_plans where id = p_plan;
  foreach v_c in array v_p.notify_ids loop
    if exists (select 1 from trusted_contacts where user_id = v_p.user_id and contact_id = v_c and receives_checkins) then
      perform notify(v_c, p_type, p_title, p_body, jsonb_build_object('plan_id', p_plan, 'from', v_p.user_id));
    end if;
  end loop;
end $$;

create or replace function public.start_return_plan(p_plan uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user(); v_p return_home_plans%rowtype;
begin
  if exists (select 1 from return_home_plans where user_id = v_me and status in ('active','overdue') and id <> p_plan) then
    raise exception 'Finish or cancel your current journey first.';
  end if;
  update return_home_plans set status = 'active', started_at = now()
  where id = p_plan and user_id = v_me and status = 'planned' returning * into v_p;
  if not found then raise exception 'Plan not found or already started.'; end if;
  perform notify_plan_contacts(p_plan, 'checkin', display_name_of(v_me) || ' started their journey',
    'Heading to ' || v_p.destination || ', expected ' || to_char(v_p.expected_arrival at time zone 'Africa/Nairobi', 'HH24:MI'));
end $$;

create or replace function public.plan_checkin(p_plan uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user();
begin
  if not exists (select 1 from return_home_plans where id = p_plan and user_id = v_me and status in ('active','overdue')) then
    raise exception 'No active journey.';
  end if;
  insert into checkins (plan_id, user_id, note) values (p_plan, v_me, left(trim(p_note), 500));
  perform notify_plan_contacts(p_plan, 'checkin', display_name_of(v_me) || ' checked in', nullif(trim(p_note), ''));
end $$;

create or replace function public.arrive_safely(p_plan uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user();
begin
  update return_home_plans set status = 'arrived', arrived_at = now()
  where id = p_plan and user_id = v_me and status in ('active','overdue');
  if not found then raise exception 'No active journey.'; end if;
  perform notify_plan_contacts(p_plan, 'arrived', display_name_of(v_me) || ' arrived safely', null);
end $$;

create or replace function public.cancel_return_plan(p_plan uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user(); v_was text;
begin
  select status into v_was from return_home_plans where id = p_plan and user_id = v_me
    and status in ('planned','active','overdue') for update;
  if not found then raise exception 'Plan not found.'; end if;
  update return_home_plans set status = 'cancelled' where id = p_plan;
  if v_was <> 'planned' then
    perform notify_plan_contacts(p_plan, 'checkin', display_name_of(v_me) || ' cancelled their journey', 'No action needed.');
  end if;
end $$;

-- Run by pg_cron (server side; no browser needed).
create or replace function public.process_overdue_plans() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0;
begin
  for r in select id, user_id, destination from return_home_plans
           where status = 'active' and expected_arrival + make_interval(mins => grace_minutes) <= now()
           for update skip locked loop
    update return_home_plans set status = 'overdue', overdue_alerted_at = now() where id = r.id;
    perform notify_plan_contacts(r.id, 'missed_checkin', display_name_of(r.user_id) || ' has not checked in',
      'They were expected at ' || r.destination || '. Try contacting them; call 999/112 if you are worried.');
    perform notify(r.user_id, 'missed_checkin', 'You missed your check-in',
      'Your contacts were notified. Mark yourself as arrived if you are safe.', jsonb_build_object('plan_id', r.id));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Expire shares and outings whose time is up. Also run by pg_cron.
create or replace function public.expire_stale() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  update location_shares set status = 'expired', stopped_at = now()
  where status in ('active','paused') and expires_at <= now();
  update outings set status = 'ended', ended_at = now() where status = 'active' and ends_at <= now();
  for r in select distinct owner_id from live_locations loop perform cleanup_location(r.owner_id); end loop;
end $$;

-- ───────────────────────── SOS & help requests ─────────────────────────
-- Location is stored only when the caller passes coordinates (explicit choice).
create or replace function public.create_alert(p_kind text, p_message text, p_recipients uuid[],
                                               p_lat double precision, p_lng double precision,
                                               p_accuracy double precision, p_client_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user(); v_id uuid; v_rec uuid[]; v_r uuid; v_nid uuid;
begin
  if p_kind not in ('sos','help_request') then raise exception 'Invalid alert kind.'; end if;
  select id into v_id from sos_alerts where sender_id = v_me and client_id = p_client_id;
  if found then return v_id; end if;   -- idempotent for the offline queue

  if p_recipients is null or array_length(p_recipients, 1) is null then
    if p_kind = 'help_request' then raise exception 'Choose who to ask for help.'; end if;
    select coalesce(array_agg(contact_id), '{}') into v_rec from trusted_contacts
      where user_id = v_me and receives_sos;
  else
    v_rec := p_recipients;
  end if;
  if coalesce(array_length(v_rec, 1), 0) = 0 then
    raise exception 'No trusted contacts are set to receive alerts. Add one in the Trust Panel.';
  end if;
  foreach v_r in array v_rec loop
    if not is_trusted(v_me, v_r) then raise exception 'You can only alert trusted friends.'; end if;
  end loop;

  insert into sos_alerts (sender_id, kind, message, lat, lng, accuracy, client_id)
  values (v_me, p_kind, left(trim(p_message), 1000), p_lat, p_lng, p_accuracy, p_client_id) returning id into v_id;

  foreach v_r in array v_rec loop
    insert into sos_recipients (alert_id, recipient_id) values (v_id, v_r);
    v_nid := notify(v_r, case p_kind when 'sos' then 'sos' else 'help_request' end,
      case p_kind when 'sos' then 'SOS from ' else 'Help request from ' end || display_name_of(v_me),
      coalesce(nullif(trim(p_message), ''), 'They need you to check on them.'),
      jsonb_build_object('alert_id', v_id, 'from', v_me, 'has_location', p_lat is not null));
    insert into delivery_attempts (alert_id, recipient_id, notification_id) values (v_id, v_r, v_nid);
  end loop;
  perform audit(v_me, 'alert.created', jsonb_build_object('alert', v_id, 'kind', p_kind,
    'recipients', v_rec, 'location_included', p_lat is not null));
  return v_id;
end $$;

create or replace function public.ack_alert(p_alert uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user(); v_sender uuid;
begin
  update sos_recipients set acknowledged_at = coalesce(acknowledged_at, now())
  where alert_id = p_alert and recipient_id = v_me;
  if not found then raise exception 'Alert not found.'; end if;
  select sender_id into v_sender from sos_alerts where id = p_alert;
  perform notify(v_sender, 'sos_acknowledged', display_name_of(v_me) || ' saw your alert',
                 null, jsonb_build_object('alert_id', p_alert, 'from', v_me));
end $$;

create or replace function public.close_alert(p_alert uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user();
begin
  if p_status not in ('resolved','cancelled') then raise exception 'Invalid status.'; end if;
  update sos_alerts set status = p_status, closed_at = now()
  where id = p_alert and sender_id = v_me and status = 'active';
  if not found then raise exception 'Alert not found or already closed.'; end if;
  perform audit(v_me, 'alert.' || p_status, jsonb_build_object('alert', p_alert));
end $$;

-- ───────────────────────── Account deletion ─────────────────────────
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid := require_user();
begin
  delete from auth.users where id = v_me;   -- cascades to every table above
end $$;

-- ───────────────────────── Execute privileges ─────────────────────────
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.is_trusted(uuid, uuid), public.shares_outing(uuid, uuid), public.is_outing_participant(uuid, uuid),
  public.is_alert_recipient(uuid, uuid), public.is_alert_sender(uuid, uuid), public.can_view_location(uuid, uuid)
  to authenticated;   -- needed by RLS policies

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
  public.create_return_plan(text, timestamptz, int, uuid[]), public.start_return_plan(uuid),
  public.plan_checkin(uuid, text), public.arrive_safely(uuid), public.cancel_return_plan(uuid),
  public.create_alert(text, text, uuid[], double precision, double precision, double precision, uuid),
  public.ack_alert(uuid), public.close_alert(uuid, text), public.delete_my_account()
  to authenticated;
-- notify, audit, sever_ties, sync_outing_shares, process_overdue_plans, expire_stale, etc.
-- stay internal: callable only by other definer functions, triggers and pg_cron.

-- ───────────────────────── Realtime + scheduling ─────────────────────────
alter publication supabase_realtime add table
  public.messages, public.notifications, public.live_locations, public.location_shares,
  public.friend_invitations, public.trusted_contacts, public.outing_members, public.outings,
  public.return_home_plans, public.sos_alerts, public.sos_recipients, public.delivery_attempts;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('tukosafe-overdue', '* * * * *', 'select public.process_overdue_plans()');
  perform cron.schedule('tukosafe-expire', '* * * * *', 'select public.expire_stale()');
exception when others then
  raise warning 'pg_cron unavailable (%). Enable it in Supabase > Database > Extensions, then schedule process_overdue_plans() and expire_stale() every minute.', sqlerrm;
end $$;
