import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const ECOURTSINDIA_API_KEY = Deno.env.get('ECOURTSINDIA_API_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'VakilDesk <reminders@vakildesks.in>';

const SYNC_WINDOW_DAYS = 3;
const COOLDOWN_HOURS = 12;

interface HearingHistoryEntry {
  judge: string;
  businessOnDate: string;
  purposeOfListing: string;
}

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
  if (req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  // The legacy implementation below remains for deployment compatibility, but
  // this is the only active path. It uses one bulk-refresh request per batch;
  // it never performs the expensive GET case import or fetches court orders.
  const result = await runCreditOptimizedAutoSync();
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  const istOffset = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(Date.now() + istOffset);
  const todayISO = nowIST.toISOString().slice(0, 10);
  const windowEnd = new Date(nowIST);
  windowEnd.setDate(windowEnd.getDate() + SYNC_WINDOW_DAYS);
  const windowEndISO = windowEnd.toISOString().slice(0, 10);
  const cooldownCutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();

  const { data: cases, error } = await supabase
    .from('diaries')
    .select('id, cnr_number, lawyer_id, firm_id, matter_date, cnr_last_synced_at')
    .not('cnr_number', 'is', null)
    .eq('cnr_sync_enabled', true)
    .eq('status', 'active')
    .gte('matter_date', todayISO)
    .lte('matter_date', windowEndISO)
    .or(`cnr_last_synced_at.is.null,cnr_last_synced_at.lt.${cooldownCutoff}`);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!cases || cases.length === 0) {
    return new Response(JSON.stringify({ synced: 0, message: 'No cases need syncing' }), { status: 200 });
  }

  // Fetch profiles separately to avoid broken !inner embed
  const lawyerIds = [...new Set(cases.map((c) => c.lawyer_id))];
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, subscription_tier, firm_id')
    .in('id', lawyerIds);
  const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]));

  let synced = 0;
  let failed = 0;

  for (const diary of cases) {
    // Skip free-tier lawyers (and firm members whose owner is also free)
    const lp = profileMap.get(diary.lawyer_id);
    if (!lp) { failed++; continue; }
    const isOwnerPaid = ['pro', 'chambers', 'firm'].includes(lp.subscription_tier);
    let isPaid = isOwnerPaid;
    if (!isPaid && lp.firm_id && lp.firm_id !== diary.lawyer_id) {
      const ownerProfile = profileMap.get(lp.firm_id);
      isPaid = ownerProfile?.subscription_tier === 'chambers' || ownerProfile?.subscription_tier === 'firm';
    }
    if (!isPaid) continue;

    try {
      const res = await fetch(
        `https://webapi.ecourtsindia.com/api/partner/case/${diary.cnr_number}`,
        { headers: { Authorization: `Bearer ${ECOURTSINDIA_API_KEY}` } },
      );

      if (!res.ok) {
        console.error(`eCourts API error for ${diary.cnr_number}:`, await res.text());
        failed++;
        continue;
      }

      const payload = await res.json();
      const c = payload.data.courtCaseData;
      const isDisposed = c.caseStatus === 'DISPOSED';

      const update: Record<string, unknown> = {
        purpose_of_hearing: c.stageOfCaseRaw || c.purpose || null,
        judge_name: c.judges?.[0] ?? null,
        court_name: c.courtName,
        court_number: c.courtNo != null ? String(c.courtNo) : null,
        party_names: formatPartyNames(c.petitioners, c.respondents),
        opponent_advocate: c.respondentAdvocates?.[0] ?? null,
        cnr_last_synced_at: new Date().toISOString(),
      };

      // Only update matter_date if court provides a non-null next hearing date
      if (c.nextHearingDate) update.matter_date = c.nextHearingDate;

      // Set status=disposed when court says so (stops reminders automatically)
      if (isDisposed) update.status = 'disposed';

      // Never write 'active' or 'disposed' into stage_of_case — it's a free-text field
      // stage_of_case is only updated from stageOfCaseRaw above via purpose_of_hearing

      await supabase.from('diaries').update(update).eq('id', diary.id);

      const history: HearingHistoryEntry[] = c.historyOfCaseHearings || [];
      for (const h of history) {
        const content = `${h.purposeOfListing} — before ${h.judge}`;
        const { data: existing } = await supabase
          .from('diary_timeline_entries')
          .select('id')
          .eq('diary_id', diary.id)
          .eq('entry_date', h.businessOnDate)
          .eq('content', content)
          .maybeSingle();

        if (!existing) {
          await supabase.from('diary_timeline_entries').insert({
            diary_id: diary.id,
            entry_date: h.businessOnDate,
            entry_type: 'order',
            content,
            created_by: diary.lawyer_id,
          });
        }
      }

      synced++;
    } catch (err) {
      console.error(`Sync failed for diary ${diary.id}:`, err);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ synced, failed, total: cases.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});

async function runCreditOptimizedAutoSync() {
  const todayIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: candidates, error } = await supabase
    .rpc('get_auto_sync_candidate_cases', { p_today: todayIST });
  if (error) throw new Error(error.message);
  if (!candidates?.length) return { synced: 0, failed: 0, total: 0 };

  const eligible = candidates;

  let synced = 0;
  let failed = 0;
  const BATCH_SIZE = 100;
  for (let start = 0; start < eligible.length; start += BATCH_SIZE) {
    const batch = eligible.slice(start, start + BATCH_SIZE);
    const response = await fetch('https://webapi.ecourtsindia.com/api/partner/case/bulk-refresh', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ECOURTSINDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cnrNumbers: batch.map((item) => item.cnr_number) }),
    });
    if (!response.ok) {
      console.error('eCourts bulk-refresh failed:', response.status);
      failed += batch.length;
      continue;
    }

    const payload = await response.json();
    const results = payload?.data?.results ?? payload?.results ?? payload?.data ?? [];
    const byCnr = new Map((Array.isArray(results) ? results : []).map((item: any) => [
      String(item.cnrNumber ?? item.cnr_number ?? item?.courtCaseData?.cnrNumber ?? '').toUpperCase(),
      item.courtCaseData ?? item,
    ]));

    for (const diary of batch) {
      const courtCase = byCnr.get(String(diary.cnr_number).toUpperCase());
      if (!courtCase) { failed++; continue; }
      const nextDate = typeof courtCase.nextHearingDate === 'string' ? courtCase.nextHearingDate : null;
      const disposed = String(courtCase.caseStatus ?? '').toUpperCase() === 'DISPOSED';
      const update: Record<string, unknown> = {
        case_status: disposed ? 'DISPOSED' : 'ACTIVE',
        status: disposed ? 'disposed' : 'active',
        last_synced_at: new Date().toISOString(),
        cnr_last_synced_at: new Date().toISOString(),
      };
      // If the clerk has not published a new date, retain today's date so this
      // diary is selected again tomorrow. A newly published future date stops it.
      if (nextDate) {
        update.next_hearing_date = nextDate;
        update.matter_date = nextDate;
      }
      const { error: updateError } = await supabase.from('diaries').update(update).eq('id', diary.id);
      if (updateError) { failed++; continue; }

      if (nextDate && nextDate !== diary.next_hearing_date) {
        // This is the existing in-app case timeline notification. Email delivery
        // remains governed by the user's existing notification settings.
        await supabase.from('diary_timeline_entries').insert({
          diary_id: diary.id,
          entry_date: todayIST,
          entry_type: 'order',
          content: `Next hearing date updated to ${nextDate} by eCourts auto-sync.`,
          created_by: diary.lawyer_id,
        });
        await notifyDateChange(diary.lawyer_id, nextDate, diary.cnr_number);
      }
      synced++;
    }
  }
  return { synced, failed, total: eligible.length };
}

async function notifyDateChange(lawyerId: string, nextDate: string, cnrNumber: string) {
  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from('profiles').select('name, email').eq('id', lawyerId).maybeSingle(),
    supabase.from('notification_settings').select('email_enabled').eq('user_id', lawyerId).maybeSingle(),
  ]);
  if (!RESEND_API_KEY || !profile?.email || settings?.email_enabled === false) return;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: profile.email,
      subject: `Hearing date updated for ${cnrNumber}`,
      html: `<p>Hello ${escapeHtml(profile.name)},</p><p>eCourts has updated the next hearing date for CNR <strong>${escapeHtml(cnrNumber)}</strong> to <strong>${escapeHtml(nextDate)}</strong>.</p>`,
    }),
  });
  if (!response.ok) console.error('Date-change email failed:', response.status);
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[char] ?? char));
}

function formatPartyNames(petitioners: string[] = [], respondents: string[] = []): string {
  const p = petitioners.length ? petitioners.join(', ') : 'Unknown';
  const r = respondents.length ? respondents.join(', ') : 'Unknown';
  return `${p} vs ${r}`;
}
