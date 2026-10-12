import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ECOURTSINDIA_API_KEY = Deno.env.get('ECOURTSINDIA_API_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface HearingHistoryEntry {
  judge: string;
  businessOnDate: string;
  hearingDate: string;
  purposeOfListing: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const { data: userData, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (userError || !userData.user) return json({ error: 'Not authenticated' }, 401);

    const { diaryId } = await req.json();
    if (!diaryId) return json({ error: 'diaryId is required' }, 400);

    const { data: diary, error: diaryError } = await supabase
      .from('diaries')
      .select('id, cnr_number, lawyer_id, cnr_last_synced_at')
      .eq('id', diaryId)
      .single();

    if (diaryError || !diary) return json({ error: 'Case not found' }, 404);
    if (diary.lawyer_id !== userData.user.id) {
      // Also allow firm members to sync firm cases
      const { data: profile } = await supabase
        .from('profiles')
        .select('firm_id')
        .eq('id', userData.user.id)
        .single();
      const isFirmMember = profile?.firm_id && diary.firm_id === profile.firm_id;
      if (!isFirmMember) return json({ error: 'You do not have access to this case' }, 403);
    }
    if (!diary.cnr_number) return json({ error: 'This case has no CNR number set' }, 400);

    // ── Server-side tier check — prevents direct API calls from free users ──
    // This MUST be enforced here, not only in the React UI.
    const { data: me } = await supabase
      .from('profiles')
      .select('subscription_tier, firm_id')
      .eq('id', userData.user.id)
      .single();

    let paid = me?.subscription_tier !== 'free';
    if (!paid && me?.firm_id && me.firm_id !== userData.user.id) {
      // Firm member — check if the firm owner is on a paid plan
      const { data: owner } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', me.firm_id)
        .single();
      paid = owner?.subscription_tier === 'chambers' || owner?.subscription_tier === 'firm';
    }
    if (!paid) return json({ error: 'upgrade_required' }, 402);


    // 30 minutes so a double-click or impatient retry can't quietly burn
    // through paid API credits.
    const COOLDOWN_MINUTES = 30;
    if (diary.cnr_last_synced_at) {
      const minutesSinceSync = (Date.now() - new Date(diary.cnr_last_synced_at).getTime()) / 60000;
      if (minutesSinceSync < COOLDOWN_MINUTES) {
        const minutesLeft = Math.ceil(COOLDOWN_MINUTES - minutesSinceSync);
        return json(
          { error: `Please wait ${minutesLeft} more minute${minutesLeft === 1 ? '' : 's'} before syncing this case again.` },
          429,
        );
      }
    }

    const res = await fetch(`https://webapi.ecourtsindia.com/api/partner/case/${diary.cnr_number}`, {
      headers: { Authorization: `Bearer ${ECOURTSINDIA_API_KEY}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('eCourtsIndia error:', errText);
      return json({ error: 'Could not fetch case from eCourts' }, 502);
    }

    const payload = await res.json();
    const c = payload.data.courtCaseData;

    const isDisposed = c.caseStatus === 'DISPOSED';

    const updateFields: Record<string, unknown> = {
      purpose_of_hearing: c.stageOfCaseRaw || c.purpose || null,
      judge_name: c.judges?.[0] ?? null,
      court_name: c.courtName,
      court_number: c.courtNo != null ? String(c.courtNo) : null,
      party_names: formatPartyNames(c.petitioners, c.respondents),
      opponent_advocate: c.respondentAdvocates?.[0] ?? null,
      cnr_last_synced_at: new Date().toISOString(),
    };

    // Only update matter_date when court provides a non-null next hearing date
    if (c.nextHearingDate) updateFields.matter_date = c.nextHearingDate;

    // Set status=disposed when court says so (stops reminders)
    if (isDisposed) updateFields.status = 'disposed';

    // Never overwrite stage_of_case with 'active'/'disposed' — it's a free-text field

    const { error: updateError } = await supabase
      .from('diaries')
      .update(updateFields)
      .eq('id', diaryId);

    if (updateError) {
      console.error('Update error:', updateError);
      return json({ error: 'Could not update case' }, 500);
    }

    // Backfill timeline entries for hearing history we don't already have,
    // keyed on (businessOnDate + purposeOfListing) so re-running this never
    // creates duplicates.
    const history: HearingHistoryEntry[] = c.historyOfCaseHearings || [];
    let entriesAdded = 0;

    for (const h of history) {
      const content = `${h.purposeOfListing} — before ${h.judge}`;
      const { data: existing } = await supabase
        .from('diary_timeline_entries')
        .select('id')
        .eq('diary_id', diaryId)
        .eq('entry_date', h.businessOnDate)
        .eq('content', content)
        .maybeSingle();

      if (!existing) {
        await supabase.from('diary_timeline_entries').insert({
          diary_id: diaryId,
          entry_date: h.businessOnDate,
          entry_type: 'order',
          content,
          created_by: diary.lawyer_id,
        });
        entriesAdded++;
      }
    }

    return json({ ok: true, nextHearingDate: c.nextHearingDate ?? null, disposed: isDisposed, timelineEntriesAdded: entriesAdded });
  } catch (err) {
    console.error('sync-case-from-cnr error:', err);
    return json({ error: String(err) }, 500);
  }
});

function formatPartyNames(petitioners: string[] = [], respondents: string[] = []): string {
  const p = petitioners.length ? petitioners.join(', ') : 'Unknown';
  const r = respondents.length ? respondents.join(', ') : 'Unknown';
  return `${p} vs ${r}`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}