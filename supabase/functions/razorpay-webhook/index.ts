import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  const isValid = await verifySignature(rawBody, signature, WEBHOOK_SECRET);
  if (!isValid) {
    console.error('Razorpay webhook: signature verification failed');
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const eventType = event.event as string;
  const sub = event.payload?.subscription?.entity;

  if (!sub?.id) return new Response('ok', { status: 200 });

  const { data: row } = await supabase
    .from('subscriptions')
    .select('id, user_id, tier')
    .eq('razorpay_subscription_id', sub.id)
    .maybeSingle();

  if (!row) {
    console.warn('Webhook for unknown subscription:', sub.id);
    return new Response('ok', { status: 200 });
  }

  const statusMap: Record<string, string> = {
    'subscription.authenticated': 'authenticated',
    'subscription.activated': 'active',
    'subscription.charged': 'active',
    'subscription.pending': 'pending',
    'subscription.halted': 'halted',
    'subscription.cancelled': 'cancelled',
    'subscription.completed': 'completed',
    'subscription.expired': 'expired',
  };

  const newStatus = statusMap[eventType];
  if (!newStatus) return new Response('ok', { status: 200 });

  const { error: subUpdateError } = await supabase
    .from('subscriptions')
    .update({
      status: newStatus,
      current_period_end: sub.current_end ? new Date(sub.current_end * 1000).toISOString() : null,
    })
    .eq('id', row.id);

  if (subUpdateError) {
    console.error('Failed to update subscription row:', subUpdateError);
    return new Response('Internal error', { status: 500 });
  }

  if (newStatus === 'active') {
    const isMultiUser = row.tier === 'chambers' || row.tier === 'firm';

    if (isMultiUser) {
      // A firms row MUST exist before we set firm_id on the profile.
      // firm_id is a FK → firms.id, so setting firm_id = user_id without a
      // matching row causes a FK violation and the whole update silently fails.
      const { error: firmError } = await supabase
        .from('firms')
        .upsert({ id: row.user_id, owner_id: row.user_id }, { onConflict: 'id' });

      if (firmError) {
        console.error('Failed to upsert firms row:', firmError);
        return new Response('Internal error', { status: 500 });
      }
    }

    const profileUpdate: Record<string, unknown> = { subscription_tier: row.tier };
    if (isMultiUser) profileUpdate.firm_id = row.user_id;

    const { error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', row.user_id);

    if (profileError) {
      console.error('Failed to update profile tier/firm_id:', profileError);
      return new Response('Internal error', { status: 500 });
    }
  } else if (newStatus === 'halted') {
    // Payment failed — downgrade to free but keep firm_id briefly so members
    // aren't immediately kicked while the lawyer resolves the payment issue.
    const { error } = await supabase
      .from('profiles')
      .update({ subscription_tier: 'free' })
      .eq('id', row.user_id);
    if (error) console.error('Failed to downgrade halted subscription:', error);
  } else if (['cancelled', 'expired', 'completed'].includes(newStatus)) {
    // Clear firm_id for the owner AND all members
    const { error: ownerErr } = await supabase
      .from('profiles')
      .update({ subscription_tier: 'free', firm_id: null })
      .eq('id', row.user_id);
    if (ownerErr) console.error('Failed to clear owner firm_id:', ownerErr);

    const { error: membersErr } = await supabase
      .from('profiles')
      .update({ firm_id: null })
      .eq('firm_id', row.user_id)
      .neq('id', row.user_id);
    if (membersErr) console.error('Failed to clear member firm_ids:', membersErr);
  }

  return new Response('ok', { status: 200 });
});

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return expected === signature;
}