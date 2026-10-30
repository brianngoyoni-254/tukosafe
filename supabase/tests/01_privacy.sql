-- Negative authorization tests: an unrelated account (Charlie, a3) must not be able to learn
-- whether Wanjiru (a1) and Brian (a2) are trusted, share location, share an outing, or have an alert.
-- Also audits the exact set of functions the API roles may execute.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'wanjiru@test.dev', '{"display_name":"Wanjiru"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'brian@test.dev',   '{"display_name":"Brian"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'charlie@test.dev', '{"display_name":"Charlie"}');

-- Ground truth built as superuser: a1<->a2 trusted, a1 shares location with a2, outing, SOS.
insert into public.trusted_contacts (user_id, contact_id) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1');
insert into public.location_shares (owner_id, viewer_id, expires_at) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', now() + interval '1 hour');
insert into public.live_locations (owner_id, lat, lng) values ('00000000-0000-0000-0000-0000000000a1', -1.28, 36.81);

-- ── The previously exposed helpers must be gone or un-callable by API roles ──
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'
               and p.proname in ('shares_outing','is_outing_participant','is_alert_recipient','is_alert_sender','can_view_location')) then
    raise exception 'FAIL: old two-identity helper functions still exist';
  end if;
  raise notice 'PASS: two-identity helper functions removed';
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);

do $$ begin
  begin perform public.is_trusted('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');
        raise exception 'FAIL: is_trusted callable'; exception when insufficient_privilege then null; end;
  begin perform public.is_blocked_between('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');
        raise exception 'FAIL: is_blocked_between callable'; exception when insufficient_privilege then null; end;
  begin perform public.display_name_of('00000000-0000-0000-0000-0000000000a1');
        raise exception 'FAIL: display_name_of callable'; exception when insufficient_privilege then null; end;
  begin perform public.notify('00000000-0000-0000-0000-0000000000a1', 'message', 'spoof');
        raise exception 'FAIL: notify callable'; exception when insufficient_privilege then null; end;
  begin perform public.audit('00000000-0000-0000-0000-0000000000a1', 'spoof');
        raise exception 'FAIL: audit callable'; exception when insufficient_privilege then null; end;
  begin perform public.sever_ties('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');
        raise exception 'FAIL: sever_ties callable'; exception when insufficient_privilege then null; end;
  begin perform public.process_overdue_plans();
        raise exception 'FAIL: process_overdue_plans callable'; exception when insufficient_privilege then null; end;
  begin perform public.expire_stale();
        raise exception 'FAIL: expire_stale callable'; exception when insufficient_privilege then null; end;
  begin perform public.sync_outing_shares(gen_random_uuid());
        raise exception 'FAIL: sync_outing_shares callable'; exception when insufficient_privilege then null; end;
  begin perform public.claim_deliveries(5);
        raise exception 'FAIL: claim_deliveries callable'; exception when insufficient_privilege then null; end;
  begin perform public.kick_delivery();
        raise exception 'FAIL: kick_delivery callable'; exception when insufficient_privilege then null; end;
  raise notice 'PASS: internal / oracle functions are not executable by a signed-in user';
end $$;

-- Remaining caller-bound helpers say nothing about other people's relationships.
do $$ begin
  if public.i_trust('00000000-0000-0000-0000-0000000000a1') then raise exception 'FAIL: i_trust leaks'; end if;
  if public.i_trust('00000000-0000-0000-0000-0000000000a2') then raise exception 'FAIL: i_trust leaks'; end if;
  if public.i_can_view_location('00000000-0000-0000-0000-0000000000a1') then raise exception 'FAIL: location oracle'; end if;
  if public.shares_outing_with_me('00000000-0000-0000-0000-0000000000a1') then raise exception 'FAIL: outing oracle'; end if;
  raise notice 'PASS: caller-bound helpers reveal nothing about unrelated accounts';
end $$;

-- Error messages must not differ between "exists but not related" and "does not exist".
do $$ declare e1 text; e2 text; begin
  begin perform public.start_location_share(array['00000000-0000-0000-0000-0000000000a1'::uuid], 30);
  exception when others then e1 := sqlerrm; end;
  begin perform public.start_location_share(array[gen_random_uuid()], 30);
  exception when others then e2 := sqlerrm; end;
  if e1 is distinct from e2 or e1 is null then raise exception 'FAIL: share error differs (% vs %)', e1, e2; end if;
  e1 := null; e2 := null;
  begin perform public.send_message('00000000-0000-0000-0000-0000000000a1', 'x', gen_random_uuid());
  exception when others then e1 := sqlerrm; end;
  begin perform public.send_message(gen_random_uuid(), 'x', gen_random_uuid());
  exception when others then e2 := sqlerrm; end;
  if e1 is distinct from e2 or e1 is null then raise exception 'FAIL: message error differs'; end if;
  e1 := null; e2 := null;
  begin perform public.create_alert('help_request', 'x', array['00000000-0000-0000-0000-0000000000a1'::uuid], null, null, null, gen_random_uuid());
  exception when others then e1 := sqlerrm; end;
  begin perform public.create_alert('help_request', 'x', array[gen_random_uuid()], null, null, null, gen_random_uuid());
  exception when others then e2 := sqlerrm; end;
  if e1 is distinct from e2 or e1 is null then raise exception 'FAIL: alert error differs'; end if;
  raise notice 'PASS: error messages do not distinguish real from non-existent accounts';
end $$;

-- Tables: Charlie sees nothing of the a1/a2 relationship.
do $$ begin
  if (select count(*) from public.trusted_contacts) <> 0 then raise exception 'FAIL: trusted_contacts leak'; end if;
  if (select count(*) from public.location_shares) <> 0 then raise exception 'FAIL: location_shares leak'; end if;
  if (select count(*) from public.live_locations) <> 0 then raise exception 'FAIL: live_locations leak'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'FAIL: profiles leak'; end if;
  if (select count(*) from public.audit_log) <> 0 then raise exception 'FAIL: audit leak'; end if;
  raise notice 'PASS: no table reveals the a1/a2 relationship to a stranger';
end $$;

-- Block cannot be probed either: Brian blocks Charlie, Charlie's invite looks identical to success.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select public.block_user('00000000-0000-0000-0000-0000000000a3');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
do $$ declare r uuid; begin
  r := public.send_invitation('brian@test.dev');
  if r is null then raise exception 'FAIL: blocked inviter can tell they are blocked'; end if;
  if exists (select 1 from public.friend_invitations) then raise exception 'FAIL: invite stored despite block'; end if;
  raise notice 'PASS: a blocked user cannot detect the block';
end $$;

-- The legitimate parties still work (negative tests must not be passing because everything is broken).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  if not public.i_can_view_location('00000000-0000-0000-0000-0000000000a1') then raise exception 'FAIL: Brian lost access'; end if;
  if (select count(*) from public.live_locations) <> 1 then raise exception 'FAIL: Brian cannot read shared location'; end if;
  raise notice 'PASS: authorised viewer still has access';
end $$;

-- Anonymous (not signed in) gets nothing.
reset role;
set local role anon;
do $$ begin
  begin perform count(*) from public.profiles; raise exception 'FAIL: anon can read profiles';
  exception when insufficient_privilege then null; end;
  begin perform public.send_invitation('x@y.zz'); raise exception 'FAIL: anon can call RPC';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS: anonymous role has no table or function access';
end $$;
reset role;

-- Exact allowlist of functions API roles can execute.
do $$ declare extra text; begin
  select string_agg(p.proname, ', ') into extra
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')
    and p.proname not in (
      'i_trust','shares_outing_with_me','i_am_outing_participant','i_am_alert_recipient','i_am_alert_sender','i_can_view_location',
      'send_invitation','respond_invitation','cancel_invitation','remove_contact','block_user','unblock_user',
      'update_contact_prefs','list_blocked','send_message','mark_messages_delivered','mark_conversation_read',
      'start_location_share','set_share_status','push_location','create_outing','invite_to_outing','respond_outing',
      'set_outing_consent','leave_outing','remove_outing_member','end_outing','update_outing','delete_outing',
      'create_return_plan','start_return_plan','plan_checkin','arrive_safely','cancel_return_plan',
      'create_alert','ack_alert','close_alert','delete_my_account',
      'save_push_subscription','remove_push_subscription','set_notification_prefs');
  if extra is not null then raise exception 'FAIL: unexpected executable functions for authenticated: %', extra; end if;
  select string_agg(p.proname, ', ') into extra
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute');
  if extra is not null then raise exception 'FAIL: anon can execute: %', extra; end if;
  raise notice 'PASS: function privilege allowlist is exact (authenticated) and empty (anon)';
end $$;

-- Secrets in delivery tables are not readable through the API even by their owner.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  begin perform p256dh from public.push_subscriptions; raise exception 'FAIL: push keys readable';
  exception when insufficient_privilege then null; end;
  begin perform error from public.notification_deliveries; raise exception 'FAIL: provider errors readable';
  exception when insufficient_privilege then null; end;
  begin perform * from public.app_settings; raise exception 'FAIL: app_settings readable';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS: push keys, provider errors and worker secrets are not API-readable';
end $$;
reset role;

rollback;
