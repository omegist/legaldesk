import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!;
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!;

const PLAN_IDS: Record<string, string | undefined> = {
  pro: Deno.env.get('RAZORPAY_PLAN_PRO'),
  firm: Deno.env.get('RAZORPAY_PLAN_FIRM'),
};

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

    const { tier } = await req.json();
    if (tier !== 'pro' && tier !== 'firm') return json({ error: 'Invalid tier' }, 400);

    const planId = PLAN_IDS[tier];
    if (!planId) return json({ error: `No Razorpay plan configured for tier "${tier}"` }, 500);

    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['created', 'authenticated', 'active', 'pending', 'halted'])
      .maybeSingle();
    if (existing) return json({ error: 'You already have a subscription in progress or active.' }, 409);

    const auth = 'Basic ' + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
        console.log('Attempting subscription with planId:', planId, 'keyId starts with:', RAZORPAY_KEY_ID.slice(0, 12));
    const rpRes = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: planId,
        customer_notify: 1,
        total_count: 120,
        notes: { supabase_user_id: user.id, tier },
      }),
    });

    const subscription = await rpRes.json();
    if (!rpRes.ok) {
      console.error('Razorpay error:', subscription);
      return json({ error: subscription.error?.description || 'Could not create subscription' }, 502);
    }

    await supabase.from('subscriptions').insert({
      user_id: user.id,
      razorpay_subscription_id: subscription.id,
      razorpay_plan_id: planId,
      tier,
      status: 'created',
    });

    return json({
      subscription_id: subscription.id,
      key_id: RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('razorpay-create-subscription error:', err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}