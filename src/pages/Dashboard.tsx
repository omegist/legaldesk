import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Briefcase, Gavel, ClipboardList, Loader2, Clock, MapPin, UserPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { Diary } from '@/types';

const toISODate = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

function weekDays(reference: Date) {
  const start = new Date(reference);
  start.setDate(reference.getDate() - reference.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [cases, setCases] = useState<Diary[]>([]);
  const [pendingInvites, setPendingInvites] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [today, setToday] = useState(() => new Date());
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));

  const todayISO = toISODate(today);
  const days = useMemo(() => weekDays(addDays(today, weekOffset * 7)), [today, weekOffset]);

  const changeWeek = (amount: number) => {
    setWeekOffset((offset) => offset + amount);
    setSelectedDate((date) => toISODate(addDays(new Date(`${date}T00:00:00`), amount * 7)));
  };

  // Refresh at midnight so an open dashboard automatically moves to the new week.
  useEffect(() => {
    const refreshDate = () => setToday(new Date());
    const millisecondsUntilMidnight = (() => {
      const nextMidnight = new Date();
      nextMidnight.setHours(24, 0, 1, 0);
      return nextMidnight.getTime() - Date.now();
    })();
    const timeout = window.setTimeout(refreshDate, millisecondsUntilMidnight);
    return () => window.clearTimeout(timeout);
  }, [today]);

  useEffect(() => {
    if (weekOffset === 0) setSelectedDate(todayISO);
  }, [todayISO, weekOffset]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: diaries }, { count }] = await Promise.all([
        supabase.from('diaries').select('*').order('matter_date', { ascending: true }),
        supabase
          .from('partner_relationships')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          // Only requests waiting on THIS user to respond — not ones they sent
          // themselves and are still waiting on someone else for.
          .neq('requested_by', user.id),
      ]);
      setCases((diaries as Diary[]) ?? []);
      setPendingInvites(count ?? 0);
      setIsLoading(false);
    };
    load();
  }, [user]);

  const activeCases = cases.filter((c) => c.status === 'active');
  const hearingsToday = cases.filter((c) => c.matter_date === todayISO);
  const hearingsSelected = cases.filter((c) => c.matter_date === selectedDate);
  // "Tasks pending" = matters adjourned without a fresh date, plus partner invitations awaiting a reply.
  const tasksPending = cases.filter((c) => c.status === 'adjourned').length + pendingInvites;

  return (
    <div className="min-h-screen bg-background legal-pattern pb-28">
      <Header />

      <main className="container py-6">
        <div className="mb-6">
          <h1 className="font-serif text-2xl md:text-3xl font-bold">
            {profile?.role === 'partner' ? 'Partner workspace' : 'Good day'}
            {profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        {pendingInvites > 0 && (
          <button
            onClick={() => navigate('/partners')}
            className="mb-6 flex w-full items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4 text-left transition-colors hover:bg-primary/15"
          >
            <UserPlus className="h-5 w-5 shrink-0 text-primary" />
            <span className="text-sm">
              <span className="font-medium">
                {pendingInvites} partner request{pendingInvites > 1 ? 's' : ''} waiting
              </span>
              <span className="text-muted-foreground"> — tap to review</span>
            </span>
          </button>
        )}

        {/* Week strip */}
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => changeWeek(-1)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="text-sm font-medium text-muted-foreground">
            {days[0].toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
            {days[0].getMonth() !== days[6].getMonth()
              ? ` – ${days[6].toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`
              : ''}
          </p>
          <button
            type="button"
            onClick={() => changeWeek(1)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Next week"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="mb-6 grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const iso = toISODate(d);
            const isToday = iso === todayISO;
            const isSelected = iso === selectedDate;
            const hasHearing = cases.some((c) => c.matter_date === iso);
            return (
              <button
                key={iso}
                onClick={() => setSelectedDate(iso)}
                className={cn(
                  'flex flex-col items-center rounded-xl border py-2.5 transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/15'
                    : 'border-border/60 bg-card/60 hover:border-primary/40',
                )}
              >
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {d.toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 2)}
                </span>
                <span
                  className={cn(
                    'font-serif text-lg leading-tight',
                    isToday && 'text-primary font-bold',
                  )}
                >
                  {d.getDate()}
                </span>
                <span
                  className={cn(
                    'mt-1 h-1.5 w-1.5 rounded-full',
                    hasHearing ? 'bg-primary' : 'bg-transparent',
                  )}
                />
              </button>
            );
          })}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: profile?.role === 'partner' ? 'Shared Cases' : 'Active Cases', value: activeCases.length, icon: Briefcase },
            { label: 'Hearings Today', value: hearingsToday.length, icon: Gavel },
            { label: 'Tasks Pending', value: tasksPending, icon: ClipboardList },
          ].map((m) => (
            <Card key={m.label} className="glass-effect border-primary/20">
              <CardHeader className="pb-1 px-3 pt-3">
                <m.icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="font-serif text-2xl font-bold">{m.value}</div>
                <p className="text-[11px] leading-tight text-muted-foreground">{m.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Hearings feed */}
        <Card className="glass-effect border-primary/20">
          <CardHeader>
            <CardTitle className="font-serif text-xl">
              {selectedDate === todayISO
                ? "Today's Board"
                : new Date(selectedDate).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : hearingsSelected.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Gavel className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No hearings listed for this date.</p>
              </div>
            ) : (
              <ol className="space-y-3">
                {hearingsSelected
                  .slice()
                  .sort((a, b) => (a.hearing_time ?? '').localeCompare(b.hearing_time ?? ''))
                  .map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => navigate(`/cases/${c.id}`)}
                        className="w-full text-left rounded-xl border border-border/60 bg-secondary/30 p-4 hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{c.party_names}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {c.case_type} {c.case_number}
                            </p>
                            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {c.court_name}
                              {c.court_number ? ` · Court ${c.court_number}` : ''}
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0 gap-1 border-primary/40 text-primary">
                            <Clock className="h-3 w-3" />
                            {c.hearing_time ? c.hearing_time.slice(0, 5) : '—'}
                          </Badge>
                        </div>
                      </button>
                    </li>
                  ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </main>

      <Button
        onClick={() => navigate('/cases/new')}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg gold-gradient text-primary-foreground"
        aria-label="Create new case"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}
