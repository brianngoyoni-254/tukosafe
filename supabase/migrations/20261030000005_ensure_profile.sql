-- Self-heal: make sure the signed-in user has a profile row.
-- Normally the on_auth_user_created trigger creates it at sign-up. This covers accounts created before the
-- migrations were applied (or if the trigger was ever missing), so a verified user is never left profile-less.
create or replace function public.ensure_profile() returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid := require_user(); v_u auth.users%rowtype; v_name text;
begin
  if exists (select 1 from profiles where id = v_me) then return; end if;
  select * into v_u from auth.users where id = v_me;
  if not found then return; end if;
  v_name := nullif(trim(coalesce(v_u.raw_user_meta_data ->> 'display_name', '')), '');
  if v_name is null or char_length(v_name) < 2 then v_name := split_part(v_u.email, '@', 1); end if;
  if char_length(v_name) < 2 then v_name := v_name || '_'; end if;
  insert into profiles (id, email, display_name, phone)
  values (v_me, lower(v_u.email), left(v_name, 80), nullif(v_u.raw_user_meta_data ->> 'phone', ''))
  on conflict (id) do nothing;
  -- Attach invitations that were sent to this address before the profile existed.
  update friend_invitations set invitee_id = v_me
  where invitee_id is null and lower(invitee_email) = lower(v_u.email) and status = 'pending';
exception when unique_violation then
  null;   -- another profile already owns this email; leave it for an operator to resolve
end $$;

revoke execute on function public.ensure_profile() from public, anon, authenticated;
grant execute on function public.ensure_profile() to authenticated;
