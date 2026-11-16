import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, CalendarDays, Users, X, RefreshCw, Receipt, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Header } from '@/components/layout/Header';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { CASE_STATUSES, type CaseStatus, type Diary, type TimelineEntry } from '@/types';
import { CaseFeeLedger } from '@/components/case/CaseFeeLedger';
import { CaseTimeline } from '@/components/case/CaseTimeline';
import { CaseEditDialog } from '@/components/case/CaseEditDialog';
import { CaseDetailSkeleton } from '@/components/ui/skeleton-card';

type DiaryShare = { id: string; partner_id: string; can_edit: boolean };
type ConnectedPartner = { id: string; name: string };
type FeePayment = { id: string; amount: number; payment_type: string; payment_date: string; mode: string; note: string | null };

const STATUS_STYLES: Record<CaseStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  disposed: 'bg-muted text-muted-foreground border-border',
  appealed: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  adjourned: 'bg-sky-500/15 text-sky-400 border-sky-500/40',
};

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm text-right">{value?.trim() ? value : '—'}</span>
    </div>
  );
}

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const [diary, setDiary] = useState<Diary | null>(null);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [shares, setShares] = useState<DiaryShare[]>([]);
  const [connectedPartners, setConnectedPartners] = useState<ConnectedPartner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [canAddNotes, setCanAddNotes] = useState(false);
  const [cnrInput, setCnrInput] = useState('');
  const [isSavingCnr, setIsSavingCnr] = useState(false);
  const [isSyncingCnr, setIsSyncingCnr] = useState(false);
  const [isGeneratingPortal, setIsGeneratingPortal] = useState(false);
  const [feePayments, setFeePayments] = useState<FeePayment[]>([]);

  const lastKnownUpdatedAt = useRef<string | null>(null);

  // ── Data loading ──────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data: d }, { data: t }] = await Promise.all([
      supabase.from('diaries').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('diary_timeline_entries')
        .select('*')
        .eq('diary_id', id)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false }),
    ]);
    setDiary((d as Diary) ?? null);
    if (d) lastKnownUpdatedAt.current = (d as any).updated_at ?? null;
    setEntries((t as TimelineEntry[]) ?? []);
    setCnrInput((d as Diary)?.cnr_number || '');
    setIsLoading(false);
  }, [id]);

  const loadFees = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from('fee_payments').select('*').eq('diary_id', id).order('payment_date', { ascending: false });
    setFeePayments((data as FeePayment[]) ?? []);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadFees(); }, [loadFees]);

  const loadSharing = useCallback(async () => {
    if (!diary || diary.lawyer_id !== user?.id) return;
    const [{ data: shareData }, { data: relationshipData }] = await Promise.all([
      supabase.from('diary_shares').select('id, partner_id, can_edit').eq('diary_id', diary.id),
      supabase
        .from('partner_relationships')
        .select('partner_id')
        .eq('lawyer_id', user.id)
        .eq('status', 'accepted'),
    ]);
    const partnerIds = (relationshipData ?? []).map((r) => r.partner_id);
    const { data: partnerProfiles } = partnerIds.length
      ? await supabase.from('profiles').select('id, name').in('id', partnerIds)
      : { data: [] };
    setShares((shareData as DiaryShare[]) ?? []);
    setConnectedPartners((partnerProfiles as ConnectedPartner[]) ?? []);
  }, [diary, user?.id]);

  useEffect(() => { loadSharing(); }, [loadSharing]);

  useEffect(() => {
    if (!diary || !user) return;
    if (diary.lawyer_id === user.id) { setCanAddNotes(true); return; }
    supabase
      .rpc('can_edit_diary', { _diary_id: diary.id, _user_id: user.id })
      .then(({ data }) => setCanAddNotes(data === true));
  }, [diary, user]);

  // ── Actions ───────────────────────────────────────────────────

  const updateStatus = async (status: CaseStatus) => {
    if (!diary) return;
    let query = supabase.from('diaries').update({ status }).eq('id', diary.id);
    if (lastKnownUpdatedAt.current) query = query.eq('updated_at', lastKnownUpdatedAt.current);
    const { data, error } = await query.select().maybeSingle();
    if (error) { toast({ title: 'Could not update status', description: error.message, variant: 'destructive' }); return; }
    if (!data) { toast({ title: 'Conflict detected', description: 'Another user modified this case. Please refresh.', variant: 'destructive' }); return; }
    lastKnownUpdatedAt.current = (data as any).updated_at ?? null;
    setDiary({ ...diary, status });
  };

  const handleSaveCnr = async () => {
    if (!diary || !cnrInput.trim()) return;
    setIsSavingCnr(true);
    let query = supabase.from('diaries').update({ cnr_number: cnrInput.trim(), cnr_sync_enabled: true }).eq('id', diary.id);
    if (lastKnownUpdatedAt.current) query = query.eq('updated_at', lastKnownUpdatedAt.current);
    const { data, error } = await query.select().maybeSingle();
    setIsSavingCnr(false);
    if (error) { toast({ title: 'Could not save CNR', description: error.message, variant: 'destructive' }); return; }
    if (!data) { toast({ title: 'Conflict detected', description: 'Another user modified this case. Please refresh.', variant: 'destructive' }); return; }
    lastKnownUpdatedAt.current = (data as any).updated_at ?? null;
    setDiary(data as Diary);
    toast({ title: 'CNR saved', description: 'Click "Sync now" to pull the latest court data. Syncing is limited to once every 12 hours per case.' });
  };

  const handleToggleAutoSync = async () => {
    if (!diary) return;
    const { data, error } = await supabase.from('diaries').update({ cnr_sync_enabled: !diary.cnr_sync_enabled }).eq('id', diary.id).select().single();
    if (!error) setDiary(data as Diary);
  };

  const handleSyncNow = async () => {
    if (!diary) return;
    if (profile?.subscription_tier === 'free' && !profile?.firm_id) {
      toast({ title: 'Upgrade required', description: 'CNR sync is available on Pro and above.', variant: 'destructive' });
      return;
    }
    setIsSyncingCnr(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-case-from-cnr`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ diaryId: diary.id }),
      });
      const result = await res.json();
      if (!res.ok) { toast({ title: 'Sync failed', description: result.error, variant: 'destructive' }); return; }
      toast({ title: 'Synced from eCourts', description: `${result.timelineEntriesAdded} timeline entries added.` });
      const { data: refreshed } = await supabase.from('diaries').select('*').eq('id', diary.id).maybeSingle();
      if (refreshed) setDiary(refreshed as Diary);
    } catch (err) {
      toast({ title: 'Could not reach the sync service', description: String(err), variant: 'destructive' });
    } finally {
      setIsSyncingCnr(false);
    }
  };

  const handleSharePortal = async () => {
    if (!diary || !user) return;
    setIsGeneratingPortal(true);
    const { data: existing } = await supabase
      .from('client_portal_tokens').select('token').eq('diary_id', diary.id).eq('is_active', true).maybeSingle();
    let token = (existing as { token: string } | null)?.token;
    if (!token) {
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: created } = await supabase
        .from('client_portal_tokens').insert({ diary_id: diary.id, lawyer_id: user.id, expires_at: expiresAt }).select('token').single();
      token = (created as { token: string } | null)?.token;
    }
    setIsGeneratingPortal(false);
    if (!token) { toast({ title: 'Could not generate link', variant: 'destructive' }); return; }
    const url = `${window.location.origin}/portal/${token}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    toast({ title: 'Client portal link copied!', description: 'Share this link with your client. It expires in 90 days.' });
  };

  const handleRevokePortal = async () => {
    if (!diary) return;
    await supabase.from('client_portal_tokens').update({ is_active: false }).eq('diary_id', diary.id).eq('is_active', true);
    toast({ title: 'Portal link revoked', description: 'The client can no longer access the portal.' });
  };

  const shareCase = async (canEdit: boolean) => {
    if (!diary || !user || !selectedPartnerId) return;
    const existing = shares.find((s) => s.partner_id === selectedPartnerId);
    const { error } = existing
      ? await supabase.from('diary_shares').update({ can_edit: canEdit }).eq('id', existing.id)
      : await supabase.from('diary_shares').insert({ diary_id: diary.id, partner_id: selectedPartnerId, granted_by: user.id, can_edit: canEdit });
    if (error) { toast({ title: 'Could not share case', description: error.message, variant: 'destructive' }); return; }
    setSelectedPartnerId('');
    toast({ title: 'Case shared', description: canEdit ? 'Partner can view and add notes.' : 'Partner has view-only access.' });
    loadSharing();
  };

  const removeShare = async (share: DiaryShare) => {
    const { error } = await supabase.from('diary_shares').delete().eq('id', share.id);
    if (error) { toast({ title: 'Could not remove access', description: error.message, variant: 'destructive' }); return; }
    loadSharing();
  };

  // ── Render ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container max-w-2xl py-6">
          <CaseDetailSkeleton />
        </main>
      </div>
    );
  }

  if (!diary) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-24 text-center">
          <p className="text-muted-foreground">This case is not available to you.</p>
          <Button variant="link" onClick={() => navigate('/dashboard')}>Back to dashboard</Button>
        </div>
      </div>
    );
  }

  const isOwner = diary.lawyer_id === user?.id;

  return (
    <div className="min-h-screen bg-background legal-pattern pb-16">
      <Header />
      <main className="container max-w-2xl py-6">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          {isOwner && (
            <CaseEditDialog
              diary={diary}
              lastKnownUpdatedAt={lastKnownUpdatedAt.current}
              onSaved={(updated, newUpdatedAt) => {
                setDiary(updated);
                lastKnownUpdatedAt.current = newUpdatedAt;
              }}
            />
          )}
        </div>

        {/* Status banner */}
        <div className={cn('rounded-xl border px-4 py-3 mb-5 flex items-center justify-between gap-3', STATUS_STYLES[diary.status])}>
          <div>
            <p className="text-xs uppercase tracking-widest opacity-80">Status</p>
            <p className="font-serif text-xl font-bold capitalize">{diary.status}</p>
          </div>
          {isOwner && (
            <Select value={diary.status} onValueChange={(v) => updateStatus(v as CaseStatus)}>
              <SelectTrigger className="w-[150px] bg-background/40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CASE_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="mb-6">
          <h1 className="font-serif text-2xl font-bold">{diary.party_names}</h1>
          <p className="text-muted-foreground">{diary.case_type} {diary.case_number}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary">
            <CalendarDays className="h-4 w-4" />
            Next date {new Date(diary.matter_date).toLocaleDateString('en-IN')}
            {diary.hearing_time ? ` at ${diary.hearing_time.slice(0, 5)}` : ''}
          </p>
        </div>

        <Accordion type="multiple" defaultValue={['stage']} className="mb-8">
          <AccordionItem value="client" className="border-border/60">
            <AccordionTrigger className="font-serif">Client Data</AccordionTrigger>
            <AccordionContent>
              <Field label="Name" value={diary.client_name} />
              <Field label="Phone" value={diary.client_phone} />
              <Field label="Email" value={diary.client_email} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="stage" className="border-border/60">
            <AccordionTrigger className="font-serif">Case Stage Details</AccordionTrigger>
            <AccordionContent>
              <Field label="Stage" value={diary.stage_of_case} />
              <Field label="Purpose of hearing" value={diary.purpose_of_hearing} />
              <Field label="Notes" value={diary.notes} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="court" className="border-border/60">
            <AccordionTrigger className="font-serif">Court &amp; Judge Info</AccordionTrigger>
            <AccordionContent>
              <Field label="Court" value={diary.court_name} />
              <Field label="Court / board no." value={diary.court_number} />
              <Field label="Presiding judge" value={diary.judge_name} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="opposing" className="border-border/60">
            <AccordionTrigger className="font-serif">Opposing Counsel</AccordionTrigger>
            <AccordionContent>
              <Field label="Advocate" value={diary.opponent_advocate} />
            </AccordionContent>
          </AccordionItem>

          {isOwner && (
            <CaseFeeLedger
              diaryId={diary.id}
              lawyerId={user!.id}
              feePayments={feePayments}
              onRefresh={loadFees}
            />
          )}
        </Accordion>

        {/* CNR Sync */}
        {isOwner && (
          <Card className="glass-effect border-primary/20 mb-8">
            <CardHeader>
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" /> Court Sync (CNR)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">CNR Number</label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={cnrInput}
                    onChange={(e) => setCnrInput(e.target.value.toUpperCase())}
                    placeholder="e.g. MHTH010040472025"
                    className="flex-1 bg-secondary/50 font-mono"
                  />
                  <Button size="sm" variant="outline" onClick={handleSaveCnr} disabled={isSavingCnr}>
                    {isSavingCnr ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </div>
              {diary.cnr_number && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auto-sync upcoming hearings</span>
                    <Button
                      size="sm"
                      variant={diary.cnr_sync_enabled ? 'default' : 'outline'}
                      onClick={handleToggleAutoSync}
                      className={diary.cnr_sync_enabled ? 'gold-gradient text-primary-foreground' : ''}
                    >
                      {diary.cnr_sync_enabled ? 'On' : 'Off'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    When enabled, scheduled checks cover hearings due within 3 days. A case is never synced more than once every 12 hours.
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-muted-foreground">
                      {diary.cnr_last_synced_at
                        ? `Last synced ${new Date(diary.cnr_last_synced_at).toLocaleString('en-IN')}`
                        : 'Never synced yet'}
                    </span>
                    <Button size="sm" variant="outline" onClick={handleSyncNow} disabled={isSyncingCnr}>
                      {isSyncingCnr ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sync now'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick actions */}
        {isOwner && (
          <div className="flex gap-3 mb-8">
            <Button variant="outline" onClick={() => navigate(`/invoices/new?caseId=${diary.id}`)} className="flex-1">
              <Receipt className="mr-2 h-4 w-4" /> Create Invoice
            </Button>
            <Button variant="outline" onClick={handleSharePortal} disabled={isGeneratingPortal} className="flex-1">
              {isGeneratingPortal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
              Share with Client
            </Button>
            <Button variant="ghost" size="sm" onClick={handleRevokePortal} className="text-destructive hover:text-destructive">
              Revoke
            </Button>
          </div>
        )}

        {/* Partner sharing */}
        {isOwner && (
          <Card className="glass-effect border-primary/20 mb-8">
            <CardHeader>
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Share this case
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {connectedPartners.length === 0 ? (
                <p className="text-sm text-muted-foreground">Connect with a partner first, then return here to share this case.</p>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                    <SelectTrigger className="bg-secondary/50 flex-1"><SelectValue placeholder="Choose a connected partner" /></SelectTrigger>
                    <SelectContent>
                      {connectedPartners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" disabled={!selectedPartnerId} onClick={() => shareCase(false)}>View only</Button>
                  <Button size="sm" className="gold-gradient text-primary-foreground" disabled={!selectedPartnerId} onClick={() => shareCase(true)}>View + notes</Button>
                </div>
              )}
              {shares.length > 0 && (
                <ul className="space-y-2 pt-1">
                  {shares.map((share) => {
                    const partner = connectedPartners.find((p) => p.id === share.partner_id);
                    return (
                      <li key={share.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
                        <span>{partner?.name ?? 'Connected partner'} <span className="text-muted-foreground">· {share.can_edit ? 'Can add notes' : 'View only'}</span></span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => removeShare(share)} aria-label="Remove access"><X className="h-3.5 w-3.5" /></Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        <CaseTimeline
          diaryId={diary.id}
          userId={user!.id}
          entries={entries}
          canAddNotes={canAddNotes}
          onRefresh={load}
        />
      </main>
    </div>
  );
}
