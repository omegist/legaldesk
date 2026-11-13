import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const allowedEvents = new Set([
  'signup_started', 'signup_confirmed', 'password_reset_requested',
  'password_reset_completed', 'checkout_started', 'checkout_completed',
]);
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers });
  const { data: userData, error: userError } = await supabase.auth.getUser(authorization.slice(7));
  if (userError || !userData.user) return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers });
  const { event } = await request.json();
  if (typeof event !== 'string' || !allowedEvents.has(event)) return new Response(JSON.stringify({ error: 'Invalid event' }), { status: 400, headers });
  const { error } = await supabase.from('product_events').insert({ user_id: userData.user.id, event_name: event });
  if (error) return new Response(JSON.stringify({ error: 'Could not record event' }), { status: 500, headers });
  return new Response(JSON.stringify({ recorded: true }), { headers });
});
