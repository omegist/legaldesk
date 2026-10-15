import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
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

  const { error } = await supabase.from('privacy_requests').insert({
    user_id: userData.user.id,
    request_type: 'account_deletion',
  });
  if (error && error.code !== '23505') {
    console.error('Account deletion request failed:', error.code);
    return new Response(JSON.stringify({ error: 'Could not submit request' }), { status: 500, headers });
  }
  return new Response(JSON.stringify({ requested: true }), { headers });
});
