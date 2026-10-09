import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function getFirebaseAccessToken(serviceAccount: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const signingInput = `${encode(header)}.${encode(payload)}`;

  // Import the private key
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function sendFCM(token: string, title: string, body: string, accessToken: string, projectId: string) {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          android: {
            priority: 'high',
            notification: { sound: 'default', channel_id: 'hearing_reminders' },
          },
        },
      }),
    },
  );
  return res.ok;
}

Deno.serve(async (req) => {
  // Allow manual trigger via POST and scheduled trigger via GET
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!);
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID')!;

  // Get tomorrow's date in IST (UTC+5:30)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const tomorrow = new Date(istNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = tomorrow.toISOString().slice(0, 10);

  // Fetch all hearings scheduled for tomorrow with lawyer FCM tokens
  const { data: hearings, error } = await supabase
    .from('diaries')
    .select('party_names, court_name, court_number, hearing_time, lawyer_id, profiles(fcm_token, name)')
    .eq('matter_date', tomorrowISO)
    .eq('status', 'active');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!hearings || hearings.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: 'No hearings tomorrow' }), { status: 200 });
  }

  const accessToken = await getFirebaseAccessToken(serviceAccount);

  let sent = 0;
  for (const hearing of hearings) {
    const profile = Array.isArray(hearing.profiles) ? hearing.profiles[0] : hearing.profiles;
    const fcmToken = profile?.fcm_token;
    if (!fcmToken) continue;

    const time = hearing.hearing_time ? hearing.hearing_time.slice(0, 5) : '';
    const court = hearing.court_number
      ? `${hearing.court_name} · Court ${hearing.court_number}`
      : hearing.court_name;

    const title = `Hearing Tomorrow${time ? ` at ${time}` : ''}`;
    const body = `${hearing.party_names} — ${court}`;

    const ok = await sendFCM(fcmToken, title, body, accessToken, projectId);
    if (ok) sent++;
  }

  return new Response(JSON.stringify({ sent, total: hearings.length }), { status: 200 });
});
