import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, Gavel, MapPin, Clock, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { Diary } from '@/types';

const STATUS_STYLES: Record<string, string> = {
  active: 'border-emerald-500/40 text-emerald-500',
  disposed: 'border-muted-foreground/40 text-muted-foreground',
  appealed: 'border-amber-500/40 text-amber-500',
  adjourned: 'border-sky-500/40 text-sky-500',
};

// This is the page that was missing: Dashboard only ever shows the current
// calendar week's hearings, so a case scheduled outside that window had
// nowhere to be found again after creation. This page lists every case,
// regardless of date, with search and a status filter.
export default function Cases() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [cases, setCases] = useState<Diary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('diaries')
      .select('*')
      .order('matter_date', { ascending: false })
      .then(({ data }) => {
        setCases((data as Diary[]) ?? []);
        setIsLoading(false);
      });
  }, [user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases.filter((c) => {
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesQuery =
        !q ||
        c.party_names?.toLowerCase().includes(q) ||
        c.case_number?.toLowerCase().includes(q) ||
        c.court_name?.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [cases, query, statusFilter]);

  return (
    <div className="min-h-screen bg-background legal-pattern pb-24">
      <Header />
      <main className="container py-6 max-w-3xl">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold">
              {profile?.role === 'partner' ? 'Shared Cases' : 'My Cases'}
            </h1>
            {profile?.role === 'partner' && (
              <p className="text-sm text-muted-foreground mt-1">Cases shared with you by a connected lawyer.</p>
            )}
          </div>
          {profile?.role !== 'partner' && (
            <Button
              size="sm"
              onClick={() => navigate('/cases/new')}
              className="gold-gradient text-primary-foreground shrink-0"
            >
              <Plus className="mr-1 h-4 w-4" /> New case
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by party, case number, or court"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 bg-secondary/50"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-44 bg-secondary/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disposed">Disposed</SelectItem>
              <SelectItem value="appealed">Appealed</SelectItem>
              <SelectItem value="adjourned">Adjourned</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Gavel className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              {cases.length === 0
                ? profile?.role === 'partner'
                  ? 'No cases have been shared with you yet.'
                  : 'No cases yet — create your first one.'
                : 'No cases match your search.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => navigate(`/cases/${c.id}`)}
                  className="w-full text-left rounded-xl border border-border/60 bg-card/60 p-4 hover:border-primary/40 transition-colors"
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
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {c.status && (
                        <Badge variant="outline" className={cn('capitalize', STATUS_STYLES[c.status])}>
                          {c.status}
                        </Badge>
                      )}
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(c.matter_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
