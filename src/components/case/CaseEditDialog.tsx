import { useState } from 'react';
import { Pencil, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Diary } from '@/types';

interface CaseEditDialogProps {
  diary: Diary;
  lastKnownUpdatedAt: string | null;
  onSaved: (updated: Diary, newUpdatedAt: string | null) => void;
}

export function CaseEditDialog({ diary, lastKnownUpdatedAt, onSaved }: CaseEditDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    party_names: diary.party_names || '',
    case_type: diary.case_type || '',
    case_number: diary.case_number || '',
    court_name: diary.court_name || '',
    court_number: diary.court_number || '',
    judge_name: diary.judge_name || '',
    opponent_advocate: diary.opponent_advocate || '',
    stage_of_case: diary.stage_of_case || '',
    purpose_of_hearing: diary.purpose_of_hearing || '',
    notes: diary.notes || '',
    matter_date: diary.matter_date || '',
    hearing_time: diary.hearing_time || '',
    client_name: diary.client_name || '',
    client_phone: diary.client_phone || '',
    client_email: diary.client_email || '',
  });

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      // Reset form to current diary values when opening
      setForm({
        party_names: diary.party_names || '',
        case_type: diary.case_type || '',
        case_number: diary.case_number || '',
        court_name: diary.court_name || '',
        court_number: diary.court_number || '',
        judge_name: diary.judge_name || '',
        opponent_advocate: diary.opponent_advocate || '',
        stage_of_case: diary.stage_of_case || '',
        purpose_of_hearing: diary.purpose_of_hearing || '',
        notes: diary.notes || '',
        matter_date: diary.matter_date || '',
        hearing_time: diary.hearing_time || '',
        client_name: diary.client_name || '',
        client_phone: diary.client_phone || '',
        client_email: diary.client_email || '',
      });
    }
    setOpen(isOpen);
  };

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.party_names.trim()) {
      toast({ title: 'Party names required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);

    let query = supabase.from('diaries').update({
      party_names: form.party_names.trim(),
      case_type: form.case_type.trim() || null,
      case_number: form.case_number.trim() || null,
      court_name: form.court_name.trim() || null,
      court_number: form.court_number.trim() || null,
      judge_name: form.judge_name.trim() || null,
      opponent_advocate: form.opponent_advocate.trim() || null,
      stage_of_case: form.stage_of_case.trim() || null,
      purpose_of_hearing: form.purpose_of_hearing.trim() || null,
      notes: form.notes.trim() || null,
      matter_date: form.matter_date || diary.matter_date,
      hearing_time: form.hearing_time || null,
      client_name: form.client_name.trim() || null,
      client_phone: form.client_phone.trim() || null,
      client_email: form.client_email.trim() || null,
    }).eq('id', diary.id);

    if (lastKnownUpdatedAt) {
      query = query.eq('updated_at', lastKnownUpdatedAt);
    }

    const { data, error } = await query.select().maybeSingle();
    setIsSaving(false);

    if (error) {
      toast({ title: 'Could not update case', description: error.message, variant: 'destructive' });
      return;
    }
    if (!data) {
      toast({ title: 'Conflict detected', description: 'Another user modified this case. Please refresh.', variant: 'destructive' });
      return;
    }

    onSaved(data as Diary, (data as any).updated_at ?? null);
    toast({ title: 'Case updated' });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit Case
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Edit Case Details</DialogTitle>
          <DialogDescription>Update the case information below.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-party">Party names *</Label>
            <Input id="edit-party" value={form.party_names} onChange={(e) => update('party_names', e.target.value)} className="bg-secondary/50" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-type">Case type</Label>
              <Input id="edit-type" value={form.case_type} onChange={(e) => update('case_type', e.target.value)} className="bg-secondary/50" placeholder="e.g. Civil Suit" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-number">Case number</Label>
              <Input id="edit-number" value={form.case_number} onChange={(e) => update('case_number', e.target.value)} className="bg-secondary/50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-date">Next date</Label>
              <Input id="edit-date" type="date" value={form.matter_date} onChange={(e) => update('matter_date', e.target.value)} className="bg-secondary/50" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-time">Hearing time</Label>
              <Input id="edit-time" type="time" value={form.hearing_time} onChange={(e) => update('hearing_time', e.target.value)} className="bg-secondary/50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-court">Court</Label>
              <Input id="edit-court" value={form.court_name} onChange={(e) => update('court_name', e.target.value)} className="bg-secondary/50" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-courtno">Court / board no.</Label>
              <Input id="edit-courtno" value={form.court_number} onChange={(e) => update('court_number', e.target.value)} className="bg-secondary/50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-judge">Presiding judge</Label>
              <Input id="edit-judge" value={form.judge_name} onChange={(e) => update('judge_name', e.target.value)} className="bg-secondary/50" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-opponent">Opposing counsel</Label>
              <Input id="edit-opponent" value={form.opponent_advocate} onChange={(e) => update('opponent_advocate', e.target.value)} className="bg-secondary/50" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-stage">Stage of case</Label>
            <Input id="edit-stage" value={form.stage_of_case} onChange={(e) => update('stage_of_case', e.target.value)} className="bg-secondary/50" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-purpose">Purpose of hearing</Label>
            <Input id="edit-purpose" value={form.purpose_of_hearing} onChange={(e) => update('purpose_of_hearing', e.target.value)} className="bg-secondary/50" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea id="edit-notes" rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} className="bg-secondary/50" />
          </div>

          <p className="text-xs font-medium text-muted-foreground pt-2">Client Information</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-cname">Client name</Label>
              <Input id="edit-cname" value={form.client_name} onChange={(e) => update('client_name', e.target.value)} className="bg-secondary/50" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-cphone">Client phone</Label>
              <Input id="edit-cphone" type="tel" value={form.client_phone} onChange={(e) => update('client_phone', e.target.value)} className="bg-secondary/50" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-cemail">Client email</Label>
            <Input id="edit-cemail" type="email" value={form.client_email} onChange={(e) => update('client_email', e.target.value)} className="bg-secondary/50" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving} className="gold-gradient text-primary-foreground">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
