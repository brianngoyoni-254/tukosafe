-- Server-side reminder to the traveller at the expected arrival time, and ETA extension.
alter table public.return_home_plans add column if not exists reminder_sent_at timestamptz;

create or replace function public.process_overdue_plans() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0;
begin
  -- Stage 1: remind the traveller (push / in-app) the moment they are due.
  for r in select id, user_id, grace_minutes from return_home_plans
           where status = 'active' and reminder_sent_at is null and expected_arrival <= now()
           for update skip locked loop
    update return_home_plans set reminder_sent_at = now() where id = r.id;
    perform notify(r.user_id, 'checkin', 'Are you home safe?',
      'Confirm you have arrived. If you do not, your contacts are alerted in ' || r.grace_minutes || ' minutes.',
      jsonb_build_object('plan_id', r.id, 'stage', 'reminder'));
  end loop;

  -- Stage 2: grace expired -> alert designated contacts exactly once (status leaves 'active').
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

create or replace function public.extend_return_plan(p_plan uuid, p_minutes int) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := require_user();
begin
  if p_minutes is null or p_minutes < 5 or p_minutes > 240 then raise exception 'Choose between 5 and 240 minutes.'; end if;
  update return_home_plans
  set expected_arrival = greatest(expected_arrival, now()) + make_interval(mins => p_minutes), reminder_sent_at = null
  where id = p_plan and user_id = v_me and status = 'active';
  if not found then raise exception 'Only an active journey that has not been escalated can be extended.'; end if;
  perform notify_plan_contacts(p_plan, 'checkin', display_name_of(v_me) || ' is running late',
    'New expected arrival in about ' || p_minutes || ' minutes.');
end $$;

revoke execute on function public.process_overdue_plans(), public.extend_return_plan(uuid, int) from public, anon, authenticated;
grant execute on function public.extend_return_plan(uuid, int) to authenticated;
