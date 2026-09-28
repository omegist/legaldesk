import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!;
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: userData, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (userError || !userData.user) return json({ error: 'Not authenticated' }, 401);
    const user = userData.user;

    const { data: row } = await supabase
      .from('subscriptions')
      .select('id, razorpay_subscription_id, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'authenticated', 'pending', 'halted'])
      .maybeSingle();

    if (!row) return json({ error: 'No active subscription to cancel' }, 404);

    const auth = 'Basic ' + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    const rpRes = await fetch(
      `https://api.razorpay.com/v1/subscriptions/${row.razorpay_subscription_id}/cancel`,
      {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_at_cycle_end: 1 }),
      },
    );

    const result = await rpRes.json();
    if (!rpRes.ok) {
      console.error('Razorpay cancel error:', result);
      return json({ error: result.error?.description || 'Could not cancel subscription' }, 502);
    }

    await supabase.from('subscriptions').update({ cancel_at_period_end: true }).eq('id', row.id);

    return json({ ok: true, current_period_end: result.current_end });
  } catch (err) {
    console.error('razorpay-cancel-subscription error:', err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}