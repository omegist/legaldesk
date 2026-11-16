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
  /** 'new' = BNSS/BNS (cases from 1 July 2024+); 'old' = Cr.P.C./IPC (legacy). */
  lawRegime: 'new' | 'old';
}

export function generateBailApplication(d: BailApplicationData, logoUrl?: string | null): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const offset = addLogo(doc, logoUrl);

  const subtitle =
    d.lawRegime === 'new'
      ? 'Under Section 480/483 BNSS, 2023 (Bharatiya Nagarik Suraksha Sanhita)'
      : 'Under Section 437/439 Cr.P.C. (for matters before 1 July 2024)';

  let y = header(doc, 'APPLICATION FOR BAIL', subtitle, offset);

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
  deponent_father_name?: string;
  deponent_relation?: string;
  deponent_age: string;
  deponent_address: string;
  deponent_occupation: string;
  deponent_id_proof?: string;
  statements: string;
  court_name?: string;
  case_number?: string;
  case_title?: string;
  /** Court affidavits use plain A4. The private option leaves unprinted space for genuine official stamping when required. */
  paper_mode?: 'court' | 'stamp-paper';
  advocate_name?: string;
  advocate_enrollment?: string;
  include_vernacular_clause?: boolean;
  vernacular_language?: string;
  place: string;
  date: string;
}

/**
 * Court-ready affidavit on plain A4 paper.
 * This intentionally never reproduces, scans, or imitates a stamp paper, e-SBTR,
 * franking impression, government seal, or notarial seal. For a private document
 * that an authorised provider says needs physical stamping, the optional layout
 * leaves a blank top area on the first page only.
 */
export function generateAffidavit(d: AffidavitData, logoUrl?: string | null): Blob {
  const W = 210;
  const H = 297;
  // Court-compliant margins: 38 mm left (for file binding/punching), 20 mm others
  const ML = 38;
  const MR = 20;
  const MT = 20;
  const printW = W - ML - MR;
  const pageBottom = H - 20;
  const lineHeight = 1.45;       // court-standard line spacing
  const bodySize = 11;
  const lineStep = bodySize * 0.3528 * lineHeight; // pt→mm × spacing ≈ 5.63 mm
  const textDark: [number, number, number] = [0, 0, 0];
  const textGray: [number, number, number] = [70, 70, 70];
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const isStampPaperLayout = d.paper_mode === 'stamp-paper';
  let y = isStampPaperLayout ? 102 : MT;

  const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(d.date || '')
    ? new Date(`${d.date}T00:00:00Z`).toLocaleDateString('en-GB', {
      timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
    })
    : d.date || '____________________';
  const placeStr = d.place || '____________________';
  const rawStatements = (d.statements || '').trim();
  const paragraphs = rawStatements
    ? rawStatements.split(/\n/).filter((line) => line.trim())
    : ['That I am the deponent herein and am well conversant with the facts stated herein.'];

  const startContinuationPage = () => {
    doc.addPage('a4');
    y = MT;
    doc.setFont('times', 'normal');
    doc.setFontSize(bodySize);
    doc.setTextColor(...textDark);
  };

  // ── Fix #1: Strip duplicate "IN THE COURT OF" from user input ─────────────
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...textDark);
  if (d.court_name) {
    const cleanCourt = d.court_name.replace(/^in\s+the\s+court\s+of\s+/i, '').trim();
    doc.text(`IN THE COURT OF ${cleanCourt.toUpperCase()}`, W / 2, y, { align: 'center' });
    y += 7;
  }
  if (d.case_number) {
    doc.setFont('times', 'normal');
    doc.setFontSize(bodySize);
    doc.text(d.case_number, W / 2, y, { align: 'center' });
    y += 7;
  }
  if (d.case_title) {
    doc.setFont('times', 'normal');
    doc.setFontSize(bodySize);
    const caseLines = doc.splitTextToSize(d.case_title, printW);
    doc.text(caseLines, W / 2, y, { align: 'center' });
    y += caseLines.length * lineStep + 5;
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.text('AFFIDAVIT', W / 2, y, { align: 'center' });
  y += 11;

  // ── Deponent introduction ─────────────────────────────────────────────────
  doc.setFont('times', 'normal');
  doc.setFontSize(bodySize);
  const relation = d.deponent_father_name
    ? `, ${d.deponent_relation || 'son/daughter/spouse'} of ${d.deponent_father_name}`
    : '';
  // Fix #3: Append ID proof after occupation if provided
  const idSuffix = d.deponent_id_proof?.trim()
    ? `, holding ${d.deponent_id_proof.trim()},`
    : '';
  const intro = `I, ${d.deponent_name || '____________________________'}${relation}, aged about ${d.deponent_age || '____'} years, occupation ${d.deponent_occupation || '________________'}${idSuffix}, residing at ${d.deponent_address || '____________________________________________'}, do hereby solemnly affirm and state as follows:`;
  const introLines = doc.splitTextToSize(intro, printW);
  doc.text(introLines, ML, y);
  y += introLines.length * lineStep + 8;

  // ── Numbered statements ───────────────────────────────────────────────────
  const paragraphIndent = 10;
  for (let index = 0; index < paragraphs.length; index += 1) {
    let statement = paragraphs[index].trim().replace(/^\d+[.)\s]+/, '');
    if (!/^that\s/i.test(statement)) statement = `That ${statement}`;
    const statementLines = doc.splitTextToSize(statement, printW - paragraphIndent);
    if (y + statementLines.length * lineStep + 8 > pageBottom - 70) startContinuationPage();
    doc.setFont('times', 'normal');
    doc.setFontSize(bodySize);
    doc.text(`${index + 1}.`, ML, y);
    doc.text(statementLines, ML + paragraphIndent, y);
    y += statementLines.length * lineStep + 5;
  }

  // ── Verification ──────────────────────────────────────────────────────────
  // Verification, signing, advocate ID, vernacular clause and jurat need ~120 mm
  if (y > pageBottom - 125) startContinuationPage();
  y += 6;
  doc.setFont('times', 'bold');
  doc.setFontSize(bodySize);
  doc.text('VERIFICATION', ML, y);
  y += 7;
  doc.setFont('times', 'normal');
  const verification = `Verified at ${placeStr} on ${dateStr} that the statements in paragraphs 1 to ${paragraphs.length} are true to my personal knowledge, except where stated to be based on information or belief, which I believe to be true.`;
  const verificationLines = doc.splitTextToSize(verification, printW);
  doc.text(verificationLines, ML, y);
  y += verificationLines.length * lineStep + 15;

  // ── Signature area ────────────────────────────────────────────────────────
  doc.setFontSize(10);
  doc.setTextColor(...textGray);
  doc.text(`Place: ${placeStr}`, ML, y);
  doc.text(`Date: ${dateStr}`, ML, y + 6);

  doc.setFont('times', 'bold');
  doc.setFontSize(bodySize);
  doc.setTextColor(...textDark);
  doc.text('DEPONENT', W - MR, y, { align: 'right' });
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text(`(${d.deponent_name || '____________________________'})`, W - MR, y + 6, { align: 'right' });

  // ── Fix #4: "Identified by Advocate" block (bottom-left) ──────────────────
  y += 24;
  if (d.advocate_name?.trim()) {
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...textDark);
    doc.text('Identified by me:', ML, y);
    y += 12;
    doc.setFont('times', 'bold');
    doc.text(d.advocate_name.trim(), ML, y);
    y += 5;
    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...textGray);
    const enrollText = d.advocate_enrollment?.trim()
      ? `Advocate (Reg. No: ${d.advocate_enrollment.trim()})`
      : 'Advocate';
    doc.text(enrollText, ML, y);
    y += 10;
  } else {
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...textGray);
    doc.text('Identified by me:', ML, y);
    y += 12;
    doc.text('______________________________', ML, y);
    doc.text('Advocate (Reg. No: __________)', ML, y + 5);
    y += 15;
  }

  // ── Jurat ─────────────────────────────────────────────────────────────────
  y += 4;
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...textDark);
  const jurat = `Solemnly affirmed at ${placeStr} on ${dateStr} by the above-named deponent before the undersigned authorised officer.`;
  const juratLines = doc.splitTextToSize(jurat, printW);
  doc.text(juratLines, ML, y);
  y += juratLines.length * 5 + 6;

  // ── Fix #5: Vernacular explanation clause ──────────────────────────────────
  if (d.include_vernacular_clause) {
    const lang = d.vernacular_language?.trim() || 'Marathi/vernacular';
    const vernacularText = `The contents of this affidavit have been read over, explained, and interpreted in ${lang} language to the Deponent, who appeared to understand the same and affixed his/her signature/thumb impression in my presence.`;
    const vernLines = doc.splitTextToSize(vernacularText, printW);
    if (y + vernLines.length * 5 + 10 > pageBottom - 30) startContinuationPage();
    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...textDark);
    doc.text(vernLines, ML, y);
    y += vernLines.length * 5 + 8;
  }

  // ── Authorised Officer seal area ──────────────────────────────────────────
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(...textGray);
  doc.setFont('times', 'normal');
  doc.text('Signature and seal of authorised officer', W - MR, y, { align: 'right' });
  doc.text('(Complete designation as applicable)', W - MR, y + 5, { align: 'right' });

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFontSize(7);
  const footer = isStampPaperLayout
    ? 'DRAFT ONLY. The blank top area is not a stamp. Use only a genuine official stamp, franking or e-SBTR if required and confirmed by the authorised provider.'
    : 'DRAFT ONLY. Confirm the required execution and attestation procedure with the filing court or authorised officer before use.';
  const footerLines = doc.splitTextToSize(footer, printW);
  doc.text(footerLines, ML, H - 17);
  doc.text('Generated via VakilDesk — for advocate review before filing.', W / 2, H - 9, { align: 'center' });

  return doc.output('blob');
}
