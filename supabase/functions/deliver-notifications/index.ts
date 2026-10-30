// Supabase Edge Function: delivers queued notifications over web push, email and SMS.
// Deploy:  supabase functions deploy deliver-notifications --no-verify-jwt
// It is called by the database (pg_net, see migration 3) and by pg_cron, authenticated with a shared secret.
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';
import { processBatch } from './worker.js';

const env = Deno.env.toObject();

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (!env.DELIVERY_SECRET || req.headers.get('x-delivery-secret') !== env.DELIVERY_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }
  // SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform; the key never leaves the server.
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const summary = await processBatch({
    env,
    webpush,
    fetchImpl: fetch,
    claim: async (limit: number) => {
      const { data, error } = await db.rpc('claim_deliveries', { p_limit: limit });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    finish: async (id: string, status: string, ref: string | null, error: string | null, retry: boolean) => {
      const { error: e } = await db.rpc('finish_delivery', { p_id: id, p_status: status, p_ref: ref, p_error: error, p_retry: retry });
      if (e) console.error('finish_delivery', e.message);
    },
    recordPush: async (sub: string, ok: boolean, gone: boolean) => {
      const { error: e } = await db.rpc('record_push_result', { p_subscription: sub, p_ok: ok, p_gone: gone });
      if (e) console.error('record_push_result', e.message);
    },
  });
  return new Response(JSON.stringify(summary), { headers: { 'Content-Type': 'application/json' } });
});
