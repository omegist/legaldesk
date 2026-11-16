import { useState } from 'react';
import { Loader2, Plus, Trash2, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type FeePayment = {
  id: string;
  amount: number;
  payment_type: string;
  payment_date: string;
  mode: string;
  note: string | null;
};

const PAYMENT_TYPES = ['General', 'Retainer', 'Appearance fee', 'Part payment', 'Final settlement'];
const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

interface CaseFeeLedgerProps {
  diaryId: string;
  lawyerId: string;
  feePayments: FeePayment[];
  onRefresh: () => void;
}

export function CaseFeeLedger({ diaryId, lawyerId, feePayments, onRefresh }: CaseFeeLedgerProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [feeForm, setFeeForm] = useState({
    amount: '',
    payment_type: 'General',
    mode: 'cash',
    payment_date: new Date().toISOString().slice(0, 10),
    note: '',
  });

  const addFeePayment = async () => {
    if (!feeForm.amount) return;
    const amt = parseFloat(feeForm.amount);
    if (isNaN(amt) || amt <= 0) return;
    setIsSaving(true);
    const { error } = await supabase.from('fee_payments').insert({
      diary_id: diaryId,
      lawyer_id: lawyerId,
      amount: amt,
      payment_type: feeForm.payment_type,
      mode: feeForm.mode,
      payment_date: feeForm.payment_date,
      note: feeForm.note.trim() || null,
    });
    setIsSaving(false);
    if (error) {
      toast({ title: 'Could not save payment', description: error.message, variant: 'destructive' });
      return;
    }
    setFeeForm({ amount: '', payment_type: 'General', mode: 'cash', payment_date: new Date().toISOString().slice(0, 10), note: '' });
    onRefresh();
  };

  const deleteFeePayment = async (feeId: string) => {
    await supabase.from('fee_payments').delete().eq('id', feeId);
    onRefresh();
  };

  const total = feePayments.reduce((s, p) => s + p.amount, 0);

  return (
    <AccordionItem value="fees" className="border-border/60">
      <AccordionTrigger className="font-serif">
        <span className="flex items-center gap-2">
          <IndianRupee className="h-4 w-4 text-primary" /> Fee Ledger
          {feePayments.length > 0 && (
            <span className="ml-1 text-xs text-emerald-400">
              ₹{total.toLocaleString('en-IN')}
            </span>
          )}
        </span>
      </AccordionTrigger>
      <AccordionContent className="space-y-4">
        {/* Add payment form — using shadcn components */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="fee-amount">Amount (₹)</Label>
            <Input
              id="fee-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 5000"
              value={feeForm.amount}
              onChange={(e) => setFeeForm((f) => ({ ...f, amount: e.target.value }))}
              className="bg-secondary/50"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Payment type</Label>
            <Select
              value={feeForm.payment_type}
              onValueChange={(v) => setFeeForm((f) => ({ ...f, payment_type: v }))}
            >
              <SelectTrigger className="bg-secondary/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Mode</Label>
            <Select
              value={feeForm.mode}
              onValueChange={(v) => setFeeForm((f) => ({ ...f, mode: v }))}
            >
              <SelectTrigger className="bg-secondary/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fee-date">Date</Label>
            <Input
              id="fee-date"
              type="date"
              value={feeForm.payment_date}
              onChange={(e) => setFeeForm((f) => ({ ...f, payment_date: e.target.value }))}
              className="bg-secondary/50"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fee-note">Note</Label>
            <Input
              id="fee-note"
              type="text"
              placeholder="Optional"
              value={feeForm.note}
              onChange={(e) => setFeeForm((f) => ({ ...f, note: e.target.value }))}
              className="bg-secondary/50"
            />
          </div>
        </div>

        <Button
          size="sm"
          onClick={addFeePayment}
          disabled={isSaving || !feeForm.amount}
          className="gold-gradient text-primary-foreground w-full"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1 h-4 w-4" /> Record Payment</>}
        </Button>

        {/* Payment list */}
        {feePayments.length > 0 && (
          <ul className="space-y-2 pt-1">
            {feePayments.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-emerald-400">+₹{p.amount.toLocaleString('en-IN')}</span>
                  <span className="text-muted-foreground ml-2">{p.payment_type} · {p.mode}</span>
                  {p.note && <p className="text-xs text-muted-foreground">{p.note}</p>}
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => deleteFeePayment(p.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
