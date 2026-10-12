import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ── Config ────────────────────────────────────────────────────────────────────
// FROM_EMAIL and APP_URL must be set as Supabase secrets.
// FROM_EMAIL example: VakilDesk <reminders@vakildesks.in>
// APP_URL example: https://vakildesks.in
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'VakilDesk <reminders@vakildesks.in>';
const APP_URL = Deno.env.get('APP_URL') ?? 'https://vakildesks.in';

// ── HTML escaping ─────────────────────────────────────────────────────────────
// MUST be applied to every user-controlled value interpolated into email HTML.
function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!),
  );
}

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
    // Log status code only — don't log email addresses or keys
    console.error('Resend error status:', res.status);
  }
  return res.ok;
}

function emailHtml(
  lawyerName: string,
  hearings: { party_names: string; court: string; time: string }[],
): string {
  const rows = hearings
    .map(
      (h) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #2a2a2a;">
          <strong style="color:#c9a24b;">${esc(h.party_names)}</strong><br/>
          <span style="color:#888;font-size:13px;">${esc(h.court)}${h.time ? ' · ' + esc(h.time) : ''}</span>
        </td>
      </tr>`,
    )
    .join('');

  const settingsUrl = `${APP_URL}/settings/notifications`;

  return `
    <div style="background:#0f0f0f;color:#e5e5e5;font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;border-radius:12px;">
      <h2 style="color:#c9a24b;margin:0 0 4px;">VakilDesk</h2>
      <p style="color:#888;font-size:13px;margin:0 0 24px;">Hearing Reminder</p>
      <p style="margin:0 0 16px;">Dear <strong>${esc(lawyerName)}</strong>,</p>
      <p style="margin:0 0 20px;color:#ccc;">You have the following hearing(s) scheduled for <strong style="color:#fff;">tomorrow</strong>:</p>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <p style="margin:24px 0 0;font-size:12px;color:#555;">
        You're receiving this because you enabled email reminders in VakilDesk.<br/>
        Manage your preferences at <a href="${settingsUrl}" style="color:#c9a24b;">${APP_URL.replace(/^https?:\/\//, '')}/settings/notifications</a>
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

async function sendFCM(
  token: string,
  title: string,
  body: string,
  accessToken: string,
  projectId: string,
): Promise<'ok' | 'invalid_token' | 'error'> {
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
  if (res.ok) return 'ok';
  const errBody = await res.json().catch(() => ({}));
  const errCode = errBody?.error?.details?.[0]?.errorCode ?? '';
  if (errCode === 'UNREGISTERED' || errCode === 'INVALID_ARGUMENT') return 'invalid_token';
  return 'error';
}

// ── Main ──────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Fail-closed: reject if the secret is not configured OR if the caller
  // didn't provide it. Use x-cron-secret to avoid clashing with Supabase's
  // own Authorization: Bearer JWT check.
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) {
    console.error('CRON_SECRET env var is not set — refusing to run');
    return new Response('Service misconfigured', { status: 500 });
  }
  const providedSecret = req.headers.get('x-cron-secret');
  if (providedSecret !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Tomorrow in IST (UTC+5:30)
  const now = new Date();
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const tomorrow = new Date(istNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = tomorrow.toISOString().slice(0, 10);

  // ── Fetch hearings (no embed — separate profile/settings queries) ────────────
  const { data: diaries, error } = await supabase
    .from('diaries')
    .select('id, party_names, court_name, court_number, hearing_time, lawyer_id')
    .eq('matter_date', tomorrowISO)
    .eq('status', 'active');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!diaries || diaries.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: 'No hearings tomorrow' }), { status: 200 });
  }

  const lawyerIds = [...new Set(diaries.map((d) => d.lawyer_id))];

  const [{ data: profileRows }, { data: settingsRows }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, email, fcm_token')
      .in('id', lawyerIds),
    supabase
      .from('notification_settings')
      .select('user_id, email_enabled, push_enabled')
      .in('user_id', lawyerIds),
  ]);

  const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]));
  const settingsMap = new Map((settingsRows ?? []).map((s) => [s.user_id, s]));

  // Group hearings by lawyer
  const byLawyer = new Map<string, typeof diaries>();
  for (const d of diaries) {
    const existing = byLawyer.get(d.lawyer_id) ?? [];
    existing.push(d);
    byLawyer.set(d.lawyer_id, existing);
  }

  // FCM setup (only if configured)
  const fcmServiceAccountRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID');
  let fcmAccessToken: string | null = null;
  if (fcmServiceAccountRaw && projectId) {
    try {
      const serviceAccount = JSON.parse(fcmServiceAccountRaw);
      fcmAccessToken = await getFirebaseAccessToken(serviceAccount);
    } catch (e) {
      console.error('FCM token error:', e);
    }
  }

  let emailsSent = 0;
  let pushSent = 0;
  const invalidTokens: string[] = [];

  for (const [lawyerId, lawyerHearings] of byLawyer) {
    try {
      const profile = profileMap.get(lawyerId);
      const ns = settingsMap.get(lawyerId);
      const emailEnabled = ns?.email_enabled ?? true; // default on
      const pushEnabled = ns?.push_enabled ?? true;

      // ── Claim this reminder to prevent double sends ──────────────────────
      // Uses upsert + ignoreDuplicates so a second run is a no-op.
      const diary0 = lawyerHearings[0];

      // ── Email via Resend ─────────────────────────────────────────────────
      if (emailEnabled && profile?.email) {
        const { data: claimed } = await supabase
          .from('reminder_log')
          .upsert(
            { diary_id: diary0.id, reminder_date: tomorrowISO, channel: 'email' },
            { onConflict: 'diary_id,reminder_date,channel', ignoreDuplicates: true },
          )
          .select('id');

        if (claimed && claimed.length > 0) {
          const hearingList = lawyerHearings.map((h) => ({
            party_names: h.party_names ?? '',
            court: h.court_number
              ? `${h.court_name ?? ''} · Court ${h.court_number}`
              : (h.court_name ?? ''),
            time: h.hearing_time ? h.hearing_time.slice(0, 5) : '',
          }));

          const subject =
            lawyerHearings.length === 1
              ? `Hearing tomorrow: ${lawyerHearings[0].party_names ?? ''}`
              : `${lawyerHearings.length} hearings tomorrow — VakilDesk`;

          const ok = await sendEmail(
            profile.email,
            subject,
            emailHtml(profile.name ?? '', hearingList),
          );
          if (ok) {
            emailsSent++;
          } else {
            // Delete the claim so a retry can re-send
            await supabase
              .from('reminder_log')
              .delete()
              .eq('diary_id', diary0.id)
              .eq('reminder_date', tomorrowISO)
              .eq('channel', 'email');
          }
        }
      }

      // ── FCM push notification ────────────────────────────────────────────
      if (pushEnabled && fcmAccessToken && projectId && profile?.fcm_token) {
        const { data: pushClaimed } = await supabase
          .from('reminder_log')
          .upsert(
            { diary_id: diary0.id, reminder_date: tomorrowISO, channel: 'push' },
            { onConflict: 'diary_id,reminder_date,channel', ignoreDuplicates: true },
          )
          .select('id');

        if (pushClaimed && pushClaimed.length > 0) {
          const time = diary0.hearing_time ? diary0.hearing_time.slice(0, 5) : '';
          const court = diary0.court_number
            ? `${diary0.court_name} · Court ${diary0.court_number}`
            : diary0.court_name;
          const title = `Hearing Tomorrow${time ? ` at ${time}` : ''}`;
          const body =
            lawyerHearings.length === 1
              ? `${diary0.party_names ?? ''} — ${court ?? ''}`
              : `${lawyerHearings.length} hearings scheduled`;

          const result = await sendFCM(
            profile.fcm_token,
            title,
            body,
            fcmAccessToken,
            projectId,
          );

          if (result === 'ok') {
            pushSent++;
          } else if (result === 'invalid_token') {
            // Token is stale — clear it so future runs skip this device
            invalidTokens.push(lawyerId);
            await supabase
              .from('reminder_log')
              .delete()
              .eq('diary_id', diary0.id)
              .eq('reminder_date', tomorrowISO)
              .eq('channel', 'push');
          } else {
            // Transient error — delete claim so a retry can push
            await supabase
              .from('reminder_log')
              .delete()
              .eq('diary_id', diary0.id)
              .eq('reminder_date', tomorrowISO)
              .eq('channel', 'push');
          }
        }
      }

      // Throttle slightly to avoid Resend rate-limit (100ms between lawyers)
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (err) {
      // One lawyer's failure must not stop the rest
      console.error('Reminder error for lawyer (id redacted):', (err as Error).message);
    }
  }

  // Clear stale FCM tokens in bulk
  if (invalidTokens.length > 0) {
    await supabase
      .from('profiles')
      .update({ fcm_token: null })
      .in('id', invalidTokens);
  }

  return new Response(
    JSON.stringify({ emailsSent, pushSent, lawyers: byLawyer.size }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
