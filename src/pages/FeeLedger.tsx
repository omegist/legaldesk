import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, IndianRupee, FileText } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Payment {
  id: string;
  diary_id: string;
  amount: number;
  payment_type: string;
  payment_date: string;
  mode: string;
  note: string | null;
  diary: { party_names: string; case_number: string } | null;
}

const MODE_STYLES: Record<string, string> = {
  cash: 'border-emerald-500/40 text-emerald-400',
  upi: 'border-sky-500/40 text-sky-400',
  cheque: 'border-amber-500/40 text-amber-400',
  bank_transfer: 'border-violet-500/40 text-violet-400',
};

export default function FeeLedger() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('fee_payments')
      .select('*, diary:diaries(party_names, case_number)')
      .eq('lawyer_id', user.id)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPayments((data as Payment[]) ?? []);
        setIsLoading(false);
      });
  }, [user]);

  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="min-h-screen bg-background legal-pattern pb-16">
      <Header />
      <main className="container max-w-2xl py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold">Fee Ledger</h1>
            {payments.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <IndianRupee className="h-3.5 w-3.5" />
                {total.toLocaleString('en-IN', { minimumFractionDigits: 2 })} received across all cases
              </p>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No payments recorded yet. Open a case to add fee entries.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {payments.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-border/60 bg-card/60 p-4 cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => navigate(`/cases/${p.diary_id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.diary?.party_names ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{p.diary?.case_number} · {p.payment_type}</p>
                    {p.note && <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.note}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-emerald-400">
                      +₹{p.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <Badge variant="outline" className={cn('capitalize mt-1 text-[10px]', MODE_STYLES[p.mode] ?? 'border-border text-muted-foreground')}>
                      {p.mode.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
