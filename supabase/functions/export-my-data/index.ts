import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

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
  const user = userData.user;
  if (userError || !user) return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers });

  const [profile, privateDetails, cases, documents, invoices, payments, settings, subscriptions, portalTokens] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('lawyer_private_details').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('diaries').select('*').eq('lawyer_id', user.id),
    supabase.from('documents').select('*').eq('owner_id', user.id),
    supabase.from('invoices').select('*').eq('lawyer_id', user.id),
    supabase.from('fee_payments').select('*').eq('lawyer_id', user.id),
    supabase.from('notification_settings').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('subscriptions').select('*').eq('user_id', user.id),
    supabase.from('client_portal_tokens').select('*').eq('lawyer_id', user.id),
  ]);

  const caseIds = (cases.data ?? []).map((item) => item.id);
  const { data: timelineEntries } = caseIds.length
    ? await supabase.from('diary_timeline_entries').select('*').in('diary_id', caseIds)
    : { data: [] };

  const payload = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at },
    profile: profile.data,
    lawyer_private_details: privateDetails.data,
    cases: cases.data ?? [],
    timeline_entries: timelineEntries ?? [],
    document_metadata: documents.data ?? [],
    invoices: invoices.data ?? [],
    fee_payments: payments.data ?? [],
    notification_settings: settings.data,
    subscriptions: subscriptions.data ?? [],
    client_portal_tokens: portalTokens.data ?? [],
    note: 'Document metadata is included. Download original document files separately from the Vault before requesting account deletion.',
  };

  return new Response(JSON.stringify(payload), { headers });
});
