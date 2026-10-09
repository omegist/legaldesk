import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const ECOURTSINDIA_API_KEY = Deno.env.get('ECOURTSINDIA_API_KEY')!;

// Only sync cases whose next hearing is within this many days
const SYNC_WINDOW_DAYS = 3;
// Don't re-sync a case that was synced within this many hours
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

  // IST = UTC + 5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(Date.now() + istOffset);

  const todayISO = nowIST.toISOString().slice(0, 10);
  const windowEnd = new Date(nowIST);
  windowEnd.setDate(windowEnd.getDate() + SYNC_WINDOW_DAYS);
  const windowEndISO = windowEnd.toISOString().slice(0, 10);

  const cooldownCutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();

  // Fetch only cases that:
  // 1. Have a CNR number
  // 2. Have auto-sync enabled (Pro/Chambers/Firm users only)
  // 3. Have next hearing within 3 days
  // 4. Haven't been synced in the last 20 hours
  // 5. Are still active
  // 6. Lawyer is on a paid plan
  const { data: cases, error } = await supabase
    .from('diaries')
    .select('id, cnr_number, lawyer_id, matter_date, cnr_last_synced_at, profiles!inner(subscription_tier)')
    .not('cnr_number', 'is', null)
    .eq('cnr_sync_enabled', true)
    .eq('status', 'active')
    .gte('matter_date', todayISO)
    .lte('matter_date', windowEndISO)
    .or(`cnr_last_synced_at.is.null,cnr_last_synced_at.lt.${cooldownCutoff}`)
    .neq('profiles.subscription_tier', 'free');

  if (error) {
    console.error('Failed to fetch cases:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!cases || cases.length === 0) {
    return new Response(JSON.stringify({ synced: 0, skipped: 0, message: 'No cases need syncing' }), { status: 200 });
  }

  let synced = 0;
  let failed = 0;

  for (const diary of cases) {
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

      // Update case with latest eCourts data
      await supabase
        .from('diaries')
        .update({
          matter_date: c.nextHearingDate,
          purpose_of_hearing: c.stageOfCaseRaw || c.purpose,
          stage_of_case: c.caseStatus === 'DISPOSED' ? 'disposed' : 'active',
          judge_name: c.judges?.[0] ?? null,
          court_name: c.courtName,
          court_number: c.courtNo != null ? String(c.courtNo) : null,
          party_names: formatPartyNames(c.petitioners, c.respondents),
          opponent_advocate: c.respondentAdvocates?.[0] ?? null,
          cnr_last_synced_at: new Date().toISOString(),
        })
        .eq('id', diary.id);

      // Backfill timeline entries without duplicates
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
