import { useState } from 'react';
import { Download, FileText, ScrollText, Scale, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
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

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

const today = new Date().toISOString().slice(0, 10);

export default function Templates() {
  const { profile } = useAuth();

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
  const [bail, setBail] = useState<BailApplicationData>({
    court_name: '', case_type: 'Bail Application', case_number: '', year: new Date().getFullYear().toString(),
    accused_name: '', accused_address: '', offence: '', fir_number: '', police_station: '',
    arrest_date: '', grounds: '', surety_name: '', surety_address: '',
    advocate_name: profile?.name ?? '', advocate_enrollment: '', date: today, place: profile?.city ?? '',
  });

  // ── Affidavit ──
  const [aff, setAff] = useState<AffidavitData>({
    deponent_name: '', deponent_age: '', deponent_address: '', deponent_occupation: '',
    statements: '', place: profile?.city ?? '', date: today,
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
                <Button className="w-full gold-gradient text-primary-foreground" onClick={() => download(generateVakalatnama(vak, profile?.firm_logo_url), 'Vakalatnama.pdf')}>
                  <Download className="mr-2 h-4 w-4" /> Download PDF
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
                <Button className="w-full gold-gradient text-primary-foreground" onClick={() => download(generateLegalNotice(notice, profile?.firm_logo_url), 'Legal-Notice.pdf')}>
                  <Download className="mr-2 h-4 w-4" /> Download PDF
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── BAIL APPLICATION ── */}
          <TabsContent value="bail">
            <Card className="glass-effect border-primary/20">
              <CardHeader><CardTitle className="font-serif text-lg">Bail Application</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <F label="Court Name" id="b-court" value={bail.court_name} onChange={b('court_name')} placeholder="e.g. Sessions Court, Mumbai" />
                <div className="grid grid-cols-3 gap-3">
                  <F label="Case Type" id="b-ct" value={bail.case_type} onChange={b('case_type')} />
                  <F label="Case No." id="b-cn" value={bail.case_number} onChange={b('case_number')} />
                  <F label="Year" id="b-yr" value={bail.year} onChange={b('year')} />
                </div>
                <F label="Accused Name" id="b-an" value={bail.accused_name} onChange={b('accused_name')} />
                <TA label="Accused Address" id="b-aa" value={bail.accused_address} onChange={b('accused_address')} />
                <F label="Offence / Sections" id="b-off" value={bail.offence} onChange={b('offence')} placeholder="e.g. IPC 302, 307" />
                <div className="grid grid-cols-2 gap-3">
                  <F label="FIR Number" id="b-fir" value={bail.fir_number} onChange={b('fir_number')} />
                  <F label="Police Station" id="b-ps" value={bail.police_station} onChange={b('police_station')} />
                </div>
                <F label="Date of Arrest" id="b-ad" value={bail.arrest_date} onChange={b('arrest_date')} type="date" />
                <TA label="Grounds for Bail" id="b-gr" value={bail.grounds} onChange={b('grounds')} placeholder="1. The accused is not a flight risk...\n2. ..." />
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
                <Button className="w-full gold-gradient text-primary-foreground" onClick={() => download(generateBailApplication(bail, profile?.firm_logo_url), 'Bail-Application.pdf')}>
                  <Download className="mr-2 h-4 w-4" /> Download PDF
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── AFFIDAVIT ── */}
          <TabsContent value="affidavit">
            <Card className="glass-effect border-primary/20">
              <CardHeader>
                <CardTitle className="font-serif text-lg">Affidavit</CardTitle>
                <p className="text-xs text-amber-400 mt-1">⚠ Draft only — must be executed on stamp paper before a Notary.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <F label="Deponent Name" id="a-dn" value={aff.deponent_name} onChange={a('deponent_name')} />
                <div className="grid grid-cols-2 gap-3">
                  <F label="Age" id="a-age" value={aff.deponent_age} onChange={a('deponent_age')} type="number" />
                  <F label="Occupation" id="a-occ" value={aff.deponent_occupation} onChange={a('deponent_occupation')} />
                </div>
                <TA label="Deponent Address" id="a-addr" value={aff.deponent_address} onChange={a('deponent_address')} />
                <TA label="Statements / Declarations" id="a-stmt" value={aff.statements} onChange={a('statements')} placeholder="1. That I am the deponent herein...\n2. That..." />
                <div className="grid grid-cols-2 gap-3">
                  <F label="Date" id="a-dt" value={aff.date} onChange={a('date')} type="date" />
                  <F label="Place" id="a-pl" value={aff.place} onChange={a('place')} />
                </div>
                <Button className="w-full gold-gradient text-primary-foreground" onClick={() => download(generateAffidavit(aff, profile?.firm_logo_url), 'Affidavit-Draft.pdf')}>
                  <Download className="mr-2 h-4 w-4" /> Download Draft PDF
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
