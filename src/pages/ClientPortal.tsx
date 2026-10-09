import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Scale, CalendarDays, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type CaseStatus = 'active' | 'disposed' | 'appealed' | 'adjourned';

const STATUS_STYLES: Record<CaseStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  disposed: 'bg-muted text-muted-foreground border-border',
  appealed: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  adjourned: 'bg-sky-500/15 text-sky-400 border-sky-500/40',
};

interface PortalData {
  party_names: string;
  case_type: string;
  case_number: string;
  court_name: string;
  status: CaseStatus;
  matter_date: string;
  hearing_time: string | null;
  stage_of_case: string | null;
  purpose_of_hearing: string | null;
  lawyer_name: string;
  lawyer_phone: string | null;
  timeline: { id: string; entry_date: string; content: string }[];
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}

export default function ClientPortal() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!token) { setInvalid(true); setIsLoading(false); return; }

    (async () => {
      // Look up the token
      const { data: tokenRow } = await supabase
        .from('client_portal_tokens')
        .select('diary_id, lawyer_id')
        .eq('token', token)
        .eq('is_active', true)
        .maybeSingle();

      if (!tokenRow) { setInvalid(true); setIsLoading(false); return; }

      const [{ data: diary }, { data: profile }, { data: timeline }] = await Promise.all([
        supabase.from('diaries').select('party_names, case_type, case_number, court_name, status, matter_date, hearing_time, stage_of_case, purpose_of_hearing').eq('id', tokenRow.diary_id).maybeSingle(),
        supabase.from('profiles').select('name, phone').eq('id', tokenRow.lawyer_id).maybeSingle(),
        supabase.from('diary_timeline_entries').select('id, entry_date, content').eq('diary_id', tokenRow.diary_id).order('entry_date', { ascending: false }).limit(20),
      ]);

      if (!diary) { setInvalid(true); setIsLoading(false); return; }

      setData({
        ...(diary as Omit<PortalData, 'lawyer_name' | 'lawyer_phone' | 'timeline'>),
        lawyer_name: (profile as { name: string; phone: string | null } | null)?.name ?? 'Your Advocate',
        lawyer_phone: (profile as { name: string; phone: string | null } | null)?.phone ?? null,
        timeline: (timeline as { id: string; entry_date: string; content: string }[]) ?? [],
      });
      setIsLoading(false);
    })();
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (invalid || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <h1 className="font-serif text-xl font-bold">Link not found or expired</h1>
        <p className="text-sm text-muted-foreground">Please ask your advocate to share a new link.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background legal-pattern pb-16">
      {/* Minimal header — no nav, just branding */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center gap-2">
          <Scale className="h-6 w-6 text-primary" />
          <span className="font-serif text-lg font-semibold">VakilDesk</span>
          <span className="ml-auto text-xs text-muted-foreground">Client Case Portal</span>
        </div>
      </header>

      <main className="container max-w-xl py-6 space-y-5">
        {/* Status banner */}
        <div className={cn('rounded-xl border px-4 py-3 flex items-center justify-between gap-3', STATUS_STYLES[data.status])}>
          <div>
            <p className="text-xs uppercase tracking-widest opacity-70">Case Status</p>
            <p className="font-serif text-xl font-bold capitalize">{data.status}</p>
          </div>
          <Badge variant="outline" className={cn('capitalize', STATUS_STYLES[data.status])}>
            {data.status}
          </Badge>
        </div>

        {/* Case summary */}
        <Card className="glass-effect border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-lg">{data.party_names}</CardTitle>
            <p className="text-sm text-muted-foreground">{data.case_type} · {data.case_number}</p>
          </CardHeader>
          <CardContent className="space-y-0">
            <Field label="Court" value={data.court_name} />
            <Field label="Stage" value={data.stage_of_case} />
            <Field label="Purpose of next hearing" value={data.purpose_of_hearing} />
          </CardContent>
        </Card>

        {/* Next date */}
        <Card className="glass-effect border-primary/20">
          <CardContent className="pt-4 flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Next Hearing Date</p>
              <p className="font-semibold">
                {new Date(data.matter_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                {data.hearing_time ? ` at ${data.hearing_time.slice(0, 5)}` : ''}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        {data.timeline.length > 0 && (
          <Card className="glass-effect border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-base">Order Sheet</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative border-l border-border/60 pl-5 space-y-4">
                {data.timeline.map((entry) => (
                  <li key={entry.id} className="relative">
                    <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                    <p className="text-xs text-primary mb-0.5">
                      {new Date(entry.entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{entry.content}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        {/* Advocate contact */}
        <Card className="glass-effect border-primary/20">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Your Advocate</p>
            <p className="font-semibold">{data.lawyer_name}</p>
            {data.lawyer_phone && (
              <a href={`tel:${data.lawyer_phone}`} className="text-sm text-primary mt-0.5 block">
                {data.lawyer_phone}
              </a>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground pt-2">
          This is a read-only view shared by your advocate via VakilDesk.
        </p>
      </main>
    </div>
  );
}
