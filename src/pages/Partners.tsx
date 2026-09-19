import { useCallback, useEffect, useState } from 'react';
import { Search, Loader2, UserPlus, Check, X, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Header } from '@/components/layout/Header';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface DirectoryResult {
  id: string;
  name: string;
  role: string;
  practice_area: string | null;
  court_name: string | null;
  city: string | null;
  experience_years: number | null;
  description: string | null;
  profile_photo_url: string | null;
}

interface Relationship {
  id: string;
  lawyer_id: string;
  partner_id: string;
  requested_by: string;
  status: 'pending' | 'accepted' | 'rejected' | 'removed';
  message: string | null;
  // joined display fields, resolved client-side after fetching profiles
  otherName?: string;
  otherRole?: string;
}

export default function Partners() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'lawyer' | 'partner'>('all');
  const [results, setResults] = useState<DirectoryResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    if (!user) return;
    const { data: rels } = await supabase
      .from('partner_relationships')
      .select('*')
      .or(`lawyer_id.eq.${user.id},partner_id.eq.${user.id}`)
      .neq('status', 'removed');

    if (!rels || rels.length === 0) {
      setRelationships([]);
      setIsLoadingConnections(false);
      return;
    }

    const otherIds = rels.map((r) => (r.lawyer_id === user.id ? r.partner_id : r.lawyer_id));
    const { data: profiles } = await supabase.from('profiles').select('id, name, role').in('id', otherIds);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

    setRelationships(
      rels.map((r) => {
        const otherId = r.lawyer_id === user.id ? r.partner_id : r.lawyer_id;
        const other = byId.get(otherId);
        return { ...r, otherName: other?.name ?? 'Unknown', otherRole: other?.role };
      }),
    );
    setIsLoadingConnections(false);
  }, [user]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setIsSearching(true);
      // search_directory is a security-definer RPC â€” it deliberately excludes
      // email/phone/enrollment number from what it returns.
      const { data, error } = await supabase.rpc('search_directory', {
        _query: q,
        ...(roleFilter === 'all' ? {} : { _role: roleFilter }),
      });
      if (!error) setResults((data as DirectoryResult[]) ?? []);
      if (error) setResults([]);
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, roleFilter]);

  const connectedIds = new Set(
    relationships.map((r) => (r.lawyer_id === user?.id ? r.partner_id : r.lawyer_id)),
  );

  const handleConnect = async (target: DirectoryResult) => {
    if (!user || !profile) return;
    setSendingTo(target.id);

    // A relationship always has one lawyer side and one partner side.
    const isCurrentUserLawyer = profile.role === 'lawyer';
    const payload = {
      lawyer_id: isCurrentUserLawyer ? user.id : target.id,
      partner_id: isCurrentUserLawyer ? target.id : user.id,
      requested_by: user.id,
      status: 'pending' as const,
    };

    const { error } = await supabase.from('partner_relationships').insert(payload);
    setSendingTo(null);
    if (error) {
      toast({ title: 'Could not send request', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Request sent', description: `Waiting for ${target.name} to accept.` });
    loadConnections();
  };

  const respond = async (rel: Relationship, status: 'accepted' | 'rejected') => {
    const { error } = await supabase.from('partner_relationships').update({ status }).eq('id', rel.id);
    if (error) {
      toast({ title: 'Something went wrong', description: error.message, variant: 'destructive' });
      return;
    }
    loadConnections();
  };

  const remove = async (rel: Relationship) => {
    const { error } = await supabase.from('partner_relationships').update({ status: 'removed' }).eq('id', rel.id);
    if (error) return;
    loadConnections();
  };

  const incoming = relationships.filter((r) => r.status === 'pending' && r.requested_by !== user?.id);
  const sentPending = relationships.filter((r) => r.status === 'pending' && r.requested_by === user?.id);
  const accepted = relationships.filter((r) => r.status === 'accepted');

  return (
    <div className="min-h-screen bg-background legal-pattern pb-16">
      <Header />
      <main className="container max-w-2xl py-6 space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-bold mb-1">Partners</h1>
          <p className="text-sm text-muted-foreground">
            Search verified professionals and send a connection request. Contact details and cases stay private.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['all', 'lawyer', 'partner'] as const).map((role) => (
            <Button
              key={role}
              type="button"
              size="sm"
              variant={roleFilter === role ? 'default' : 'outline'}
              onClick={() => setRoleFilter(role)}
              className={roleFilter === role ? 'gold-gradient text-primary-foreground' : 'border-primary/30'}
            >
              {role === 'all' ? 'All professionals' : role === 'lawyer' ? 'Lawyers' : 'Partners'}
            </Button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, city, or practice area"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-secondary/50"
          />
        </div>

        {isSearching && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-3">
            {results
              .filter((r) => r.id !== user?.id)
              .map((r) => (
                <Card key={r.id} className="border-border/60 bg-card/70">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Avatar className="h-11 w-11 border border-primary/20">
                      <AvatarImage src={r.profile_photo_url ?? undefined} alt={r.name} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {r.name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[r.practice_area, r.court_name, r.city].filter(Boolean).join(' Â· ') || r.role}
                      </p>
                    </div>
                    {connectedIds.has(r.id) ? (
                      <Badge variant="outline" className="border-primary/30 text-primary shrink-0">Connected</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={sendingTo === r.id}
                        onClick={() => handleConnect(r)}
                        className="shrink-0 border-primary/40 text-primary hover:bg-primary/10"
                      >
                        {sendingTo === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                          <><UserPlus className="mr-1.5 h-3.5 w-3.5" /> Connect</>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>
        )}

        {isLoadingConnections ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {incoming.length > 0 && (
              <Card className="glass-effect border-primary/20">
                <CardHeader>
                  <CardTitle className="font-serif text-lg">Requests waiting for you</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {incoming.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{r.otherName}</span>
                      <div className="flex gap-2 shrink-0">
                        <Button size="icon" variant="outline" className="h-8 w-8 text-emerald-500 border-emerald-500/40" onClick={() => respond(r, 'accepted')} aria-label="Accept">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" className="h-8 w-8 text-destructive border-destructive/40" onClick={() => respond(r, 'rejected')} aria-label="Decline">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className="glass-effect border-primary/20">
              <CardHeader>
                <CardTitle className="font-serif text-lg flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> My connections
                </CardTitle>
              </CardHeader>
              <CardContent>
                {accepted.length === 0 && sentPending.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No connections yet â€” search above to find colleagues.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {accepted.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{r.otherName}</p>
                          <p className="text-xs text-muted-foreground capitalize">{r.otherRole}</p>
                        </div>
                        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => remove(r)}>
                          Remove
                        </Button>
                      </li>
                    ))}
                    {sentPending.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-3">
                        <p className="text-sm">{r.otherName}</p>
                        <Badge variant="outline" className="text-muted-foreground">Pending</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
