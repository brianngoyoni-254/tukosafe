-- Multi-account backend test: Wanjiru (a1), Brian (a2), Charlie (a3, a stranger).
-- Exercises the REAL RLS policies and functions by impersonating each user as the
-- `authenticated` role. Runs in one transaction and ROLLS BACK, leaving no data.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/multi_user.sql
--
-- Any failed expectation raises an exception and the script exits non-zero.
-- Covers scenarios 1-18 of the spec. Scenarios 19-20 (logout/login, Remember Me)
-- are browser behaviour; see src/lib/supabase.js and the manual checklist in README.

begin;

-- 1-2. Two independent registrations (+ a stranger). The signup trigger creates profiles.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'wanjiru@test.dev', '{"display_name":"Wanjiru"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'brian@test.dev',   '{"display_name":"Brian"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'charlie@test.dev', '{"display_name":"Charlie"}');

do $$ begin
  if (select count(*) from public.profiles) <> 3 then raise exception 'FAIL: profiles not created by signup trigger'; end if;
  raise notice 'PASS 1-2: three accounts registered';
end $$;

-- ───────────── Wanjiru invites Brian ─────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.send_invitation('brian@test.dev');

do $$ begin
  if (select count(*) from public.friend_invitations) <> 1 then raise exception 'FAIL: inviter cannot see own invitation'; end if;
  raise notice 'PASS 3: invitation sent';
end $$;

-- 4. Brian receives it in HIS account (invitation row + notification).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.friend_invitations where invitee_id = auth.uid() and status = 'pending') <> 1 then
    raise exception 'FAIL: Brian did not receive the invitation'; end if;
  if (select count(*) from public.notifications where type = 'friend_invitation') <> 1 then
    raise exception 'FAIL: Brian got no invitation notification'; end if;
  raise notice 'PASS 4: Brian received the invitation';
end $$;

-- Charlie must not see it.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.friend_invitations) <> 0 then raise exception 'FAIL: stranger sees invitation'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'FAIL: stranger sees other profiles'; end if;
  raise notice 'PASS: stranger sees no invitations and no other profiles';
end $$;

-- 5. Brian accepts.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select public.respond_invitation((select id from public.friend_invitations limit 1), true);
do $$ begin
  if (select count(*) from public.trusted_contacts where user_id = auth.uid()) <> 1 then
    raise exception 'FAIL: Brian does not list Wanjiru as trusted'; end if;
  raise notice 'PASS 5: Brian accepted';
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.trusted_contacts where user_id = auth.uid()) <> 1 then
    raise exception 'FAIL: relationship not mirrored for Wanjiru'; end if;
  if (select count(*) from public.notifications where type = 'invitation_accepted') <> 1 then
    raise exception 'FAIL: Wanjiru not told about acceptance'; end if;
  raise notice 'PASS: both accounts show the trusted relationship';
end $$;

-- 6-7. Messaging, both directions.
select public.send_message('00000000-0000-0000-0000-0000000000a2', 'Have you reached home?', '11111111-1111-1111-1111-111111111111');
-- Retrying with the same client_id must not duplicate.
select public.send_message('00000000-0000-0000-0000-0000000000a2', 'Have you reached home?', '11111111-1111-1111-1111-111111111111');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.messages) <> 1 then raise exception 'FAIL: Brian should see exactly 1 message (retry must be idempotent)'; end if;
  if (select count(*) from public.notifications where type = 'message') <> 1 then raise exception 'FAIL: no message notification'; end if;
  raise notice 'PASS 6: Brian received the message';
end $$;
select public.mark_messages_delivered();
select public.send_message('00000000-0000-0000-0000-0000000000a1', 'Yes, just got in.', '22222222-2222-2222-2222-222222222222');
select public.mark_conversation_read('00000000-0000-0000-0000-0000000000a1');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.messages) <> 2 then raise exception 'FAIL: Wanjiru should see both messages'; end if;
  if not exists (select 1 from public.messages where body like 'Have you%' and delivered_at is not null and read_at is not null) then
    raise exception 'FAIL: delivered/read receipts not recorded'; end if;
  raise notice 'PASS 7: reply received, delivery and read receipts recorded';
end $$;

-- Strangers cannot read or send messages.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.messages) <> 0 then raise exception 'FAIL: stranger can read messages'; end if;
  begin
    perform public.send_message('00000000-0000-0000-0000-0000000000a1', 'hi', gen_random_uuid());
    raise exception 'FAIL: stranger could message Wanjiru';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  raise notice 'PASS: stranger cannot read or send messages';
end $$;

-- ───────────── Location: trust alone grants nothing ─────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.push_location(-1.2864, 36.8172, 20, null);
    raise exception 'FAIL: location stored without any consented share';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  raise notice 'PASS: no location is stored unless sharing is active';
end $$;

-- 8. Wanjiru shares with Brian for one hour.
select public.start_location_share(array['00000000-0000-0000-0000-0000000000a2'::uuid], 60);
select public.push_location(-1.2864, 36.8172, 20, null);

-- 9. Brian sees it.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.live_locations) <> 1 then raise exception 'FAIL: Brian cannot see authorised location'; end if;
  raise notice 'PASS 9: Brian sees Wanjiru''s authorised location';
end $$;

-- 10. A third user cannot.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.live_locations) <> 0 then raise exception 'FAIL: stranger can read coordinates'; end if;
  if (select count(*) from public.location_shares) <> 0 then raise exception 'FAIL: stranger can read share grants'; end if;
  raise notice 'PASS 10: third user cannot see Wanjiru''s location';
end $$;

-- Pause hides immediately; resume restores.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.set_share_status(null, 'paused');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.live_locations) <> 0 then raise exception 'FAIL: paused share still visible'; end if;
  raise notice 'PASS: pausing hides location';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.set_share_status(null, 'active');

-- 11-12. Revocation.
select public.set_share_status(null, 'stopped');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.live_locations) <> 0 then raise exception 'FAIL: access not revoked'; end if;
  raise notice 'PASS 11-12: revocation is immediate';
end $$;

-- Expiry: a share past its end time stops granting access even before cleanup runs.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.start_location_share(array['00000000-0000-0000-0000-0000000000a2'::uuid], 60);
select public.push_location(-1.2864, 36.8172, 20, null);
reset role;
update public.location_shares set expires_at = now() - interval '1 minute' where status = 'active';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.live_locations) <> 0 then raise exception 'FAIL: expired share still grants access'; end if;
  raise notice 'PASS: expired shares grant nothing';
end $$;
reset role;
select public.expire_stale();

-- ───────────── Outing ─────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
create temp table t_outing (id uuid);
grant all on t_outing to authenticated;
insert into t_outing select public.create_outing('Concert', 'Uhuru Gardens', now(), now() + interval '3 hours',
  array['00000000-0000-0000-0000-0000000000a2'::uuid]);   -- 13

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.outing_members where status = 'invited' and user_id = auth.uid()) <> 1 then
    raise exception 'FAIL: Brian did not get the outing invite'; end if;
  raise notice 'PASS 13: outing created and Brian invited (pending, not a member)';
end $$;
-- 14. Accept, without agreeing to share his own location.
select public.respond_outing((select id from t_outing), true, false);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.set_outing_consent((select id from t_outing), true);
select public.push_location(-1.2864, 36.8172, 20, null);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.live_locations) <> 1 then raise exception 'FAIL: outing consent did not grant Brian access'; end if;
  raise notice 'PASS 14: accepted member sees consenting participant';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.live_locations) <> 0 or (select count(*) from public.outings) <> 0 then
    raise exception 'FAIL: stranger sees outing data'; end if;
end $$;

-- 15. Ending the outing revokes outing-scoped sharing.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.end_outing((select id from t_outing));
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.live_locations) <> 0 then raise exception 'FAIL: outing sharing survived end_outing'; end if;
  raise notice 'PASS 15: outing-specific sharing ended with the outing';
end $$;

-- ───────────── SOS ─────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.create_alert('sos', 'Test SOS', null, null, null, null, '33333333-3333-3333-3333-333333333333');   -- 16
-- Idempotent for the offline queue.
select public.create_alert('sos', 'Test SOS', null, null, null, null, '33333333-3333-3333-3333-333333333333');
do $$ begin
  if (select count(*) from public.sos_alerts) <> 1 then raise exception 'FAIL: duplicate alert on retry'; end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.notifications where type = 'sos') <> 1 then raise exception 'FAIL: Brian got no SOS notification'; end if;
  if (select count(*) from public.sos_alerts) <> 1 then raise exception 'FAIL: Brian cannot read the alert'; end if;
  raise notice 'PASS 17: Brian received the SOS';
end $$;
-- Delivery is only "delivered" once Brian's device confirms it.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.delivery_attempts where status = 'delivered') <> 0 then
    raise exception 'FAIL: marked delivered before the recipient confirmed'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
update public.notifications set delivered_at = now() where type = 'sos';
select public.ack_alert((select id from public.sos_alerts limit 1));
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.delivery_attempts where status = 'delivered') <> 1 then
    raise exception 'FAIL: delivery confirmation not recorded'; end if;
  if (select count(*) from public.sos_recipients where acknowledged_at is not null) <> 1 then
    raise exception 'FAIL: acknowledgement not visible to sender'; end if;
  raise notice 'PASS: delivery and acknowledgement tracked from real recipient actions';
end $$;

-- 18. Stranger cannot read or acknowledge.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
do $$ declare v uuid; begin
  if (select count(*) from public.sos_alerts) <> 0 or (select count(*) from public.sos_recipients) <> 0
     or (select count(*) from public.notifications) <> 0 then raise exception 'FAIL: stranger can read alert data'; end if;
  begin
    perform public.ack_alert('00000000-0000-0000-0000-000000000000');
    raise exception 'FAIL: stranger acknowledged an alert';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    perform public.close_alert((select id from public.sos_alerts limit 1), 'resolved');
    raise exception 'FAIL: stranger closed an alert';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  raise notice 'PASS 18: stranger cannot access the alert';
end $$;

-- Only the sender can resolve.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.close_alert((select id from public.sos_alerts limit 1), 'resolved');
    raise exception 'FAIL: recipient closed the sender''s alert';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.close_alert((select id from public.sos_alerts limit 1), 'resolved');

-- ───────────── Server-side overdue check-in ─────────────
create temp table t_plan (id uuid);
grant all on t_plan to authenticated;
insert into t_plan select public.create_return_plan('Home', now() + interval '1 hour', 0,
  array['00000000-0000-0000-0000-0000000000a2'::uuid]);
select public.start_return_plan((select id from t_plan));
reset role;
update public.return_home_plans set expected_arrival = now() - interval '5 minutes';
select public.process_overdue_plans();   -- what pg_cron runs; no browser involved
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.notifications where type = 'missed_checkin') <> 1 then
    raise exception 'FAIL: designated contact not alerted for missed check-in'; end if;
  raise notice 'PASS: overdue check-in alerts the designated contact server-side';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.return_home_plans) <> 0 then raise exception 'FAIL: stranger sees return plan'; end if;
end $$;

-- ───────────── Direct writes are blocked ─────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
do $$ begin
  begin
    insert into public.live_locations (owner_id, lat, lng) values ('00000000-0000-0000-0000-0000000000a3', 0, 0);
    raise exception 'FAIL: direct insert into live_locations allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.trusted_contacts (user_id, contact_id) values ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a1');
    raise exception 'FAIL: direct insert into trusted_contacts allowed';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS: sensitive tables reject direct client writes';
end $$;

reset role;
rollback;
select 'ALL BACKEND TESTS PASSED' as result;
