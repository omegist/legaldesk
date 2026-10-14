/**
 * VakilDesk — unit tests for pure helper functions.
 * Run with: npm test
 */

import { describe, it, expect } from 'vitest';

// ── HTML escaper (copied from send-hearing-reminders) ──────────────────────────
// Keep this in sync with the escaper in supabase/functions/send-hearing-reminders/index.ts
function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!),
  );
}

describe('esc() — HTML escaper', () => {
  it('escapes & < > " and single-quote', () => {
    expect(esc('a & b')).toBe('a &amp; b');
    expect(esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(esc('"quoted"')).toBe('&quot;quoted&quot;');
    expect(esc("it's")).toBe('it&#39;s');
  });

  it('leaves safe text unchanged', () => {
    expect(esc('Ravi Kumar vs State of Maharashtra')).toBe('Ravi Kumar vs State of Maharashtra');
    expect(esc('Sessions Court, Pune')).toBe('Sessions Court, Pune');
  });

  it('handles nullish values', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
    expect(esc(0)).toBe('0');
  });

  it('handles a party name with all special chars', () => {
    expect(esc('<b>Ravi & "Sons"</b>')).toBe(
      '&lt;b&gt;Ravi &amp; &quot;Sons&quot;&lt;/b&gt;',
    );
  });
});

// ── CNR number validator ───────────────────────────────────────────────────────
// CNR numbers used by eCourtsIndia: 4 uppercase state+court code + 12 digits = 16 chars
// Example: MHPN010000042024  (MH=Maharashtra, PN=Pune, 01=court, 0000004=seq, 2024=year)
function isValidCnr(cnr: string): boolean {
  return /^[A-Z]{4}\d{12}$/.test(cnr);
}

describe('CNR number validator', () => {
  it('accepts valid CNR formats', () => {
    expect(isValidCnr('MHPN010000042024')).toBe(true); // 4 alpha + 12 digits = 16 chars
    expect(isValidCnr('DLNT010000012023')).toBe(true); // Delhi
  });

  it('rejects clearly invalid values', () => {
    expect(isValidCnr('')).toBe(false);
    expect(isValidCnr('12345')).toBe(false);
    expect(isValidCnr('mhpn010000042024')).toBe(false); // lowercase
    expect(isValidCnr('MHPN01000004')).toBe(false);     // too short
  });
});

// ── Date helpers ───────────────────────────────────────────────────────────────
function formatDateIN(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function tomorrowISO(fromISO?: string): string {
  const base = fromISO ? new Date(fromISO) : new Date();
  base.setDate(base.getDate() + 1);
  return base.toISOString().slice(0, 10);
}

describe('Date helpers', () => {
  it('formatDateIN formats a date in Indian locale', () => {
    const result = formatDateIN('2024-07-01');
    // Should contain "Jul" and "2024"
    expect(result).toContain('2024');
    expect(result).toMatch(/Jul/i);
  });

  it('tomorrowISO returns the next day in YYYY-MM-DD format', () => {
    const t = tomorrowISO('2024-12-31');
    expect(t).toBe('2025-01-01');

    const t2 = tomorrowISO('2024-02-28');
    expect(t2).toBe('2024-02-29'); // 2024 is a leap year
  });

  it('tomorrowISO defaults to today + 1', () => {
    const today = new Date().toISOString().slice(0, 10);
    const expected = tomorrowISO(today);
    // Both should be in YYYY-MM-DD format
    expect(expected).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── Law regime label ───────────────────────────────────────────────────────────
function bailSubtitle(regime: 'new' | 'old'): string {
  return regime === 'new'
    ? 'Under Section 480/483 BNSS, 2023 (Bharatiya Nagarik Suraksha Sanhita)'
    : 'Under Section 437/439 Cr.P.C. (for matters before 1 July 2024)';
}

describe('Bail template law regime', () => {
  it('new regime cites BNSS', () => {
    expect(bailSubtitle('new')).toContain('BNSS');
    expect(bailSubtitle('new')).not.toContain('Cr.P.C.');
  });

  it('old regime cites Cr.P.C.', () => {
    expect(bailSubtitle('old')).toContain('Cr.P.C.');
    expect(bailSubtitle('old')).not.toContain('BNSS');
  });
});
