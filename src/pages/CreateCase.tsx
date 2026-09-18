import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits';
import { supabase } from '@/integrations/supabase/client';

export default function CreateCase() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { canCreateCase, limit, activeCases, tierLabel } = useSubscriptionLimits();
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    matter_date: '',
    hearing_time: '',
    court_name: '',
    court_number: '',
    case_type: '',
    case_number: '',
    party_names: '',
    client_name: '',
    client_phone: '',
    client_email: '',
    opponent_advocate: '',
    judge_name: '',
    stage_of_case: '',
    purpose_of_hearing: '',
    notes: '',
    reminder_hours_before: '24',
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);

    const { data, error } = await supabase
      .from('diaries')
      .insert({
        lawyer_id: user.id,
        matter_date: form.matter_date,
        hearing_time: form.hearing_time || null,
        court_name: form.court_name,
        court_number: form.court_number || null,
        case_type: form.case_type,
        case_number: form.case_number,
        party_names: form.party_names,
        client_name: form.client_name || null,
        client_phone: form.client_phone || null,
        client_email: form.client_email || null,
        opponent_advocate: form.opponent_advocate || null,
        judge_name: form.judge_name || null,
        stage_of_case: form.stage_of_case || null,
        purpose_of_hearing: form.purpose_of_hearing || null,
        notes: form.notes || null,
        reminder_hours_before: Number(form.reminder_hours_before) || 24,
      })
      .select()
      .single();

    setIsSaving(false);

    if (error) {
      const isLimit = error.message.includes('FREE_TIER_LIMIT');
      toast({
        title: isLimit ? 'Free plan limit reached' : 'Could not save the case',
        description: isLimit
          ? 'The Free plan allows 5 active cases. Upgrade to Pro for unlimited matters.'
          : error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Case added', description: `${form.case_number} is now in your diary.` });
    navigate(`/cases/${data.id}`);
  };

  return (
    <div className="min-h-screen bg-background legal-pattern">
      <Header />
      <main className="container max-w-2xl py-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 -ml-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>

        <h1 className="font-serif text-2xl font-bold mb-6">New Case</h1>

        {!canCreateCase && (
          <Card className="mb-6 border-primary/40 bg-primary/10">
            <CardContent className="flex items-start gap-3 p-4">
              <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">
                  You've used all {limit} active cases on the {tierLabel} plan.
                </p>
                <p className="text-muted-foreground">
                  Upgrade to Pro (₹499/month) for unlimited matters.
                </p>
                <Button
                  size="sm"
                  className="mt-3 gold-gradient text-primary-foreground"
                  onClick={() => navigate('/pricing')}
                >
                  View plans
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="glass-effect border-primary/20">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Hearing</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="matter_date">Next date *</Label>
                <Input
                  id="matter_date"
                  type="date"
                  required
                  value={form.matter_date}
                  onChange={(e) => set('matter_date')(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hearing_time">Time</Label>
                <Input
                  id="hearing_time"
                  type="time"
                  value={form.hearing_time}
                  onChange={(e) => set('hearing_time')(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="court_name">Court *</Label>
                <Input
                  id="court_name"
                  required
                  placeholder="District Court, Thane"
                  value={form.court_name}
                  onChange={(e) => set('court_name')(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="court_number">Court / board number</Label>
                <Input
                  id="court_number"
                  placeholder="12"
                  value={form.court_number}
                  onChange={(e) => set('court_number')(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purpose">Purpose of hearing</Label>
                <Input
                  id="purpose"
                  placeholder="Evidence / Arguments"
                  value={form.purpose_of_hearing}
                  onChange={(e) => set('purpose_of_hearing')(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reminder">Remind me</Label>
                <Select
                  value={form.reminder_hours_before}
                  onValueChange={set('reminder_hours_before')}
                >
                  <SelectTrigger id="reminder" className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="48">48 hours before</SelectItem>
                    <SelectItem value="24">24 hours before</SelectItem>
                    <SelectItem value="2">2 hours before</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-effect border-primary/20">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Matter</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="case_type">Case type *</Label>
                <Input
                  id="case_type"
                  required
                  placeholder="C.C. / R.C.S. / Cri. M.A."
                  value={form.case_type}
                  onChange={(e) => set('case_type')(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="case_number">Case number *</Label>
                <Input
                  id="case_number"
                  required
                  placeholder="123/2026"
                  value={form.case_number}
                  onChange={(e) => set('case_number')(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="party_names">Parties *</Label>
                <Input
                  id="party_names"
                  required
                  placeholder="Sharma vs. Patil"
                  value={form.party_names}
                  onChange={(e) => set('party_names')(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stage">Stage of case</Label>
                <Input
                  id="stage"
                  placeholder="Written statement"
                  value={form.stage_of_case}
                  onChange={(e) => set('stage_of_case')(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="judge">Presiding judge</Label>
                <Input
                  id="judge"
                  value={form.judge_name}
                  onChange={(e) => set('judge_name')(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="opponent">Opposing counsel</Label>
                <Input
                  id="opponent"
                  value={form.opponent_advocate}
                  onChange={(e) => set('opponent_advocate')(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-effect border-primary/20">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Client</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="client_name">Name</Label>
                <Input
                  id="client_name"
                  value={form.client_name}
                  onChange={(e) => set('client_name')(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_phone">Phone</Label>
                <Input
                  id="client_phone"
                  type="tel"
                  value={form.client_phone}
                  onChange={(e) => set('client_phone')(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="client_email">Email</Label>
                <Input
                  id="client_email"
                  type="email"
                  value={form.client_email}
                  onChange={(e) => set('client_email')(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  rows={4}
                  value={form.notes}
                  onChange={(e) => set('notes')(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={isSaving || !canCreateCase}
            className="w-full gold-gradient text-primary-foreground"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save case'}
          </Button>
          {limit !== null && (
            <p className="text-center text-xs text-muted-foreground">
              {activeCases} of {limit} active cases used on the {tierLabel} plan.
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
