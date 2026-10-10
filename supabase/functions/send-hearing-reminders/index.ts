import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM_EMAIL = 'VakilDesk <reminders@vakildesks.in>';

// ── Resend ────────────────────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    console.error('Resend error:', await res.text());
  }
  return res.ok;
}

function emailHtml(lawyerName: string, hearings: { party_names: string; court: string; time: string }[]): string {
  const rows = hearings
    .map(
      (h) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #2a2a2a;">
          <strong style="color:#c9a24b;">${h.party_names}</strong><br/>
          <span style="color:#888;font-size:13px;">${h.court}${h.time ? ' · ' + h.time : ''}</span>
        </td>
      </tr>`,
    )
    .join('');

  return `
    <div style="background:#0f0f0f;color:#e5e5e5;font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;border-radius:12px;">
      <h2 style="color:#c9a24b;margin:0 0 4px;">VakilDesk</h2>
      <p style="color:#888;font-size:13px;margin:0 0 24px;">Hearing Reminder</p>
      <p style="margin:0 0 16px;">Dear <strong>${lawyerName}</strong>,</p>
      <p style="margin:0 0 20px;color:#ccc;">You have the following hearing(s) scheduled for <strong style="color:#fff;">tomorrow</strong>:</p>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <p style="margin:24px 0 0;font-size:12px;color:#555;">
        You're receiving this because you enabled email reminders in VakilDesk.<br/>
        Manage your preferences at <a href="https://vakildesks.in/settings/notifications" style="color:#c9a24b;">vakildesks.in</a>
      </p>
    </div>`;
}

// ── FCM ───────────────────────────────────────────────────────────────────────
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

// ── Main ──────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Tomorrow in IST (UTC+5:30)
  const now = new Date();
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const tomorrow = new Date(istNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = tomorrow.toISOString().slice(0, 10);

  // Fetch hearings with lawyer profile + notification settings
  const { data: hearings, error } = await supabase
    .from('diaries')
    .select(`
      party_names, court_name, court_number, hearing_time, lawyer_id,
      profiles!inner(name, email, fcm_token),
      notification_settings!left(email_enabled, reminder_hours)
    `)
    .eq('matter_date', tomorrowISO)
    .eq('status', 'active');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!hearings || hearings.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: 'No hearings tomorrow' }), { status: 200 });
  }

  // Group hearings by lawyer_id so we send one email per lawyer (not one per case)
  const byLawyer = new Map<string, typeof hearings>();
  for (const h of hearings) {
    const existing = byLawyer.get(h.lawyer_id) ?? [];
    existing.push(h);
    byLawyer.set(h.lawyer_id, existing);
  }

  const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!);
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID')!;
  const fcmAccessToken = await getFirebaseAccessToken(serviceAccount);

  let emailsSent = 0;
  let pushSent = 0;

  for (const [, lawyerHearings] of byLawyer) {
    const first = lawyerHearings[0];
    const profile = Array.isArray(first.profiles) ? first.profiles[0] : first.profiles;
    const notifSettings = Array.isArray(first.notification_settings)
      ? first.notification_settings[0]
      : first.notification_settings;

    const emailEnabled = notifSettings?.email_enabled ?? true; // default on
    const fcmToken = profile?.fcm_token;

    // ── Email via Resend ──
    if (emailEnabled && profile?.email) {
      const hearingList = lawyerHearings.map((h) => ({
        party_names: h.party_names,
        court: h.court_number ? `${h.court_name} · Court ${h.court_number}` : h.court_name,
        time: h.hearing_time ? h.hearing_time.slice(0, 5) : '',
      }));

      const subject = lawyerHearings.length === 1
        ? `Hearing tomorrow: ${lawyerHearings[0].party_names}`
        : `${lawyerHearings.length} hearings tomorrow — VakilDesk`;

      const ok = await sendEmail(
        profile.email,
        subject,
        emailHtml(profile.name, hearingList),
      );
      if (ok) emailsSent++;
    }

    // ── FCM push notification ──
    if (fcmToken) {
      const time = first.hearing_time ? first.hearing_time.slice(0, 5) : '';
      const court = first.court_number
        ? `${first.court_name} · Court ${first.court_number}`
        : first.court_name;
      const title = `Hearing Tomorrow${time ? ` at ${time}` : ''}`;
      const body = lawyerHearings.length === 1
        ? `${first.party_names} — ${court}`
        : `${lawyerHearings.length} hearings scheduled`;

      const ok = await sendFCM(fcmToken, title, body, fcmAccessToken, projectId);
      if (ok) pushSent++;
    }
  }

  return new Response(
    JSON.stringify({ emailsSent, pushSent, lawyers: byLawyer.size }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
