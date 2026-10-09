import jsPDF from 'jspdf';

const gold: [number, number, number] = [217, 164, 74];
const dark: [number, number, number] = [30, 30, 30];
const gray: [number, number, number] = [110, 110, 110];
const M = 20;

function addLogo(doc: jsPDF, logoUrl?: string | null): number {
  if (!logoUrl) return 0;
  try {
    doc.addImage(logoUrl, 'PNG', M, 10, 30, 12, undefined, 'FAST');
    return 16;
  } catch {
    return 0;
  }
}

function header(doc: jsPDF, title: string, subtitle?: string, logoOffset = 0) {
  let y = 20 + logoOffset;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...dark);
  doc.text(title, 105, y, { align: 'center' });
  if (subtitle) {
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    doc.text(subtitle, 105, y, { align: 'center' });
  }
  y += 6;
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.5);
  doc.line(M, y, 190, y);
  return y + 8;
}

function field(doc: jsPDF, label: string, value: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.text(label.toUpperCase(), M, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...dark);
  const lines = doc.splitTextToSize(value || '___________________________', 170);
  doc.text(lines, M, y);
  return y + lines.length * 5 + 4;
}

function footer(doc: jsPDF, note?: string) {
  doc.setFontSize(7.5);
  doc.setTextColor(...gray);
  if (note) {
    const lines = doc.splitTextToSize(`NOTE: ${note}`, 170);
    doc.text(lines, M, 275);
  }
  doc.text('Generated via VakilDesk · For reference only — verify with your advocate before filing.', 105, 285, { align: 'center' });
}

// ─── 1. VAKALATNAMA ──────────────────────────────────────────────────────────
export interface VakalatData {
  court_name: string;
  case_type: string;
  case_number: string;
  year: string;
  petitioner: string;
  respondent: string;
  client_name: string;
  client_address: string;
  client_phone: string;
  advocate_name: string;
  advocate_enrollment: string;
  advocate_phone: string;
  date: string;
  place: string;
}

export function generateVakalatnama(d: VakalatData, logoUrl?: string | null): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const offset = addLogo(doc, logoUrl);
  let y = header(doc, 'VAKALATNAMA', undefined, offset);

  y = field(doc, 'In the Court of', d.court_name, y);
  y = field(doc, 'Case', `${d.case_type} No. ${d.case_number} / ${d.year}`, y);
  y = field(doc, 'Petitioner / Plaintiff', d.petitioner, y);
  y = field(doc, 'Respondent / Defendant', d.respondent, y);

  y += 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...dark);
  const body = `I, ${d.client_name}, resident of ${d.client_address}, do hereby appoint and retain ${d.advocate_name} (Enrolment No. ${d.advocate_enrollment}), Advocate, to act, appear and plead on my behalf in the above-mentioned case and in all proceedings connected therewith, and I hereby authorise the said Advocate to do all acts, deeds and things necessary for the conduct of the said case.`;
  const bodyLines = doc.splitTextToSize(body, 170);
  doc.text(bodyLines, M, y);
  y += bodyLines.length * 5 + 10;

  y = field(doc, 'Date', d.date, y);
  y = field(doc, 'Place', d.place, y);

  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.text('Signature of Client', M, y);
  doc.text('Signature of Advocate', 130, y);
  y += 5;
  doc.setTextColor(...dark);
  doc.text(d.client_name, M, y);
  doc.text(d.advocate_name, 130, y);
  doc.text(d.client_phone, M, y + 5);
  doc.text(d.advocate_phone, 130, y + 5);

  footer(doc);
  return doc.output('blob');
}

// ─── 2. LEGAL NOTICE ─────────────────────────────────────────────────────────
export interface LegalNoticeData {
  sender_name: string;
  sender_address: string;
  recipient_name: string;
  recipient_address: string;
  subject: string;
  facts: string;
  demand: string;
  notice_period_days: string;
  advocate_name: string;
  advocate_enrollment: string;
  advocate_phone: string;
  advocate_email: string;
  date: string;
  place: string;
}

export function generateLegalNotice(d: LegalNoticeData, logoUrl?: string | null): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const offset = addLogo(doc, logoUrl);
  let y = header(doc, 'LEGAL NOTICE', 'Without Prejudice', offset);

  y = field(doc, 'Date', `${d.date}, ${d.place}`, y);
  y = field(doc, 'To', `${d.recipient_name}\n${d.recipient_address}`, y);

  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...dark);
  doc.text(`Sub: ${d.subject}`, M, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const intro = `Under instructions from and on behalf of my client ${d.sender_name}, residing at ${d.sender_address}, I hereby serve upon you the following legal notice:`;
  const introLines = doc.splitTextToSize(intro, 170);
  doc.text(introLines, M, y);
  y += introLines.length * 5 + 5;

  const factsLines = doc.splitTextToSize(d.facts, 170);
  doc.text(factsLines, M, y);
  y += factsLines.length * 5 + 5;

  const demandText = `In view of the above, you are hereby called upon to ${d.demand} within ${d.notice_period_days} days from the receipt of this notice, failing which my client shall be constrained to initiate appropriate legal proceedings against you before the competent court of law, at your risk, cost and consequences.`;
  const demandLines = doc.splitTextToSize(demandText, 170);
  doc.text(demandLines, M, y);
  y += demandLines.length * 5 + 10;

  doc.setFont('helvetica', 'bold');
  doc.text(d.advocate_name, M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.text(`Enrolment No. ${d.advocate_enrollment}`, M, y + 5);
  doc.text(`${d.advocate_phone} · ${d.advocate_email}`, M, y + 10);

  footer(doc);
  return doc.output('blob');
}

// ─── 3. BAIL APPLICATION ─────────────────────────────────────────────────────
export interface BailApplicationData {
  court_name: string;
  case_type: string;
  case_number: string;
  year: string;
  accused_name: string;
  accused_address: string;
  offence: string;
  fir_number: string;
  police_station: string;
  arrest_date: string;
  grounds: string;
  surety_name: string;
  surety_address: string;
  advocate_name: string;
  advocate_enrollment: string;
  date: string;
  place: string;
}

export function generateBailApplication(d: BailApplicationData, logoUrl?: string | null): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const offset = addLogo(doc, logoUrl);
  let y = header(doc, 'APPLICATION FOR BAIL', 'Under Section 437/439 Cr.P.C.', offset);

  y = field(doc, 'In the Court of', d.court_name, y);
  y = field(doc, 'Case', `${d.case_type} No. ${d.case_number} / ${d.year}`, y);
  y = field(doc, 'FIR No. / Police Station', `${d.fir_number} · ${d.police_station}`, y);
  y = field(doc, 'Accused', `${d.accused_name}, ${d.accused_address}`, y);
  y = field(doc, 'Offence', d.offence, y);
  y = field(doc, 'Date of Arrest', d.arrest_date, y);

  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...dark);
  doc.text('GROUNDS FOR BAIL:', M, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  const groundLines = doc.splitTextToSize(d.grounds, 170);
  doc.text(groundLines, M, y);
  y += groundLines.length * 5 + 6;

  y = field(doc, 'Proposed Surety', `${d.surety_name}, ${d.surety_address}`, y);

  y += 4;
  const prayer = `It is, therefore, most respectfully prayed that this Hon'ble Court may be pleased to release the accused ${d.accused_name} on bail on such terms and conditions as this Hon'ble Court may deem fit and proper in the interest of justice.`;
  const prayerLines = doc.splitTextToSize(prayer, 170);
  doc.text(prayerLines, M, y);
  y += prayerLines.length * 5 + 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.text(`Place: ${d.place}`, M, y);
  doc.text(`Date: ${d.date}`, M, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...dark);
  doc.text(d.advocate_name, 130, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.text(`Enrolment No. ${d.advocate_enrollment}`, 130, y + 5);
  doc.text('Advocate for the Accused', 130, y + 10);

  footer(doc);
  return doc.output('blob');
}

// ─── 4. AFFIDAVIT ────────────────────────────────────────────────────────────
export interface AffidavitData {
  deponent_name: string;
  deponent_age: string;
  deponent_address: string;
  deponent_occupation: string;
  statements: string;
  place: string;
  date: string;
}

export function generateAffidavit(d: AffidavitData, logoUrl?: string | null): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const offset = addLogo(doc, logoUrl);
  let y = header(doc, 'AFFIDAVIT', '⚠ DRAFT ONLY — Must be executed on stamp paper before a Notary', offset);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...dark);

  const intro = `I, ${d.deponent_name}, aged ${d.deponent_age} years, ${d.deponent_occupation}, residing at ${d.deponent_address}, do hereby solemnly affirm and declare as under:`;
  const introLines = doc.splitTextToSize(intro, 170);
  doc.text(introLines, M, y);
  y += introLines.length * 5 + 8;

  const stmtLines = doc.splitTextToSize(d.statements, 170);
  doc.text(stmtLines, M, y);
  y += stmtLines.length * 5 + 10;

  doc.text('I state that the contents of this affidavit are true and correct to the best of my knowledge and belief and nothing material has been concealed therefrom.', M, y);
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.text(`Verified at ${d.place} on ${d.date}.`, M, y);
  y += 10;
  doc.setTextColor(...dark);
  doc.text('DEPONENT', M, y);
  y += 12;
  doc.setTextColor(...gray);
  doc.text('Before me,', M, y);
  y += 6;
  doc.text('Notary / Oath Commissioner', M, y);

  footer(doc, 'This affidavit has no legal value until executed on non-judicial stamp paper of appropriate value and sworn before a Notary Public or Oath Commissioner.');
  return doc.output('blob');
}
