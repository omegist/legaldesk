import { useState } from 'react';
import { Download, FileText, ScrollText, Scale, BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { deliverFile } from '@/lib/fileExport';
import { saveGeneratedPdfToVault } from '@/lib/generatedDocuments';
import { cn } from '@/lib/utils';
import {
  generateVakalatnama, generateLegalNotice, generateBailApplication, generateAffidavit,
  type VakalatData, type LegalNoticeData, type BailApplicationData, type AffidavitData,
} from '@/lib/generateTemplatePdf';

function F({ label, id, value, onChange, placeholder, type = 'text' }: {
  label: string; id: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} className="bg-secondary/50" />
    </div>
  );
}

function TA({ label, id, value, onChange, placeholder }: {
  label: string; id: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} className="bg-secondary/50" />
    </div>
  );
}

const today = new Date().toISOString().slice(0, 10);

export default function Templates() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const download = async (blob: Blob, fileName: string) => {
    setIsExporting(true);
    let vaultSaveError: string | null = null;
    const isPaid = Boolean(profile && (
      profile.subscription_tier !== 'free'
      || (profile.firm_id && profile.firm_id !== user?.id)
    ));

    if (isPaid && user) {
      try {
        await saveGeneratedPdfToVault(blob, fileName, user.id);
      } catch (error) {
        vaultSaveError = error instanceof Error ? error.message : 'Could not save a copy in your Legal Vault.';
      }
    }

    try {
      await deliverFile(blob, fileName, 'Open or save document');
      if (vaultSaveError) {
        toast({
          title: 'PDF ready, but not saved to Vault',
          description: vaultSaveError,
          variant: 'destructive',
        });
      } else {
        toast({
          title: isPaid ? 'PDF saved to Legal Vault' : 'PDF ready',
          description: isPaid
            ? 'The PDF is in Legal Vault under Filed Plaints. Use the Android chooser to open or save a copy.'
            : 'Use the Android chooser to open or save your PDF.',
        });
      }
    } catch (error) {
      toast({
        title: 'Could not export PDF',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // ── Vakalatnama ──
  const [vak, setVak] = useState<VakalatData>({
    court_name: '', case_type: '', case_number: '', year: new Date().getFullYear().toString(),
    petitioner: '', respondent: '', client_name: '', client_address: '', client_phone: '',
    advocate_name: profile?.name ?? '', advocate_enrollment: '', advocate_phone: profile?.phone ?? '',
    date: today, place: profile?.city ?? '',
  });

  // ── Legal Notice ──
  const [notice, setNotice] = useState<LegalNoticeData>({
    sender_name: '', sender_address: '', recipient_name: '', recipient_address: '',
    subject: '', facts: '', demand: '', notice_period_days: '15',
    advocate_name: profile?.name ?? '', advocate_enrollment: '', advocate_phone: profile?.phone ?? '',
    advocate_email: profile?.email ?? '', date: today, place: profile?.city ?? '',
  });

  // ── Bail Application ──
  // Default to 'new' (BNSS) for cases registered on or after 1 July 2024
  const defaultRegime: 'new' | 'old' =
    new Date() >= new Date('2024-07-01') ? 'new' : 'old';
  const [bail, setBail] = useState<BailApplicationData>({
    court_name: '', case_type: 'Bail Application', case_number: '', year: new Date().getFullYear().toString(),
    accused_name: '', accused_address: '', offence: '', fir_number: '', police_station: '',
    arrest_date: '', grounds: '', surety_name: '', surety_address: '',
    advocate_name: profile?.name ?? '', advocate_enrollment: '', date: today, place: profile?.city ?? '',
    lawRegime: defaultRegime,
  });

  // ── Affidavit ──
  const [aff, setAff] = useState<AffidavitData>({
    deponent_name: '', deponent_father_name: '', deponent_relation: '', deponent_age: '', deponent_address: '', deponent_occupation: '',
    deponent_id_proof: '',
    statements: '', court_name: '', case_number: '', case_title: '', paper_mode: 'court',
    advocate_name: profile?.name ?? '', advocate_enrollment: '',
    include_vernacular_clause: false, vernacular_language: 'Marathi',
    place: profile?.city ?? '', date: today,
  });

  const v = <K extends keyof VakalatData>(k: K) => (val: string) => setVak((s) => ({ ...s, [k]: val }));
  const n = <K extends keyof LegalNoticeData>(k: K) => (val: string) => setNotice((s) => ({ ...s, [k]: val }));
  const b = <K extends keyof BailApplicationData>(k: K) => (val: string) => setBail((s) => ({ ...s, [k]: val }));
  const a = <K extends keyof AffidavitData>(k: K) => (val: string) => setAff((s) => ({ ...s, [k]: val }));

  return (
    <div className="min-h-screen bg-background legal-pattern pb-16">
      <Header />
      <main className="container max-w-2xl py-6 space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-bold">Document Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">Fill the form and download a ready-to-print PDF.</p>
        </div>

        <Tabs defaultValue="vakalatnama">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="vakalatnama" className="text-xs"><ScrollText className="h-3.5 w-3.5 mr-1" />Vakalatnama</TabsTrigger>
            <TabsTrigger value="notice" className="text-xs"><FileText className="h-3.5 w-3.5 mr-1" />Legal Notice</TabsTrigger>
            <TabsTrigger value="bail" className="text-xs"><Scale className="h-3.5 w-3.5 mr-1" />Bail App.</TabsTrigger>
            <TabsTrigger value="affidavit" className="text-xs"><BookOpen className="h-3.5 w-3.5 mr-1" />Affidavit</TabsTrigger>
          </TabsList>

          {/* ── VAKALATNAMA ── */}
          <TabsContent value="vakalatnama">
            <Card className="glass-effect border-primary/20">
              <CardHeader><CardTitle className="font-serif text-lg">Vakalatnama</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <F label="Court Name" id="v-court" value={vak.court_name} onChange={v('court_name')} placeholder="e.g. District Court, Pune" />
                <div className="grid grid-cols-3 gap-3">
                  <F label="Case Type" id="v-ct" value={vak.case_type} onChange={v('case_type')} placeholder="CPC / CrPC" />
                  <F label="Case No." id="v-cn" value={vak.case_number} onChange={v('case_number')} />
                  <F label="Year" id="v-yr" value={vak.year} onChange={v('year')} />
                </div>
                <F label="Petitioner / Plaintiff" id="v-pet" value={vak.petitioner} onChange={v('petitioner')} />
                <F label="Respondent / Defendant" id="v-res" value={vak.respondent} onChange={v('respondent')} />
                <F label="Client Name" id="v-cn2" value={vak.client_name} onChange={v('client_name')} />
                <TA label="Client Address" id="v-ca" value={vak.client_address} onChange={v('client_address')} />
                <F label="Client Phone" id="v-cp" value={vak.client_phone} onChange={v('client_phone')} />
                <div className="grid grid-cols-2 gap-3">
                  <F label="Advocate Name" id="v-an" value={vak.advocate_name} onChange={v('advocate_name')} />
                  <F label="Enrolment No." id="v-ae" value={vak.advocate_enrollment} onChange={v('advocate_enrollment')} />
                </div>
                <F label="Advocate Phone" id="v-ap" value={vak.advocate_phone} onChange={v('advocate_phone')} />
                <div className="grid grid-cols-2 gap-3">
                  <F label="Date" id="v-dt" value={vak.date} onChange={v('date')} type="date" />
                  <F label="Place" id="v-pl" value={vak.place} onChange={v('place')} />
                </div>
                <Button disabled={isExporting} className="w-full gold-gradient text-primary-foreground" onClick={() => void download(generateVakalatnama(vak, profile?.firm_logo_url), 'Vakalatnama.pdf')}>
                  {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Download PDF
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── LEGAL NOTICE ── */}
          <TabsContent value="notice">
            <Card className="glass-effect border-primary/20">
              <CardHeader><CardTitle className="font-serif text-lg">Legal Notice</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <F label="Sender (Your Client) Name" id="n-sn" value={notice.sender_name} onChange={n('sender_name')} />
                <TA label="Sender Address" id="n-sa" value={notice.sender_address} onChange={n('sender_address')} />
                <F label="Recipient Name" id="n-rn" value={notice.recipient_name} onChange={n('recipient_name')} />
                <TA label="Recipient Address" id="n-ra" value={notice.recipient_address} onChange={n('recipient_address')} />
                <F label="Subject" id="n-sub" value={notice.subject} onChange={n('subject')} placeholder="e.g. Recovery of dues" />
                <TA label="Facts of the case" id="n-facts" value={notice.facts} onChange={n('facts')} placeholder="State the facts chronologically..." />
                <TA label="Demand / Relief sought" id="n-dem" value={notice.demand} onChange={n('demand')} placeholder="e.g. pay the outstanding amount of ₹..." />
                <F label="Notice period (days)" id="n-np" value={notice.notice_period_days} onChange={n('notice_period_days')} type="number" />
                <div className="grid grid-cols-2 gap-3">
                  <F label="Advocate Name" id="n-an" value={notice.advocate_name} onChange={n('advocate_name')} />
                  <F label="Enrolment No." id="n-ae" value={notice.advocate_enrollment} onChange={n('advocate_enrollment')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Advocate Phone" id="n-ap" value={notice.advocate_phone} onChange={n('advocate_phone')} />
                  <F label="Advocate Email" id="n-aem" value={notice.advocate_email} onChange={n('advocate_email')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Date" id="n-dt" value={notice.date} onChange={n('date')} type="date" />
                  <F label="Place" id="n-pl" value={notice.place} onChange={n('place')} />
                </div>
                <Button disabled={isExporting} className="w-full gold-gradient text-primary-foreground" onClick={() => void download(generateLegalNotice(notice, profile?.firm_logo_url), 'Legal-Notice.pdf')}>
                  {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Download PDF
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── BAIL APPLICATION ── */}
          <TabsContent value="bail">
            <Card className="glass-effect border-primary/20">
              <CardHeader>
                <CardTitle className="font-serif text-lg">Bail Application</CardTitle>
                {/* Law-regime selector — drives the PDF header and placeholder text */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">Law regime:</span>
                  <button
                    type="button"
                    onClick={() => setBail((s) => ({ ...s, lawRegime: 'new' }))}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      bail.lawRegime === 'new'
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border/60 text-muted-foreground hover:border-primary/40',
                    )}
                  >
                    BNSS / BNS (2024+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBail((s) => ({ ...s, lawRegime: 'old' }))}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      bail.lawRegime === 'old'
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border/60 text-muted-foreground hover:border-primary/40',
                    )}
                  >
                    Cr.P.C. / IPC (pre-2024)
                  </button>
                </div>
                <p className="text-xs text-amber-400 mt-1">
                  ⚠ Draft only — must be reviewed by an advocate before filing.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <F label="Court Name" id="b-court" value={bail.court_name} onChange={b('court_name')} placeholder="e.g. Sessions Court, Mumbai" />
                <div className="grid grid-cols-3 gap-3">
                  <F label="Case Type" id="b-ct" value={bail.case_type} onChange={b('case_type')} />
                  <F label="Case No." id="b-cn" value={bail.case_number} onChange={b('case_number')} />
                  <F label="Year" id="b-yr" value={bail.year} onChange={b('year')} />
                </div>
                <F label="Accused Name" id="b-an" value={bail.accused_name} onChange={b('accused_name')} />
                <TA label="Accused Address" id="b-aa" value={bail.accused_address} onChange={b('accused_address')} />
                <F
                  label="Offence / Sections"
                  id="b-off"
                  value={bail.offence}
                  onChange={b('offence')}
                  placeholder={
                    bail.lawRegime === 'new'
                      ? 'e.g. BNS 103, 109 (formerly IPC 302, 307)'
                      : 'e.g. IPC 302, 307'
                  }
                />
                <div className="grid grid-cols-2 gap-3">
                  <F label="FIR Number" id="b-fir" value={bail.fir_number} onChange={b('fir_number')} />
                  <F label="Police Station" id="b-ps" value={bail.police_station} onChange={b('police_station')} />
                </div>
                <F label="Date of Arrest" id="b-ad" value={bail.arrest_date} onChange={b('arrest_date')} type="date" />
                <TA label="Grounds for Bail" id="b-gr" value={bail.grounds} onChange={b('grounds')} placeholder={"1. The accused is not a flight risk...\n2. ..."} />
                <F label="Surety Name" id="b-sn" value={bail.surety_name} onChange={b('surety_name')} />
                <TA label="Surety Address" id="b-sa" value={bail.surety_address} onChange={b('surety_address')} />
                <div className="grid grid-cols-2 gap-3">
                  <F label="Advocate Name" id="b-avn" value={bail.advocate_name} onChange={b('advocate_name')} />
                  <F label="Enrolment No." id="b-ave" value={bail.advocate_enrollment} onChange={b('advocate_enrollment')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Date" id="b-dt" value={bail.date} onChange={b('date')} type="date" />
                  <F label="Place" id="b-pl" value={bail.place} onChange={b('place')} />
                </div>
                <Button disabled={isExporting} className="w-full gold-gradient text-primary-foreground" onClick={() => void download(generateBailApplication(bail, profile?.firm_logo_url), 'Bail-Application.pdf')}>
                  {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Download PDF
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── AFFIDAVIT ── */}
          <TabsContent value="affidavit">
            <Card className="glass-effect border-primary/20">
              <CardHeader>
                <CardTitle className="font-serif text-lg">Affidavit</CardTitle>
                <p className="text-xs text-amber-400 mt-1">⚠ Draft only — have the filing court or authorised officer confirm the execution requirements before use.</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Generates a clean white A4 affidavit with court-compliant 38 mm left margin. It never reproduces a government stamp, e-SBTR, franking impression or notarial seal.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="a-paper-mode">Document use</Label>
                  <select
                    id="a-paper-mode"
                    value={aff.paper_mode ?? 'court'}
                    onChange={(e) => setAff((s) => ({ ...s, paper_mode: e.target.value as AffidavitData['paper_mode'] }))}
                    className="w-full rounded-md border border-border/60 bg-secondary/50 px-3 py-2 text-sm"
                  >
                    <option value="court">Court filing — plain A4 (recommended)</option>
                    <option value="stamp-paper">Private document — leave blank space for genuine stamping if instructed</option>
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    {aff.paper_mode === 'stamp-paper'
                      ? 'This leaves a 90 mm blank area at the top of page 1 only. It does not create a stamp or prove stamp duty has been paid.'
                      : 'Court mode has no fake stamp area and prints on plain white A4.'}
                  </p>
                </div>

                {/* Court / Case reference (optional) */}
                <div className="grid grid-cols-2 gap-3">
                  <F label="Court Name (optional)" id="a-court" value={aff.court_name ?? ''} onChange={a('court_name')} placeholder="e.g. Civil Judge Senior Division, Thane" />
                  <F label="Case No. (optional)" id="a-case" value={aff.case_number ?? ''} onChange={a('case_number')} placeholder="e.g. Special Civil Suit No. 412 of 2026" />
                </div>
                <TA label="Case Title / Parties (optional)" id="a-title" value={aff.case_title ?? ''} onChange={a('case_title')} placeholder={'e.g. Rajesh Kulkarni ... Plaintiff\nVersus\nABC Ltd. ... Defendant'} />

                {/* Deponent info */}
                <F label="Deponent Name" id="a-dn" value={aff.deponent_name} onChange={a('deponent_name')} />
                <div className="grid grid-cols-2 gap-3">
                  <F label="Parent / Spouse Name (optional)" id="a-fn" value={aff.deponent_father_name ?? ''} onChange={a('deponent_father_name')} />
                  <div className="space-y-1.5">
                    <Label htmlFor="a-relation">Relationship</Label>
                    <select
                      id="a-relation"
                      value={aff.deponent_relation ?? ''}
                      onChange={(e) => setAff((s) => ({ ...s, deponent_relation: e.target.value }))}
                      className="w-full rounded-md border border-border/60 bg-secondary/50 px-3 py-2 text-sm"
                    >
                      <option value="">Select if used</option>
                      <option value="son of">Son of</option>
                      <option value="daughter of">Daughter of</option>
                      <option value="wife of">Wife of</option>
                      <option value="husband of">Husband of</option>
                      <option value="child of">Child of</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <F label="Age" id="a-age" value={aff.deponent_age} onChange={a('deponent_age')} type="number" />
                  <F label="Occupation" id="a-occ" value={aff.deponent_occupation} onChange={a('deponent_occupation')} />
                </div>
                <F label="Deponent ID Proof (optional)" id="a-id" value={aff.deponent_id_proof ?? ''} onChange={a('deponent_id_proof')} placeholder="e.g. Aadhaar ending 4589 / PAN ABCPD1234E" />
                <TA label="Deponent Address" id="a-addr" value={aff.deponent_address} onChange={a('deponent_address')} />
                <TA label="Statements / Declarations (one per line)" id="a-stmt" value={aff.statements} onChange={a('statements')} placeholder={"I am the deponent herein and am well conversant with the facts.\nThe facts stated herein are true to the best of my knowledge.\nI have not concealed any material facts."} />
                <p className="-mt-1 text-[11px] text-muted-foreground">
                  For any statement based on information or belief, include its source in that statement.
                </p>

                {/* Advocate identification */}
                <div className="grid grid-cols-2 gap-3">
                  <F label="Identifying Advocate Name" id="a-adv" value={aff.advocate_name ?? ''} onChange={a('advocate_name')} placeholder={profile?.name ?? 'Advocate name'} />
                  <F label="Bar Enrollment No." id="a-enr" value={aff.advocate_enrollment ?? ''} onChange={a('advocate_enrollment')} placeholder="e.g. MAH/1234/2020" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <F label="Date" id="a-dt" value={aff.date} onChange={a('date')} type="date" />
                  <F label="Place" id="a-pl" value={aff.place} onChange={a('place')} />
                </div>

                {/* Vernacular explanation clause toggle */}
                <div className="flex items-start gap-2 pt-1">
                  <input
                    id="a-vernacular"
                    type="checkbox"
                    checked={aff.include_vernacular_clause ?? false}
                    onChange={(e) => setAff((s) => ({ ...s, include_vernacular_clause: e.target.checked }))}
                    className="mt-1 h-4 w-4 rounded border-border/60 accent-primary"
                  />
                  <div>
                    <Label htmlFor="a-vernacular" className="text-sm cursor-pointer">Include Vernacular Explanation Clause</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Adds a clause that the affidavit was read over and explained to the deponent in the specified language.
                    </p>
                  </div>
                </div>
                {aff.include_vernacular_clause && (
                  <F label="Vernacular Language" id="a-vern-lang" value={aff.vernacular_language ?? 'Marathi'} onChange={a('vernacular_language')} placeholder="e.g. Marathi, Hindi, Kannada" />
                )}

                <Button disabled={isExporting} className="w-full gold-gradient text-primary-foreground" onClick={() => void download(generateAffidavit(aff, profile?.firm_logo_url), 'Affidavit-Draft.pdf')}>
                  {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Download Draft PDF
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
