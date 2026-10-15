import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Upload, Loader2, FileText, Download, Trash2, FolderLock, Camera, ScanLine, Lock, Settings2 } from 'lucide-react';
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
import { deleteDocumentFromR2, openDocumentFromR2, uploadDocumentToR2 } from '@/lib/r2';
import { pickImageFromCamera, isNative } from '@/lib/native';
import { DOCUMENT_CATEGORIES, type CaseDocument, type DocumentCategory, type Diary } from '@/types';
import { DocumentScanner } from '@/components/vault/DocumentScanner';
import { VaultAuthGate } from '@/components/vault/VaultAuthGate';
import { useVaultAuth } from '@/hooks/useVaultAuth';

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
  const [isScanning, setIsScanning] = useState(false);

  // ── Multi-page web scanner ──────────────────────────────────────────────────
  const [scannerOpen, setScannerOpen] = useState(false);

  // ── Vault biometric / PIN authentication ────────────────────────────────────
  const vaultAuth = useVaultAuth();
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [authGateMode, setAuthGateMode] = useState<'verify' | 'register'>('verify');
  // Doc pending auth — stored so we can open it after successful verification
  const pendingDoc = useRef<CaseDocument | null>(null);

  const handleCameraScan = async () => {
    setIsScanning(true);
    try {
      const file = await pickImageFromCamera();
      if (file) await handleUpload(file);
    } catch (error) {
      toast({
        title: 'Camera scan failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  };

  /** Called by the web DocumentScanner component with the merged PDF. */
  const handleScanComplete = async (file: File) => {
    await handleUpload(file);
  };

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
    if (!user) throw new Error('Please sign in again before uploading a document.');
    setIsUploading(true);
    let key: string;
    try {
      try {
        ({ key } = await uploadDocumentToR2(file));
      } catch (uploadError) {
      toast({
        title: 'Upload failed',
        description: uploadError instanceof Error ? uploadError.message : 'Could not upload the file.',
        variant: 'destructive',
      });
        throw uploadError instanceof Error ? uploadError : new Error('Could not upload the file.');
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

    if (error) {
      toast({ title: 'Could not save document', description: error.message, variant: 'destructive' });
      throw new Error(error.message);
    }
    toast({ title: 'Document stored', description: file.name });
    await load();
      return true;
    } finally {
      setIsUploading(false);
    }
  };

  const openDoc = async (doc: CaseDocument) => {
    // Protected documents (client_evidence, filed_plaints) require vault authentication
    const isProtected = (doc as CaseDocument & { security_level?: string }).security_level === 'protected'
      || doc.category === 'client_evidence'
      || doc.category === 'filed_plaints';

    if (isProtected && !vaultAuth.isUnlocked) {
      // No credentials set up yet — prompt user to register
      if (!vaultAuth.hasCredentials && !vaultAuth.hasPin) {
        pendingDoc.current = doc;
        setAuthGateMode('register');
        setAuthGateOpen(true);
        return;
      }
      // Try silent biometric first; if it fails, show the gate dialog
      pendingDoc.current = doc;
      const unlocked = await vaultAuth.unlockVault();
      if (!unlocked) {
        setAuthGateMode('verify');
        setAuthGateOpen(true);
        return;
      }
    }

    // Open the document (either not protected, or already unlocked)
    try {
      await openDocumentFromR2(doc.storage_key);
    } catch (error) {
      toast({
        title: 'Could not open file',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  /** Called by VaultAuthGate when the user successfully authenticates. */
  const handleVaultAuthenticated = async () => {
    setAuthGateOpen(false);
    const doc = pendingDoc.current;
    pendingDoc.current = null;
    if (doc) {
      try {
        await openDocumentFromR2(doc.storage_key);
      } catch (error) {
        toast({
          title: 'Could not open file',
          description: error instanceof Error ? error.message : undefined,
          variant: 'destructive',
        });
      }
    }
  };

  const removeDoc = async (doc: CaseDocument) => {
    try {
      await deleteDocumentFromR2(doc.storage_key);
    } catch (error) {
      toast({
        title: 'Could not delete file',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
      return;
    }
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
                if (file) void handleUpload(file).catch(() => undefined);
                e.target.value = '';
              }}
            />
            <Button
              onClick={() => fileInput.current?.click()}
              disabled={isUploading || isScanning}
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

            {/* Multi-page web scanner — available on all plans, all platforms */}
            <Button
              variant="outline"
              onClick={() => setScannerOpen(true)}
              disabled={isUploading || isScanning}
              className="w-full border-primary/40 hover:border-primary"
            >
              <ScanLine className="mr-2 h-4 w-4 text-primary" />
              Scan Multi-Page Document
            </Button>

            {/* Native single-shot camera (Capacitor only) */}
            {isNative && (
              <Button
                variant="outline"
                onClick={handleCameraScan}
                disabled={isUploading || isScanning}
                className="w-full"
              >
                {isScanning ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="mr-2 h-4 w-4" />
                )}
                Quick Scan (1 page)
              </Button>
            )}

            {/* Vault security setup shortcut */}
            {!vaultAuth.hasCredentials && !vaultAuth.hasPin && (
              <button
                onClick={() => { setAuthGateMode('register'); setAuthGateOpen(true); }}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Lock className="h-3 w-3" />
                Set up biometric protection for sensitive documents
              </button>
            )}
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
            {visible.map((doc) => {
              const isProtected = doc.category === 'client_evidence' || doc.category === 'filed_plaints';
              return (
                <li key={doc.id}>
                  <Card className="border-border/60 bg-card/70">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-3 min-w-0">
                          <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{doc.file_name}</p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <Badge variant="outline" className="text-[10px] border-primary/30">
                                {DOCUMENT_CATEGORIES.find((c) => c.value === doc.category)?.label}
                              </Badge>
                              {isProtected && (
                                <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400 gap-1">
                                  <Lock className="h-2.5 w-2.5" /> Protected
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => openDoc(doc)} aria-label="Open">
                            {isProtected && !vaultAuth.isUnlocked
                              ? <Lock className="h-4 w-4 text-amber-400" />
                              : <Download className="h-4 w-4" />}
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
              );
            })}
          </ul>
        )}
      </main>

      {/* ── Multi-page document scanner overlay ── */}
      <DocumentScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanComplete={handleScanComplete}
        onError={(msg) => toast({ title: 'Scanner error', description: msg, variant: 'destructive' })}
      />

      {/* ── Vault authentication gate (biometric / PIN) ── */}
      <VaultAuthGate
        open={authGateOpen}
        mode={authGateMode}
        auth={vaultAuth}
        onAuthenticated={handleVaultAuthenticated}
        onCancel={() => { setAuthGateOpen(false); pendingDoc.current = null; }}
      />
    </div>
  );
}

