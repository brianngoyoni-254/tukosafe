-- What happens in the database when someone registers: profile creation, invitation linking, self-healing.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'Inviter@Test.dev', '{"display_name":"Inviter"}');

-- An invitation is sent to an address that has no account yet.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select public.send_invitation('Newcomer@Test.dev');
reset role;

-- Registration through the auth schema (what Supabase Auth does) with the metadata our form sends.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b2', 'Newcomer@Test.dev', '{"display_name":"  Njeri Wambui ","phone":"+254700111222"}'),
  ('00000000-0000-0000-0000-0000000000b3', 'no.name@test.dev', '{}'),
  ('00000000-0000-0000-0000-0000000000b4', 'a@test.dev', '{"display_name":""}');

do $$ begin
  if (select count(*) from public.profiles where id::text like '00000000-0000-0000-0000-0000000000b%') <> 4 then
    raise exception 'FAIL: not every registration produced a profile'; end if;
  if not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'
                 and email = 'newcomer@test.dev' and display_name = 'Njeri Wambui' and phone = '+254700111222') then
    raise exception 'FAIL: profile fields wrong (name trimmed, email lower-cased, phone kept): %',
      (select row_to_json(p)::text from public.profiles p where id = '00000000-0000-0000-0000-0000000000b2'); end if;
  if (select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000b3') <> 'no.name' then
    raise exception 'FAIL: fallback name should come from the email'; end if;
  if (select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000b4') <> 'a_' then
    raise exception 'FAIL: one-character names must be padded to satisfy the 2+ character rule'; end if;
  raise notice 'PASS: registration creates a correct profile (including edge cases)';
end $$;

-- The earlier invitation found its recipient and notified them.
do $$ begin
  if not exists (select 1 from public.friend_invitations where invitee_id = '00000000-0000-0000-0000-0000000000b2' and status = 'pending') then
    raise exception 'FAIL: pre-signup invitation not attached to the new account'; end if;
  if not exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b2' and type = 'friend_invitation') then
    raise exception 'FAIL: new account was not notified of the waiting invitation'; end if;
  raise notice 'PASS: invitations sent before sign-up reach the new account';
end $$;

-- Clients can never rewrite identity fields on their own profile.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
do $$ begin
  update public.profiles set display_name = 'Njeri W.' where id = auth.uid();
  if (select display_name from public.profiles where id = auth.uid()) <> 'Njeri W.' then raise exception 'FAIL: own name not editable'; end if;
  begin update public.profiles set email = 'evil@test.dev' where id = auth.uid(); raise exception 'FAIL: email editable by client';
  exception when insufficient_privilege then null; end;
  begin update public.profiles set id = gen_random_uuid() where id = auth.uid(); raise exception 'FAIL: id editable by client';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS: profile name/phone are editable, email and id are not';
end $$;
reset role;

-- Self-heal: a verified user whose profile row is missing gets one on demand, and only their own.
delete from public.profiles where id = '00000000-0000-0000-0000-0000000000b3';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
do $$ begin
  if exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'FAIL: test setup'; end if;
  perform public.ensure_profile();
  perform public.ensure_profile();   -- idempotent
  if (select count(*) from public.profiles where id = auth.uid()) <> 1 then raise exception 'FAIL: ensure_profile did not recreate exactly one profile'; end if;
  raise notice 'PASS: ensure_profile recreates a missing profile (idempotent)';
end $$;
reset role;

delete from public.profiles where id = '00000000-0000-0000-0000-0000000000b4';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
do $$ begin
  perform public.ensure_profile();
  if exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000b4') then
    raise exception 'FAIL: ensure_profile created someone else''s profile'; end if;
  raise notice 'PASS: ensure_profile only ever acts for the caller';
end $$;
reset role;

-- Deleting an account removes its profile and everything hanging off it.
delete from auth.users where id = '00000000-0000-0000-0000-0000000000b2';
do $$ begin
  if exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000b2') then raise exception 'FAIL: profile survives account deletion'; end if;
  if exists (select 1 from public.friend_invitations where invitee_id = '00000000-0000-0000-0000-0000000000b2') then raise exception 'FAIL: invitation survives account deletion'; end if;
  raise notice 'PASS: deleting the auth user cascades to profile data';
end $$;

rollback;
