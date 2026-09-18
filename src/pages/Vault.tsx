import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Upload, Loader2, FileText, Download, Trash2, FolderLock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { cn } from '@/lib/utils';
import { DOCUMENT_CATEGORIES, type CaseDocument, type DocumentCategory, type Diary } from '@/types';

const BUCKET = 'case-documents';

export default function Vault() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [docs, setDocs] = useState<CaseDocument[]>([]);
  const [cases, setCases] = useState<Diary[]>([]);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<DocumentCategory | 'all'>('all');
  const [category, setCategory] = useState<DocumentCategory>('client_evidence');
  const [diaryId, setDiaryId] = useState<string>('none');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const load = useCallback(async () => {
    const [{ data: d }, { data: c }] = await Promise.all([
      supabase.from('documents').select('*').order('created_at', { ascending: false }),
      supabase.from('diaries').select('*').order('matter_date', { ascending: false }),
    ]);
    setDocs((d as CaseDocument[]) ?? []);
    setCases((c as Diary[]) ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = async (file: File) => {
    if (!user) return;
    setIsUploading(true);
    const key = `${user.id}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(key, file);

    if (uploadError) {
      setIsUploading(false);
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      return;
    }

    // OCR / text extraction is a planned addition — ocr_text stays empty for now.
    const { error } = await supabase.from('documents').insert({
      owner_id: user.id,
      diary_id: diaryId === 'none' ? null : diaryId,
      category,
      file_name: file.name,
      storage_key: key,
      mime_type: file.type || null,
      file_size: file.size,
    });

    setIsUploading(false);
    if (error) {
      toast({ title: 'Could not save document', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Document stored', description: file.name });
    load();
  };

  const openDoc = async (doc: CaseDocument) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.storage_key, 60);
    if (error || !data) {
      toast({ title: 'Could not open file', variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const removeDoc = async (doc: CaseDocument) => {
    await supabase.storage.from(BUCKET).remove([doc.storage_key]);
    await supabase.from('documents').delete().eq('id', doc.id);
    load();
  };

  const saveNote = async (doc: CaseDocument, notes: string) => {
    await supabase.from('documents').update({ notes }).eq('id', doc.id);
  };

  const q = query.trim().toLowerCase();
  const visible = docs.filter((d) => {
    const matchesCategory = activeCategory === 'all' || d.category === activeCategory;
    const matchesQuery =
      !q ||
      d.file_name.toLowerCase().includes(q) ||
      (d.ocr_text ?? '').toLowerCase().includes(q) ||
      (d.notes ?? '').toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="min-h-screen bg-background legal-pattern pb-16">
      <Header />
      <main className="container max-w-3xl py-6">
        <h1 className="font-serif text-2xl font-bold mb-1">Legal Vault</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Private document storage. Full-text search across extracted text is coming soon.
        </p>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search filenames, notes and extracted text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-secondary/50"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {DOCUMENT_CATEGORIES.map((c) => {
            const count = docs.filter((d) => d.category === c.value).length;
            const isActive = activeCategory === c.value;
            return (
              <button
                key={c.value}
                onClick={() => setActiveCategory(isActive ? 'all' : c.value)}
                className={cn(
                  'rounded-xl border p-3 text-left transition-colors',
                  isActive
                    ? 'border-primary bg-primary/15'
                    : 'border-border/60 bg-card/60 hover:border-primary/40',
                )}
              >
                <FolderLock className="h-4 w-4 text-primary mb-2" />
                <p className="text-sm font-medium leading-tight">{c.label}</p>
                <p className="text-xs text-muted-foreground">{count} files</p>
              </button>
            );
          })}
        </div>

        <Card className="glass-effect border-primary/20 mb-6">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Upload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={diaryId} onValueChange={setDiaryId}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue placeholder="Attach to case" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No case</SelectItem>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.case_type} {c.case_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = '';
              }}
            />
            <Button
              onClick={() => fileInput.current?.click()}
              disabled={isUploading}
              className="w-full gold-gradient text-primary-foreground"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" /> Choose file
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : visible.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">No documents found.</p>
        ) : (
          <ul className="space-y-3">
            {visible.map((doc) => (
              <li key={doc.id}>
                <Card className="border-border/60 bg-card/70">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-3 min-w-0">
                        <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{doc.file_name}</p>
                          <Badge variant="outline" className="mt-1 text-[10px] border-primary/30">
                            {DOCUMENT_CATEGORIES.find((c) => c.value === doc.category)?.label}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => openDoc(doc)} aria-label="Open">
                          <Download className="h-4 w-4" />
                        </Button>
                        {doc.owner_id === user?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="hover:text-destructive"
                            onClick={() => removeDoc(doc)}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <Textarea
                      rows={2}
                      placeholder="Quick strategy note…"
                      defaultValue={doc.notes ?? ''}
                      onBlur={(e) => saveNote(doc, e.target.value)}
                      className="bg-secondary/40 text-sm"
                    />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
