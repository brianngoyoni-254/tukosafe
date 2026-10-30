// Thin wrappers over Supabase. Authorization is enforced by RLS and the
// SECURITY DEFINER functions in supabase/migrations; nothing here is trusted.
import { supabase, unwrap } from './supabase';

const rpc = async (fn, args) => unwrap(await supabase.rpc(fn, args));

// ── Trust graph ──
export async function fetchTrust(userId) {
  const [contacts, invites, blocked] = await Promise.all([
    supabase.from('trusted_contacts')
      .select('contact_id, receives_sos, receives_checkins, created_at, profile:profiles!trusted_contacts_contact_id_fkey(id, display_name, email, phone)')
      .eq('user_id', userId),
    supabase.from('friend_invitations')
      .select('id, inviter_id, invitee_id, invitee_email, status, created_at, inviter:profiles!friend_invitations_inviter_id_fkey(display_name, email)')
      .eq('status', 'pending').order('created_at', { ascending: false }),
    supabase.rpc('list_blocked'),
  ]);
  return {
    contacts: (unwrap(contacts) || []).map((c) => ({
      id: c.contact_id, name: c.profile?.display_name || 'Unknown', email: c.profile?.email,
      phone: c.profile?.phone, receivesSos: c.receives_sos, receivesCheckins: c.receives_checkins,
      since: c.created_at,
    })),
    invitations: unwrap(invites) || [],
    blocked: unwrap(blocked) || [],
  };
}

export const sendInvitation = (email) => rpc('send_invitation', { p_email: email });
export const respondInvitation = (id, accept) => rpc('respond_invitation', { p_id: id, p_accept: accept });
export const cancelInvitation = (id) => rpc('cancel_invitation', { p_id: id });
export const removeContact = (id) => rpc('remove_contact', { p_contact: id });
export const blockUser = (id) => rpc('block_user', { p_user: id });
export const unblockUser = (id) => rpc('unblock_user', { p_user: id });
export const updateContactPrefs = (id, sos, checkins) =>
  rpc('update_contact_prefs', { p_contact: id, p_sos: sos, p_checkins: checkins });

// ── Messages ──
export async function fetchConversation(me, other, limit = 200) {
  const rows = unwrap(await supabase.from('messages').select('*')
    .or(`and(sender_id.eq.${me},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${me})`)
    .order('created_at', { ascending: false }).limit(limit));
  return rows.reverse();
}
export const sendMessage = (to, body, clientId) =>
  rpc('send_message', { p_to: to, p_body: body, p_client_id: clientId });
export const markConversationRead = (other) => rpc('mark_conversation_read', { p_other: other });
export const markMessagesDelivered = () => rpc('mark_messages_delivered');
export async function fetchUnreadCounts(me) {
  const rows = unwrap(await supabase.from('messages').select('sender_id').eq('recipient_id', me).is('read_at', null));
  return rows.reduce((acc, r) => ({ ...acc, [r.sender_id]: (acc[r.sender_id] || 0) + 1 }), {});
}

// ── Notifications ──
export async function fetchNotifications() {
  return unwrap(await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50));
}
export const markNotificationRead = async (id) =>
  unwrap(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id));
export const markNotificationDelivered = async (id) =>
  unwrap(await supabase.from('notifications').update({ delivered_at: new Date().toISOString() }).eq('id', id));
export const markAllNotificationsRead = async (userId) =>
  unwrap(await supabase.from('notifications').update({ read_at: new Date().toISOString() })
    .eq('user_id', userId).is('read_at', null));

// ── Alerts ──
export const createAlert = ({ kind, message, recipients = null, location = null, clientId }) =>
  rpc('create_alert', {
    p_kind: kind, p_message: message || null, p_recipients: recipients,
    p_lat: location?.lat ?? null, p_lng: location?.lng ?? null, p_accuracy: location?.accuracy ?? null,
    p_client_id: clientId,
  });
export const ackAlert = (id) => rpc('ack_alert', { p_alert: id });
export const closeAlert = (id, status) => rpc('close_alert', { p_alert: id, p_status: status });
export async function fetchAlerts() {
  return unwrap(await supabase.from('sos_alerts')
    .select('*, sender:profiles!sos_alerts_sender_id_fkey(display_name), recipients:sos_recipients(recipient_id, acknowledged_at), attempts:delivery_attempts(recipient_id, notification_id, status, confirmed_at)')
    .order('created_at', { ascending: false }).limit(20));
}

// ── Location ──
export const startLocationShare = (viewers, minutes) => rpc('start_location_share', { p_viewers: viewers, p_minutes: minutes });
export const setShareStatus = (viewer, status) => rpc('set_share_status', { p_viewer: viewer, p_status: status });
export const pushLocation = (c) =>
  rpc('push_location', { p_lat: c.latitude, p_lng: c.longitude, p_accuracy: c.accuracy ?? null, p_heading: c.heading ?? null });
export async function fetchMyShares(userId) {
  return unwrap(await supabase.from('location_shares').select('*').eq('owner_id', userId)
    .in('status', ['active', 'paused']).order('created_at', { ascending: false }));
}
export async function fetchVisibleLocations() {
  // RLS returns only rows the caller may see (own + actively shared with them).
  return unwrap(await supabase.from('live_locations').select('*'));
}

// ── Outings ──
export async function fetchOutings() {
  return unwrap(await supabase.from('outings')
    .select('*, members:outing_members(user_id, status, shares_location, invited_at, responded_at, profile:profiles!outing_members_user_id_fkey(display_name))')
    .order('created_at', { ascending: false }).limit(20));
}
export const createOuting = ({ title, venue, startsAt, endsAt, invitees }) =>
  rpc('create_outing', { p_title: title, p_venue: venue, p_starts: startsAt, p_ends: endsAt, p_invitees: invitees });
export const inviteToOuting = (outing, user) => rpc('invite_to_outing', { p_outing: outing, p_user: user });
export const respondOuting = (outing, accept, share) =>
  rpc('respond_outing', { p_outing: outing, p_accept: accept, p_share_location: share });
export const setOutingConsent = (outing, share) => rpc('set_outing_consent', { p_outing: outing, p_share: share });
export const leaveOuting = (outing) => rpc('leave_outing', { p_outing: outing });
export const removeOutingMember = (outing, user) => rpc('remove_outing_member', { p_outing: outing, p_user: user });
export const endOuting = (outing) => rpc('end_outing', { p_outing: outing });
export const updateOuting = ({ id, title, venue, startsAt, endsAt }) =>
  rpc('update_outing', { p_outing: id, p_title: title, p_venue: venue, p_starts: startsAt, p_ends: endsAt });
export const deleteOuting = (outing) => rpc('delete_outing', { p_outing: outing });

// ── Return-home plans ──
export async function fetchPlans() {
  // RLS returns my plans plus plans of people who designated me.
  return unwrap(await supabase.from('return_home_plans').select('*').order('created_at', { ascending: false }).limit(30));
}
export const createReturnPlan = ({ destination, expected, grace, notify }) =>
  rpc('create_return_plan', { p_destination: destination, p_expected: expected, p_grace: grace, p_notify: notify });
export const startReturnPlan = (id) => rpc('start_return_plan', { p_plan: id });
export const planCheckin = (id, note) => rpc('plan_checkin', { p_plan: id, p_note: note || null });
export const arriveSafely = (id) => rpc('arrive_safely', { p_plan: id });
export const cancelReturnPlan = (id) => rpc('cancel_return_plan', { p_plan: id });
export const extendReturnPlan = (id, minutes) => rpc('extend_return_plan', { p_plan: id, p_minutes: minutes });
export async function fetchCheckins(planId) {
  return unwrap(await supabase.from('checkins').select('*').eq('plan_id', planId).order('created_at', { ascending: false }));
}

// ── Notification channels ──
export async function fetchPrefs(userId) {
  const row = unwrap(await supabase.from('notification_prefs').select('*').eq('user_id', userId).maybeSingle());
  return row || { push: true, email: false, sms: false };
}
export const setPrefs = ({ push, email, sms }) =>
  rpc('set_notification_prefs', { p_push: push, p_email: email, p_sms: sms });
export const savePushSubscription = (sub) =>
  rpc('save_push_subscription', { p_endpoint: sub.endpoint, p_p256dh: sub.p256dh, p_auth: sub.auth, p_ua: navigator.userAgent });
export const removePushSubscription = (endpoint) => rpc('remove_push_subscription', { p_endpoint: endpoint });
export async function fetchDeliveries(notificationIds) {
  if (!notificationIds.length) return [];
  return unwrap(await supabase.from('notification_deliveries')
    .select('notification_id, user_id, channel, status').in('notification_id', notificationIds));
}
