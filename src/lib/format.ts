import type { FieldFormat } from './types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "October 5, 2026" from "2026-10-05" (no time zone drift: the date is read as written). */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
/** "OCT 05 2026" for postmarks. */
export function stampDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${MONTHS[Number(m) - 1].slice(0, 3).toUpperCase()} ${d} ${y}`;
}

/** 39.9526°N 75.1652°W */
export function coords(lat: number, lng: number, digits = 4): string {
  return `${Math.abs(lat).toFixed(digits)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lng).toFixed(digits)}°${lng >= 0 ? 'E' : 'W'}`;
}

export function bytes(n?: number): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}

export function formatValue(v: unknown, f: FieldFormat = 'text'): string {
  if (v == null || v === '') return '—';
  if (typeof v !== 'number') return String(v);
  if (!Number.isFinite(v)) return '—';
  switch (f) {
    case 'money':
      return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    case 'percent':
      return `${(v * 100).toFixed(1)}%`;
    case 'percent100':
      return `${v.toFixed(1)}%`;
    case 'year':
      return String(Math.round(v));
    case 'decimal':
      return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
    case 'number':
      return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
    default:
      return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
}
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
