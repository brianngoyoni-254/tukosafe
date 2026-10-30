-- Outing edit/delete/expiry, return-home history & duplicate-overdue protection,
-- and the notification delivery queue. Rolls back.
begin;

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'wanjiru@test.dev', '{"display_name":"Wanjiru","phone":"+254700000001"}', now()),
  ('00000000-0000-0000-0000-0000000000a2', 'brian@test.dev',   '{"display_name":"Brian","phone":"+254700000002"}', now()),
  ('00000000-0000-0000-0000-0000000000a3', 'charlie@test.dev', '{"display_name":"Charlie"}', now());
insert into public.trusted_contacts (user_id, contact_id) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

-- ───────── Outings ─────────
create temp table t (k text primary key, id uuid);
grant all on t to authenticated;
insert into t select 'o1', public.create_outing('Concert', 'Uhuru Gardens', now(), now() + interval '3 hours',
  array['00000000-0000-0000-0000-0000000000a2'::uuid]);
insert into t select 'o2', public.create_outing('Brunch', 'Westlands', now(), now() + interval '2 hours',
  array['00000000-0000-0000-0000-0000000000a2'::uuid]);

-- Non-host cannot edit or delete.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  begin perform public.update_outing((select id from t where k='o1'), 'Hacked', 'x', now(), now() + interval '1 hour');
        raise exception 'FAIL: non-host edited outing'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform public.delete_outing((select id from t where k='o1'));
        raise exception 'FAIL: non-host deleted outing'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform public.invite_to_outing((select id from t where k='o1'), '00000000-0000-0000-0000-0000000000a3');
        raise exception 'FAIL: non-host invited'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  raise notice 'PASS: only the host can edit, delete or invite';
end $$;
select public.respond_outing((select id from t where k='o1'), true, true);   -- accepts AND consents

-- Host edits: sharing window follows the new end time; members notified.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.set_outing_consent((select id from t where k='o1'), true);
select public.update_outing((select id from t where k='o1'), 'Concert (moved)', 'Carnivore', now(), now() + interval '5 hours');
do $$ begin
  if not exists (select 1 from public.location_shares where outing_id = (select id from t where k='o1')
                 and expires_at > now() + interval '4 hours 30 minutes') then
    raise exception 'FAIL: sharing expiry did not follow new end time'; end if;
  raise notice 'PASS: editing an outing moves its sharing window';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  if (select title from public.outings where id = (select id from t where k='o1')) <> 'Concert (moved)' then
    raise exception 'FAIL: member does not see the edit'; end if;
  if (select count(*) from public.notifications where type = 'outing_update') <> 1 then raise exception 'FAIL: no update notification'; end if;
  raise notice 'PASS: edit synchronised to the other account';
end $$;

-- Expired invitation: o2 ends in the past before Brian answers.
reset role;
update public.outings set ends_at = now() - interval '1 minute', starts_at = now() - interval '3 hours' where id = (select id from t where k='o2');
select public.expire_stale();
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  if (select status from public.outing_members where outing_id = (select id from t where k='o2') and user_id = auth.uid()) <> 'expired' then
    raise exception 'FAIL: pending invitation not expired'; end if;
  begin perform public.respond_outing((select id from t where k='o2'), true, false);
        raise exception 'FAIL: accepted an expired invitation'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  raise notice 'PASS: expired invitations cannot be accepted';
end $$;

-- Delete: members lose it, shares are gone, they are told.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.push_location(-1.28, 36.81, 10, null);
select public.delete_outing((select id from t where k='o1'));
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.outings where id = (select id from t where k='o1')) <> 0 then raise exception 'FAIL: deleted outing visible'; end if;
  if (select count(*) from public.live_locations) <> 0 then raise exception 'FAIL: location survives outing deletion'; end if;
  if (select count(*) from public.notifications where type = 'outing_cancelled') <> 1 then raise exception 'FAIL: no cancellation notice'; end if;
  raise notice 'PASS: deleting an outing removes it and its sharing for members';
end $$;

-- ───────── Return-home plans ─────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into t select 'p1', public.create_return_plan('Kilimani', now() + interval '1 hour', 10, array['00000000-0000-0000-0000-0000000000a2'::uuid]);
select public.start_return_plan((select id from t where k='p1'));
select public.plan_checkin((select id from t where k='p1'), 'On the matatu');

reset role;
update public.return_home_plans set expected_arrival = now() - interval '30 minutes' where id = (select id from t where k='p1');
select public.process_overdue_plans();
select public.process_overdue_plans();   -- second run must not alert again
select public.process_overdue_plans();

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.notifications where type = 'missed_checkin') <> 1 then
    raise exception 'FAIL: expected exactly one missed_checkin notification, got %', (select count(*) from public.notifications where type = 'missed_checkin'); end if;
  if (select count(*) from public.checkins) <> 1 then raise exception 'FAIL: contact cannot see check-in history'; end if;
  if (select status from public.return_home_plans limit 1) <> 'overdue' then raise exception 'FAIL: plan not overdue'; end if;
  raise notice 'PASS: overdue alert fires once, recipients see plan and check-in history';
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.arrive_safely((select id from t where k='p1'));
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.notifications where type = 'arrived') <> 1 then raise exception 'FAIL: no arrival notice'; end if;
  raise notice 'PASS: arriving safely after an overdue alert notifies contacts';
end $$;

-- Reminder goes to the traveller first; extending the ETA re-arms it and is rejected once escalated.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.notifications where type = 'checkin' and title = 'Are you home safe?') <> 1 then
    raise exception 'FAIL: traveller got no server-side reminder'; end if;
  raise notice 'PASS: traveller is reminded by the server at the due time';
end $$;
insert into t select 'p2', public.create_return_plan('Karen', now() + interval '1 hour', 10, array['00000000-0000-0000-0000-0000000000a2'::uuid]);
select public.start_return_plan((select id from t where k='p2'));
select public.extend_return_plan((select id from t where k='p2'), 30);
do $$ begin
  if (select expected_arrival from public.return_home_plans where id = (select id from t where k='p2')) < now() + interval '85 minutes' then
    raise exception 'FAIL: ETA not extended'; end if;
  begin perform public.extend_return_plan((select id from t where k='p1'), 30);
        raise exception 'FAIL: extended an arrived journey'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  raise notice 'PASS: ETA extension works only for active journeys';
end $$;

-- Contacts that were not designated never learn about the journey.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.return_home_plans) + (select count(*) from public.checkins) <> 0 then
    raise exception 'FAIL: stranger sees journey data'; end if;
end $$;

-- ───────── Notification delivery queue ─────────
-- Brian: push subscription + email opt-in. Wanjiru sends SOS and a normal message.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select public.save_push_subscription('https://push.example.test/abc', 'p256dh-key', 'auth-secret', 'test');
select public.set_notification_prefs(true, true, false);
do $$ begin
  begin perform public.set_notification_prefs(true, false, true);   -- Brian has a phone, so this works
  exception when others then raise exception 'FAIL: sms opt-in rejected despite phone: %', sqlerrm; end;
  perform public.set_notification_prefs(true, true, false);
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.send_message('00000000-0000-0000-0000-0000000000a2', 'hello', gen_random_uuid());
select public.create_alert('sos', 'Test SOS', null, null, null, null, gen_random_uuid());

reset role;
do $$ begin
  if (select count(*) from public.notification_deliveries where channel = 'push') <> 2 then
    raise exception 'FAIL: expected push deliveries for message+sos (+earlier critical), got %', (select count(*) from public.notification_deliveries where channel = 'push'); end if;
  if (select count(*) from public.notification_deliveries where channel = 'email') <> 1 then
    raise exception 'FAIL: email must be queued for the SOS only'; end if;
  if exists (select 1 from public.notification_deliveries where channel = 'sms') then
    raise exception 'FAIL: sms queued without opt-in'; end if;
  raise notice 'PASS: push for all types, email only for critical + opted-in, no SMS without opt-in';
end $$;

-- Worker claims, reports; statuses stay honest.
set local role service_role;
do $$ declare c record; n int := 0; begin
  for c in select * from public.claim_deliveries(10) loop
    n := n + 1;
    if c.channel = 'push' and jsonb_array_length(c.subscriptions) <> 1 then raise exception 'FAIL: subscription not delivered to worker'; end if;
    if c.channel = 'email' and c.email <> 'brian@test.dev' then raise exception 'FAIL: wrong email target'; end if;
    perform public.finish_delivery(c.id, case when c.channel = 'email' then 'not_configured' else 'provider_accepted' end,
      null, case when c.channel = 'email' then 'no provider configured' end);
  end loop;
  if n <> 3 then raise exception 'FAIL: worker claimed % rows, expected 3', n; end if;
  if (select count(*) from public.claim_deliveries(10)) <> 0 then raise exception 'FAIL: rows claimed twice'; end if;
  raise notice 'PASS: worker claims each delivery exactly once';
end $$;
reset role;

-- Invalid subscription cleanup.
set local role service_role;
select public.record_push_result((select id from public.push_subscriptions limit 1), false, true);
reset role;
do $$ begin
  if exists (select 1 from public.push_subscriptions) then raise exception 'FAIL: expired subscription not removed'; end if;
  raise notice 'PASS: gone (404/410) push subscriptions are deleted';
end $$;

-- Sender sees channel + status for their own alert; strangers see nothing.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.notification_deliveries) < 2 then raise exception 'FAIL: sender cannot see delivery status'; end if;
  if exists (select 1 from public.notification_deliveries where status = 'provider_accepted' and channel = 'email') then
    raise exception 'FAIL: email shown as accepted although no provider'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.notification_deliveries) <> 0 then raise exception 'FAIL: stranger sees deliveries'; end if;
  raise notice 'PASS: delivery status visible to the sender only';
end $$;
reset role;

rollback;
