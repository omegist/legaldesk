import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM_EMAIL = Deno.env.get('WELCOME_FROM_EMAIL') ?? 'VakilDesk <no-reply@vakildesks.in>';
const APP_URL = Deno.env.get('APP_URL') ?? 'https://vakildesks.in';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!),
  );
}

function welcomeEmailHtml(name: string): string {
  const greeting = name ? `Welcome, ${esc(name)}.` : 'Welcome to VakilDesk.';
  return `
    <div style="margin:0;padding:32px 12px;background:#090d18;font-family:Arial,Helvetica,sans-serif;color:#edf2f7;">
      <div style="max-width:560px;margin:0 auto;background:#101827;border:1px solid #25324a;border-radius:16px;overflow:hidden;">
        <div style="padding:28px 32px 20px;text-align:center;border-bottom:1px solid #25324a;">
          <div style="font-family:Georgia,serif;font-size:27px;font-weight:700;color:#d9a73d;">&#9878; VakilDesk</div>
          <div style="margin-top:7px;font-size:12px;letter-spacing:1.5px;color:#91a0b8;">LEGAL PRACTICE MANAGEMENT</div>
        </div>
        <div style="padding:32px;">
          <div style="margin:0 0 9px;font-size:11px;font-weight:700;letter-spacing:1.4px;color:#d9a73d;">ACCOUNT ACTIVATED</div>
          <h1 style="margin:0 0 14px;color:#ffffff;font-family:Georgia,serif;font-size:25px;">Welcome to VakilDesk</h1>
          <p style="margin:0 0 18px;color:#c5cfdf;font-size:16px;line-height:1.6;">${greeting} Your account is confirmed and ready to help you manage your legal practice.</p>
          <div style="margin:0 0 24px;padding:18px 20px;background:#0a1120;border:1px solid #3b4b67;border-radius:10px;">
            <div style="margin-bottom:10px;color:#e8b84a;font-size:15px;font-weight:700;">Start with VakilDesk</div>
            <div style="color:#aab7cc;font-size:14px;line-height:1.7;">Add your first case, record hearing dates, organise documents, and enable reminders so you never miss an important date.</div>
          </div>
          <div style="text-align:center;">
            <a href="${APP_URL}/dashboard" style="display:inline-block;padding:12px 18px;background:#d9a73d;border-radius:8px;color:#101827;font-size:14px;font-weight:700;text-decoration:none;">Open VakilDesk</a>
          </div>
        </div>
        <div style="padding:18px 32px;background:#0a1120;border-top:1px solid #25324a;text-align:center;">
          <p style="margin:0;color:#71809a;font-size:12px;">&copy; 2026 VakilDesk &middot; vakildesks.in</p>
        </div>
      </div>
    </div>`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Not authenticated' }, 401);

  const { data: userData, error: userError } = await supabase.auth.getUser(authorization.slice(7));
  const user = userData.user;
  if (userError || !user?.email || !user.email_confirmed_at) return json({ error: 'Account is not confirmed' }, 401);

  // A primary-key insert is an atomic claim. A duplicate means a welcome email
  // has already been sent (or is being sent) for this user.
  const { error: claimError } = await supabase.from('welcome_email_log').insert({ user_id: user.id });
  if (claimError) {
    if (claimError.code === '23505') return json({ sent: false, reason: 'already_sent' });
    console.error('Welcome-email claim failed:', claimError.code);
    return json({ error: 'Unable to prepare welcome email' }, 500);
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: user.email,
      subject: 'Welcome to VakilDesk',
      html: welcomeEmailHtml(String(user.user_metadata?.name ?? '')),
    }),
  });

  if (!response.ok) {
    // Release the claim so a later authenticated retry can send the email.
    await supabase.from('welcome_email_log').delete().eq('user_id', user.id);
    console.error('Resend welcome-email error status:', response.status);
    return json({ error: 'Unable to send welcome email' }, 502);
  }

  return json({ sent: true });
});
