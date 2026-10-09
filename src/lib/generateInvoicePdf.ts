import jsPDF from 'jspdf';

interface InvoiceData {
  invoice_number: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  description: string;
  amount: number;
  gst_applicable: boolean;
  gst_rate: number;
  gst_amount: number;
  total_amount: number;
  issue_date: string;
  due_date: string | null;
  notes: string | null;
}

interface LawyerInfo {
  name: string;
  email: string;
  phone: string | null;
  practice_area?: string | null;
  court_name?: string | null;
  firm_logo_url?: string | null;
}

// Builds a clean, simple A4 invoice PDF — gold accent to match your brand,
// no external fonts/images needed so this works reliably offline too.
export function generateInvoicePdf(invoice: InvoiceData, lawyer: LawyerInfo): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const gold: [number, number, number] = [217, 164, 74];
  const dark: [number, number, number] = [30, 30, 30];
  const gray: [number, number, number] = [120, 120, 120];
  const marginX = 20;
  let y = 20;

  // Firm logo (if provided)
  if (lawyer.firm_logo_url) {
    try {
      doc.addImage(lawyer.firm_logo_url, 'PNG', marginX, y, 30, 12, undefined, 'FAST');
      y += 16;
    } catch {
      // logo failed to load — fall through to text header
    }
  }

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...dark);
  doc.text('VakilDesk', marginX, y);
  doc.setFontSize(10);
  doc.setTextColor(...gray);
  doc.setFont('helvetica', 'normal');
  doc.text('Invoice', marginX, y + 6);

  doc.setTextColor(...gold);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`#${invoice.invoice_number}`, 190, y, { align: 'right' });
  y += 16;

  doc.setDrawColor(...gold);
  doc.setLineWidth(0.5);
  doc.line(marginX, y, 190, y);
  y += 10;

  // Biller / Client columns
  doc.setFontSize(10);
  doc.setTextColor(...dark);
  doc.setFont('helvetica', 'bold');
  doc.text('From', marginX, y);
  doc.text('Bill To', 110, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gray);
  const fromLines = [lawyer.name, lawyer.email, lawyer.phone || ''].filter(Boolean);
  const toLines = [invoice.client_name, invoice.client_email || '', invoice.client_phone || ''].filter(Boolean);
  fromLines.forEach((line, i) => doc.text(line, marginX, y + i * 5));
  toLines.forEach((line, i) => doc.text(line, 110, y + i * 5));
  y += Math.max(fromLines.length, toLines.length) * 5 + 10;

  // Dates
  doc.setTextColor(...dark);
  doc.text(`Issue date: ${formatDate(invoice.issue_date)}`, marginX, y);
  if (invoice.due_date) {
    doc.text(`Due date: ${formatDate(invoice.due_date)}`, 110, y);
  }
  y += 12;

  // Line item table
  doc.setFillColor(245, 245, 245);
  doc.rect(marginX, y, 170, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Description', marginX + 2, y + 5.5);
  doc.text('Amount', 188, y + 5.5, { align: 'right' });
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const descLines = doc.splitTextToSize(invoice.description, 130);
  doc.text(descLines, marginX + 2, y);
  doc.text(`Rs. ${invoice.amount.toFixed(2)}`, 188, y, { align: 'right' });
  y += descLines.length * 5 + 8;

  doc.setDrawColor(220, 220, 220);
  doc.line(marginX, y, 190, y);
  y += 8;

  if (invoice.gst_applicable) {
    doc.setTextColor(...gray);
    doc.text(`GST (${invoice.gst_rate}%)`, marginX + 2, y);
    doc.text(`Rs. ${invoice.gst_amount.toFixed(2)}`, 188, y, { align: 'right' });
    y += 8;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...dark);
  doc.text('Total', marginX + 2, y);
  doc.text(`Rs. ${invoice.total_amount.toFixed(2)}`, 188, y, { align: 'right' });
  y += 14;

  if (invoice.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    doc.text('Notes', marginX, y);
    y += 5;
    const noteLines = doc.splitTextToSize(invoice.notes, 170);
    doc.text(noteLines, marginX, y);
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text('Generated via VakilDesk', marginX, 285);

  return doc.output('blob');
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}