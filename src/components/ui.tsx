// Small shared pieces in the VisionPitts style.
import type { ReactNode } from 'react';
import { cx } from '../lib/format';

export function Badge({ children, tone = 'violet' }: { children: ReactNode; tone?: 'violet' | 'amber' | 'emerald' }) {
  const t = { violet: 'bg-violet-50 text-violet-700 ring-violet-200', amber: 'bg-amber-50 text-amber-800 ring-amber-200', emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80' }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold ring-1', t)}>{children}</span>;
}
