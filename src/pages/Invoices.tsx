import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { generateInvoicePdf } from '@/lib/generateInvoicePdf';
import { cn } from '@/lib/utils';

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  description: string;
  amount: number;
  gst_applicable: boolean;
  gst_rate: number;
  gst_amount: number;
  total_amount: number;
  status: string;
  issue_date: string;
  due_date: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'border-muted-foreground/40 text-muted-foreground',
  sent: 'border-sky-500/40 text-sky-500',
  paid: 'border-emerald-500/40 text-emerald-500',
  overdue: 'border-destructive/40 text-destructive',
  cancelled: 'border-muted-foreground/40 text-muted-foreground line-through',
};

export default function Invoices() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('lawyer_id', user.id)
      .order('created_at', { ascending: false });
    setInvoices((data as Invoice[]) ?? []);
    setIsLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const totalOutstanding = invoices
    .filter((inv) => inv.status === 'sent' || inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.total_amount, 0);

  const handleDownload = (inv: Invoice) => {
    if (!profile) return;
    const blob = generateInvoicePdf(
      {
        invoice_number: inv.invoice_number,
        client_name: inv.client_name,
        client_email: inv.client_email,
        client_phone: inv.client_phone,
        description: inv.description,
        amount: inv.amount,
        gst_applicable: inv.gst_applicable,
        gst_rate: inv.gst_rate,
        gst_amount: inv.gst_amount,
        total_amount: inv.total_amount,
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        notes: null,
      },
      { name: profile.name, email: profile.email, phone: profile.phone },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inv.invoice_number}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStatusChange = async (inv: Invoice, status: string) => {
    setUpdatingId(inv.id);
    const { error } = await supabase
      .from('invoices')
      .update({ status, paid_at: status === 'paid' ? new Date().toISOString() : null })
      .eq('id', inv.id);
    setUpdatingId(null);
    if (error) {
      toast({ title: 'Could not update status', description: error.message, variant: 'destructive' });
      return;
    }
    setInvoices((prev) => prev.map((i) => (i.id === inv.id ? { ...i, status } : i)));
  };

  return (
    <div className="min-h-screen bg-background legal-pattern pb-16">
      <Header />
      <main className="container max-w-3xl py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold">Invoices</h1>
            {totalOutstanding > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                ₹{totalOutstanding.toFixed(2)} outstanding across sent/overdue invoices
              </p>
            )}
          </div>
          <Button onClick={() => navigate('/invoices/new')} className="gold-gradient text-primary-foreground">
            <Plus className="mr-1 h-4 w-4" /> New Invoice
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No invoices yet — create your first one.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {invoices.map((inv) => (
              <li key={inv.id} className="rounded-xl border border-border/60 bg-card/60 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="font-medium">{inv.invoice_number} · {inv.client_name}</p>
                    <p className="text-sm text-muted-foreground truncate">{inv.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Issued {new Date(inv.issue_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {inv.due_date && ` · Due ${new Date(inv.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold">₹{inv.total_amount.toFixed(2)}</p>
                    <Badge variant="outline" className={cn('capitalize mt-1', STATUS_STYLES[inv.status])}>
                      {inv.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
                  <Select
                    value={inv.status}
                    onValueChange={(v) => handleStatusChange(inv, v)}
                    disabled={updatingId === inv.id}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(inv)}>
                    <Download className="mr-1.5 h-3.5 w-3.5" /> PDF
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}