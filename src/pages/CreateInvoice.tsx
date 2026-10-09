import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Header } from '@/components/layout/Header';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { generateInvoicePdf } from '@/lib/generateInvoicePdf';
import type { Diary } from '@/types';

export default function CreateInvoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const diaryIdFromUrl = searchParams.get('caseId');
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [linkedCase, setLinkedCase] = useState<Diary | null>(null);

  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    description: '',
    amount: '',
    gst_applicable: false,
    due_date: '',
    notes: '',
  });

  // If opened from a case's "Create invoice" button, pre-fill what we can
  // from that case so the lawyer isn't retyping the client name.
  useEffect(() => {
    if (!diaryIdFromUrl) return;
    supabase
      .from('diaries')
      .select('*')
      .eq('id', diaryIdFromUrl)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const diary = data as Diary;
        setLinkedCase(diary);
        setForm((f) => ({
          ...f,
          client_name: diary.client_name || '',
          client_email: diary.client_email || '',
          client_phone: diary.client_phone || '',
          description: `Professional fees — ${diary.case_type} ${diary.case_number}`,
        }));
      });
  }, [diaryIdFromUrl]);

  const amountNum = parseFloat(form.amount) || 0;
  const gstAmount = form.gst_applicable ? Math.round(amountNum * 0.18 * 100) / 100 : 0;
  const totalAmount = amountNum + gstAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!form.client_name.trim() || !form.description.trim() || amountNum <= 0) {
      toast({ title: 'Missing details', description: 'Client name, description, and a valid amount are required.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    // Simple sequential invoice numbering per lawyer: INV-0001, INV-0002, ...
    const { count } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('lawyer_id', user.id);
    const invoiceNumber = `INV-${String((count || 0) + 1).padStart(4, '0')}`;

    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        lawyer_id: user.id,
        diary_id: linkedCase?.id ?? null,
        invoice_number: invoiceNumber,
        client_name: form.client_name.trim(),
        client_email: form.client_email.trim() || null,
        client_phone: form.client_phone.trim() || null,
        description: form.description.trim(),
        amount: amountNum,
        gst_applicable: form.gst_applicable,
        due_date: form.due_date || null,
        notes: form.notes.trim() || null,
        status: 'draft',
      })
      .select()
      .single();

    setIsSaving(false);

    if (error || !invoice) {
      toast({ title: 'Could not create invoice', description: error?.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Invoice created', description: `${invoiceNumber} saved as draft.` });
    navigate('/invoices');
  };

  const handlePreviewPdf = () => {
    if (!profile) return;
    const blob = generateInvoicePdf(
      {
        invoice_number: 'DRAFT',
        client_name: form.client_name || 'Client name',
        client_email: form.client_email || null,
        client_phone: form.client_phone || null,
        description: form.description || 'Description of services',
        amount: amountNum,
        gst_applicable: form.gst_applicable,
        gst_rate: 18,
        gst_amount: gstAmount,
        total_amount: totalAmount,
        issue_date: new Date().toISOString(),
        due_date: form.due_date || null,
        notes: form.notes || null,
      },
      { name: profile.name, email: profile.email, phone: profile.phone, firm_logo_url: profile.firm_logo_url },
    );
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-background legal-pattern pb-16">
      <Header />
      <main className="container max-w-xl py-6 space-y-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div>
          <h1 className="font-serif text-2xl font-bold">New Invoice</h1>
          {linkedCase && (
            <p className="text-sm text-muted-foreground mt-1">
              Linked to case: {linkedCase.case_type} {linkedCase.case_number}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="glass-effect border-primary/20">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Client details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client_name">Client name *</Label>
                <Input id="client_name" required value={form.client_name}
                  onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
                  className="bg-secondary/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client_email">Email</Label>
                  <Input id="client_email" type="email" value={form.client_email}
                    onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))}
                    className="bg-secondary/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client_phone">Phone</Label>
                  <Input id="client_phone" value={form.client_phone}
                    onChange={(e) => setForm((f) => ({ ...f, client_phone: e.target.value }))}
                    className="bg-secondary/50" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-effect border-primary/20 mt-6">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Invoice details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea id="description" required rows={2} value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Professional fees for drafting and filing"
                  className="bg-secondary/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (₹) *</Label>
                  <Input id="amount" type="number" min="0" step="0.01" required value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    className="bg-secondary/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due date</Label>
                  <Input id="due_date" type="date" value={form.due_date}
                    onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                    className="bg-secondary/50" />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium">Add GST (18%)</p>
                  <p className="text-xs text-muted-foreground">Toggle on if this invoice is GST-applicable</p>
                </div>
                <Switch checked={form.gst_applicable}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, gst_applicable: v }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea id="notes" rows={2} value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Payment instructions, terms, etc."
                  className="bg-secondary/50" />
              </div>

              {amountNum > 0 && (
                <div className="rounded-lg bg-secondary/30 p-4 text-sm space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Amount</span><span>₹{amountNum.toFixed(2)}</span>
                  </div>
                  {form.gst_applicable && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>GST (18%)</span><span>₹{gstAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold pt-1 border-t border-border/60">
                    <span>Total</span><span>₹{totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3 mt-6">
            <Button type="button" variant="outline" onClick={handlePreviewPdf} disabled={amountNum <= 0}>
              <Download className="mr-2 h-4 w-4" /> Preview PDF
            </Button>
            <Button type="submit" disabled={isSaving} className="flex-1 gold-gradient text-primary-foreground">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Invoice'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}