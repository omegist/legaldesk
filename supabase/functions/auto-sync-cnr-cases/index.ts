import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const ECOURTSINDIA_API_KEY = Deno.env.get('ECOURTSINDIA_API_KEY')!;

const SYNC_WINDOW_DAYS = 3;
const COOLDOWN_HOURS = 20;

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
    const isOwnerPaid = lp.subscription_tier !== 'free';
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

function formatPartyNames(petitioners: string[] = [], respondents: string[] = []): string {
  const p = petitioners.length ? petitioners.join(', ') : 'Unknown';
  const r = respondents.length ? respondents.join(', ') : 'Unknown';
  return `${p} vs ${r}`;
}
