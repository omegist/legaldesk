import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { TimelineEntry } from '@/types';

interface CaseTimelineProps {
  diaryId: string;
  userId: string;
  entries: TimelineEntry[];
  canAddNotes: boolean;
  onRefresh: () => void;
}

export function CaseTimeline({ diaryId, userId, entries, canAddNotes, onRefresh }: CaseTimelineProps) {
  const { toast } = useToast();
  const [newEntry, setNewEntry] = useState('');
  const [shareWithClient, setShareWithClient] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const addEntry = async () => {
    if (!newEntry.trim()) return;
    setIsSaving(true);
    const { error } = await supabase.from('diary_timeline_entries').insert({
      diary_id: diaryId,
      content: newEntry.trim(),
      created_by: userId,
      entry_type: shareWithClient ? 'order' : 'private',
    });
    setIsSaving(false);
    if (error) {
      toast({ title: 'Could not add note', description: error.message, variant: 'destructive' });
      return;
    }
    setNewEntry('');
    setShareWithClient(false);
    onRefresh();
  };

  const deleteEntry = async (entryId: string) => {
    await supabase.from('diary_timeline_entries').delete().eq('id', entryId);
    onRefresh();
  };

  return (
    <Card className="glass-effect border-primary/20">
      <CardHeader>
        <CardTitle className="font-serif text-lg">Order Sheet &amp; Hearing Notes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 mb-6">
          <Textarea
            rows={3}
            placeholder={canAddNotes ? 'What happened in court today?' : 'You have view-only access to this case.'}
            value={newEntry}
            onChange={(e) => setNewEntry(e.target.value)}
            disabled={!canAddNotes}
            className="bg-secondary/50"
          />
          {canAddNotes && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={shareWithClient}
                onChange={(e) => setShareWithClient(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-primary"
              />
              Share with client (visible in client portal)
            </label>
          )}
          <Button
            onClick={addEntry}
            disabled={!canAddNotes || isSaving || !newEntry.trim()}
            className="gold-gradient text-primary-foreground"
            size="sm"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="mr-1 h-4 w-4" /> Add entry
              </>
            )}
          </Button>
        </div>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No entries recorded yet.
          </p>
        ) : (
          <ol className="relative border-l border-border/60 pl-5 space-y-5">
            {entries.map((entry) => (
              <li key={entry.id} className="relative">
                <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-primary">
                      {new Date(entry.entry_date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{entry.content}</p>
                  </div>
                  {entry.created_by === userId && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          aria-label="Delete entry"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This timeline entry will be permanently removed. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteEntry(entry.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
