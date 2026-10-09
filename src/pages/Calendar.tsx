import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { Diary } from '@/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-500',
  adjourned: 'bg-sky-500',
  appealed: 'bg-amber-500',
  disposed: 'bg-muted-foreground',
};

function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function Calendar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cases, setCases] = useState<Diary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ref, setRef] = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(null);

  const year = ref.getFullYear();
  const month = ref.getMonth();

  useEffect(() => {
    if (!user) return;
    supabase
      .from('diaries')
      .select('id, party_names, case_type, case_number, matter_date, status, lawyer_id')
      .order('matter_date', { ascending: true })
      .then(({ data }) => {
        setCases((data as Diary[]) ?? []);
        setIsLoading(false);
      });
  }, [user]);

  // Build calendar grid
  const { cells, todayISO } = useMemo(() => {
    const todayISO = toISO(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ iso: string; day: number } | null> = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push({ iso: toISO(year, month, d), day: d });
    return { cells, todayISO };
  }, [year, month]);

  const byDate = useMemo(() => {
    const map: Record<string, Diary[]> = {};
    for (const c of cases) {
      if (!map[c.matter_date]) map[c.matter_date] = [];
      map[c.matter_date].push(c);
    }
    return map;
  }, [cases]);

  const selectedCases = selected ? (byDate[selected] ?? []) : [];

  const changeMonth = (delta: number) =>
    setRef((r) => new Date(r.getFullYear(), r.getMonth() + delta, 1));

  return (
    <div className="min-h-screen bg-background legal-pattern pb-16">
      <Header />
      <main className="container max-w-3xl py-6 space-y-4">
        {/* Month nav */}
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-2xl font-bold">
            {ref.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </h1>
          <div className="flex gap-1">
            <button
              onClick={() => changeMonth(-1)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => changeMonth(1)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-[11px] uppercase tracking-wide text-muted-foreground py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell, i) => {
                if (!cell) return <div key={`empty-${i}`} />;
                const hearings = byDate[cell.iso] ?? [];
                const isToday = cell.iso === todayISO;
                const isSelected = cell.iso === selected;
                return (
                  <button
                    key={cell.iso}
                    onClick={() => setSelected(isSelected ? null : cell.iso)}
                    className={cn(
                      'relative flex flex-col items-center rounded-xl border py-2 min-h-[56px] transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/15'
                        : 'border-border/60 bg-card/60 hover:border-primary/40',
                    )}
                  >
                    <span
                      className={cn(
                        'font-serif text-sm leading-tight',
                        isToday && 'text-primary font-bold',
                      )}
                    >
                      {cell.day}
                    </span>
                    {hearings.length > 0 && (
                      <div className="mt-1 flex flex-wrap justify-center gap-0.5 px-1">
                        {hearings.slice(0, 3).map((h) => (
                          <span
                            key={h.id}
                            className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[h.status] ?? 'bg-primary')}
                          />
                        ))}
                        {hearings.length > 3 && (
                          <span className="text-[9px] text-muted-foreground">+{hearings.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected day hearings */}
            {selected && (
              <div className="space-y-2 pt-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {new Date(`${selected}T00:00:00`).toLocaleDateString('en-IN', {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })}
                  {' '}— {selectedCases.length} hearing{selectedCases.length !== 1 ? 's' : ''}
                </p>
                {selectedCases.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hearings on this date.</p>
                ) : (
                  <ul className="space-y-2">
                    {selectedCases.map((c) => (
                      <li key={c.id}>
                        <button
                          onClick={() => navigate(`/cases/${c.id}`)}
                          className="w-full text-left rounded-xl border border-border/60 bg-card/60 px-4 py-3 hover:border-primary/40 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{c.party_names}</p>
                              <p className="text-xs text-muted-foreground">
                                {c.case_type} {c.case_number}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn('capitalize shrink-0 text-xs', {
                                'border-emerald-500/40 text-emerald-500': c.status === 'active',
                                'border-sky-500/40 text-sky-500': c.status === 'adjourned',
                                'border-amber-500/40 text-amber-500': c.status === 'appealed',
                              })}
                            >
                              {c.status}
                            </Badge>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
