import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, CalendarDays, Trash2, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Header } from '@/components/layout/Header';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { CASE_STATUSES, type CaseStatus, type Diary, type TimelineEntry } from '@/types';

type DiaryShare = { id: string; partner_id: string; can_edit: boolean };
type ConnectedPartner = { id: string; name: string };

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
  const { user } = useAuth();

  const [diary, setDiary] = useState<Diary | null>(null);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [newEntry, setNewEntry] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [shares, setShares] = useState<DiaryShare[]>([]);
  const [connectedPartners, setConnectedPartners] = useState<ConnectedPartner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [canAddNotes, setCanAddNotes] = useState(false);

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
    setEntries((t as TimelineEntry[]) ?? []);
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

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
    const partnerIds = (relationshipData ?? []).map((relationship) => relationship.partner_id);
    const { data: partnerProfiles } = partnerIds.length
      ? await supabase.from('profiles').select('id, name').in('id', partnerIds)
      : { data: [] };
    setShares((shareData as DiaryShare[]) ?? []);
    setConnectedPartners((partnerProfiles as ConnectedPartner[]) ?? []);
  }, [diary, user?.id]);

  useEffect(() => {
    loadSharing();
  }, [loadSharing]);

  useEffect(() => {
    if (!diary || !user) return;
    if (diary.lawyer_id === user.id) {
      setCanAddNotes(true);
      return;
    }
    supabase
      .rpc('can_edit_diary', { _diary_id: diary.id, _user_id: user.id })
      .then(({ data }) => setCanAddNotes(data === true));
  }, [diary, user]);

  const updateStatus = async (status: CaseStatus) => {
    if (!diary) return;
    const { error } = await supabase.from('diaries').update({ status }).eq('id', diary.id);
    if (error) {
      toast({ title: 'Could not update status', description: error.message, variant: 'destructive' });
      return;
    }
    setDiary({ ...diary, status });
  };

  const addEntry = async () => {
    if (!diary || !user || !newEntry.trim()) return;
    setIsSaving(true);
    const { error } = await supabase.from('diary_timeline_entries').insert({
      diary_id: diary.id,
      content: newEntry.trim(),
      created_by: user.id,
    });
    setIsSaving(false);
    if (error) {
      toast({ title: 'Could not add note', description: error.message, variant: 'destructive' });
      return;
    }
    setNewEntry('');
    load();
  };

  const deleteEntry = async (entryId: string) => {
    await supabase.from('diary_timeline_entries').delete().eq('id', entryId);
    load();
  };

  const shareCase = async (canEdit: boolean) => {
    if (!diary || !user || !selectedPartnerId) return;
    const existing = shares.find((share) => share.partner_id === selectedPartnerId);
    const { error } = existing
      ? await supabase.from('diary_shares').update({ can_edit: canEdit }).eq('id', existing.id)
      : await supabase.from('diary_shares').insert({
          diary_id: diary.id,
          partner_id: selectedPartnerId,
          granted_by: user.id,
          can_edit: canEdit,
        });
    if (error) {
      toast({ title: 'Could not share case', description: error.message, variant: 'destructive' });
      return;
    }
    setSelectedPartnerId('');
    toast({ title: 'Case shared', description: canEdit ? 'Partner can view and add notes.' : 'Partner has view-only access.' });
    loadSharing();
  };

  const removeShare = async (share: DiaryShare) => {
    const { error } = await supabase.from('diary_shares').delete().eq('id', share.id);
    if (error) {
      toast({ title: 'Could not remove access', description: error.message, variant: 'destructive' });
      return;
    }
    loadSharing();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!diary) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-24 text-center">
          <p className="text-muted-foreground">This case is not available to you.</p>
          <Button variant="link" onClick={() => navigate('/dashboard')}>
            Back to dashboard
          </Button>
        </div>
      </div>
    );
  }

  const isOwner = diary.lawyer_id === user?.id;

  return (
    <div className="min-h-screen bg-background legal-pattern pb-16">
      <Header />
      <main className="container max-w-2xl py-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 -ml-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>

        {/* Status banner */}
        <div
          className={cn(
            'rounded-xl border px-4 py-3 mb-5 flex items-center justify-between gap-3',
            STATUS_STYLES[diary.status],
          )}
        >
          <div>
            <p className="text-xs uppercase tracking-widest opacity-80">Status</p>
            <p className="font-serif text-xl font-bold capitalize">{diary.status}</p>
          </div>
          {isOwner && (
            <Select value={diary.status} onValueChange={(v) => updateStatus(v as CaseStatus)}>
              <SelectTrigger className="w-[150px] bg-background/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CASE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="mb-6">
          <h1 className="font-serif text-2xl font-bold">{diary.party_names}</h1>
          <p className="text-muted-foreground">
            {diary.case_type} {diary.case_number}
          </p>
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
        </Accordion>

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
                      {connectedPartners.map((partner) => <SelectItem key={partner.id} value={partner.id}>{partner.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" disabled={!selectedPartnerId} onClick={() => shareCase(false)}>View only</Button>
                  <Button size="sm" className="gold-gradient text-primary-foreground" disabled={!selectedPartnerId} onClick={() => shareCase(true)}>View + notes</Button>
                </div>
              )}
              {shares.length > 0 && (
                <ul className="space-y-2 pt-1">
                  {shares.map((share) => {
                    const partner = connectedPartners.find((item) => item.id === share.partner_id);
                    return <li key={share.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
                      <span>{partner?.name ?? 'Connected partner'} <span className="text-muted-foreground">· {share.can_edit ? 'Can add notes' : 'View only'}</span></span>
                      <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => removeShare(share)} aria-label="Remove access"><X className="h-3.5 w-3.5" /></Button>
                    </li>;
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        <Card className="glass-effect border-primary/20">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Order Sheet &amp; Hearing Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-6">
              <Textarea
                rows={3}
                placeholder={canAddNotes ? 'What happened in court today?' : 'You have view-only access to this case.'}
                value={newEntry}
                onChange={(e) => setNewEntry(e.target.value)}
                disabled={!canAddNotes}
                className="bg-secondary/50"
              />
              <Button
                onClick={addEntry}
                disabled={!canAddNotes || isSaving || !newEntry.trim()}
                className="gold-gradient text-primary-foreground"
                size="sm"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="mr-1 h-4 w-4" /> Add entry
                  </>
                )}
              </Button>
            </div>

            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No entries recorded yet.
              </p>
            ) : (
              <ol className="relative border-l border-border/60 pl-5 space-y-5">
                {entries.map((entry) => (
                  <li key={entry.id} className="relative">
                    <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-primary">
                          {new Date(entry.entry_date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">{entry.content}</p>
                      </div>
                      {entry.created_by === user?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteEntry(entry.id)}
                          aria-label="Delete entry"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
