import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
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
  const { message } = await request.json();
  const text = typeof message === 'string' ? message.trim() : '';
  if (text.length < 3 || text.length > 2000) return new Response(JSON.stringify({ error: 'Feedback must be 3–2000 characters' }), { status: 400, headers });
  const { error } = await supabase.from('customer_feedback').insert({ user_id: userData.user.id, message: text });
  if (error) return new Response(JSON.stringify({ error: 'Could not submit feedback' }), { status: 500, headers });
  return new Response(JSON.stringify({ submitted: true }), { headers });
});
