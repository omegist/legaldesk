import { useEffect, useState } from 'react';
import { Loader2, UserPlus, Users, Mail, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/Header';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Invite {
  id: string;
  firm_id: string;
  email: string;
  status: string;
  created_at: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function Team() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();

  const isOwner = !!profile?.firm_id && profile.firm_id === user?.id;
  const isMember = !!profile?.firm_id && profile.firm_id !== user?.id;

  // Chambers = max 3 total (owner + 2 members). Firm = unlimited.
  const isChambers = profile?.subscription_tier === 'chambers';
  const memberLimit = isChambers ? 2 : null;
  const atCapacity = memberLimit !== null && members.length >= memberLimit;

  const [invites, setInvites] = useState<Invite[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Pending invite for the current user (member view)
  const [myInvite, setMyInvite] = useState<Invite | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    if (!user || !profile) return;
    if (isOwner) loadOwnerData();
    else loadMemberData();
  }, [user, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadOwnerData() {
    setIsLoading(true);
    const [{ data: inv }, { data: mem }] = await Promise.all([
      supabase
        .from('firm_invites')
        .select('id, email, status, created_at')
        .eq('firm_id', user!.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, name, email, role')
        .eq('firm_id', user!.id)
        .neq('id', user!.id),
    ]);
    setInvites((inv as Invite[]) ?? []);
    setMembers((mem as TeamMember[]) ?? []);
    setIsLoading(false);
  }

  async function loadMemberData() {
    setIsLoading(true);
    const { data } = await supabase
      .from('firm_invites')
      .select('id, firm_id, email, status, created_at')
      .eq('email', profile!.email)
      .eq('status', 'pending')
      .maybeSingle();
    setMyInvite(data as Invite | null);
    setIsLoading(false);
  }

  async function handleInvite() {
    if (!email.trim() || !user) return;
    setIsSending(true);
    const { error } = await supabase.from('firm_invites').insert({
      firm_id: user.id,
      invited_by: user.id,
      email: email.trim().toLowerCase(),
    });
    setIsSending(false);
    if (error) {
      toast({ title: 'Could not send invite', description: error.message, variant: 'destructive' });
      return;
    }
    setEmail('');
    toast({ title: 'Invite sent', description: `${email} will see the invite when they log in.` });
    loadOwnerData();
  }

  async function handleRevoke(id: string) {
    await supabase.from('firm_invites').update({ status: 'revoked' }).eq('id', id);
    loadOwnerData();
  }

  async function handleRemoveMember(memberId: string) {
    await supabase.from('profiles').update({ firm_id: null }).eq('id', memberId);
    loadOwnerData();
  }

  async function handleAccept() {
    if (!myInvite || !user) return;
    setIsAccepting(true);
    const { error } = await supabase
      .from('firm_invites')
      .update({ status: 'accepted' })
      .eq('id', myInvite.id);
    if (error) {
      setIsAccepting(false);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    await supabase.from('profiles').update({ firm_id: myInvite.firm_id ?? null }).eq('id', user.id);
    await refreshProfile();
    setIsAccepting(false);
    toast({ title: 'Joined the chambers!', description: 'You can now see shared cases.' });
    setMyInvite(null);
  }

  const tierOk = profile?.subscription_tier === 'chambers' || profile?.subscription_tier === 'firm';

  if (!tierOk && !isMember) {
    return (
      <div className="min-h-screen bg-background legal-pattern">
        <Header />
        <main className="container max-w-lg py-16 text-center space-y-3">
          <Users className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
          <p className="text-muted-foreground text-sm">
            Team management is available on the Chambers and Firm plans.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background legal-pattern pb-16">
      <Header />
      <main className="container max-w-xl py-6 space-y-6">
        <h1 className="font-serif text-2xl font-bold">Team</h1>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : isMember ? (
          /* ── Member view ── */
          <Card className="glass-effect border-primary/20">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Your membership</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {myInvite ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    You have a pending invite to join a chambers. Accept it to share cases and diary
                    with the team.
                  </p>
                  <Button
                    onClick={handleAccept}
                    disabled={isAccepting}
                    className="w-full gold-gradient text-primary-foreground"
                  >
                    {isAccepting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accept invite & join'}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  You are a member of a chambers. All cases with a shared firm are visible to your
                  team.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          /* ── Owner view ── */
          <>
            {/* Invite form */}
            <Card className="glass-effect border-primary/20">
              <CardHeader>
                <CardTitle className="font-serif text-lg flex items-center gap-2">
                  <UserPlus className="h-4 w-4" /> Invite a member
                </CardTitle>
                {memberLimit !== null && (
                  <p className="text-xs text-muted-foreground">
                    {members.length} of {memberLimit} member slots used
                    {atCapacity && ' — upgrade to Firm plan for unlimited members'}
                  </p>
                )}
              </CardHeader>
              <CardContent className="flex gap-2">
                <Input
                  type="email"
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !atCapacity && handleInvite()}
                  className="bg-secondary/50"
                  disabled={atCapacity}
                />
                <Button
                  onClick={handleInvite}
                  disabled={isSending || !email.trim() || atCapacity}
                  className="gold-gradient text-primary-foreground shrink-0"
                >
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
                </Button>
              </CardContent>
            </Card>

            {/* Active members */}
            {members.length > 0 && (
              <Card className="glass-effect border-primary/20">
                <CardHeader>
                  <CardTitle className="font-serif text-lg flex items-center gap-2">
                    <Users className="h-4 w-4" /> Members ({members.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 py-1">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="capitalize border-primary/30 text-xs">
                          {m.role}
                        </Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveMember(m.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Invites list */}
            {invites.length > 0 && (
              <Card className="glass-effect border-primary/20">
                <CardHeader>
                  <CardTitle className="font-serif text-lg flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Invites
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between gap-3 py-1">
                      <p className="text-sm truncate">{inv.email}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        {inv.status === 'accepted' && (
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        )}
                        {inv.status === 'revoked' && (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        {inv.status === 'pending' && (
                          <>
                            <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-500">
                              pending
                            </Badge>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleRevoke(inv.id)}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
