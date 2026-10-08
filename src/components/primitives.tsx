// Building blocks from VisionPitts (same author): springs, the fold button, the section disclosure, the switch,
// the floating left panel (Rail) and the floating right panel (PanelFrame).
import { useId, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { cx } from '../lib/format';

/** Panels opening and closing. */
export const SPRING_PANEL = { type: 'spring', stiffness: 360, damping: 30, mass: 0.85 } as const;
/** Small things (tabs, buttons, chevrons): snappier, a touch of bounce. */
export const SPRING_TAB = { type: 'spring', stiffness: 520, damping: 26, mass: 0.7 } as const;
/** Heights opening and closing: settles without overshooting. */
export const SPRING_FOLD = { type: 'spring', stiffness: 380, damping: 38, mass: 0.9 } as const;

/** A round button that folds something away; it leans into the press. */
export function FoldButton({ onClick, label, children }: { onClick: () => void; label: string; children: ReactNode }) {
  return (
    <motion.button type="button" onClick={onClick} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.88 }} transition={SPRING_TAB} className="rounded-lg p-1.5 text-slate-500 hover:bg-stone-100 hover:text-slate-900" aria-label={label} title={label}>
      {children}
    </motion.button>
  );
}

/** A collapsible card of the left panel, with a tinted title band. */
export function Section({ title, sub, children, defaultOpen = true }: { title: ReactNode; sub?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="rounded-xl bg-white ring-1 ring-violet-200/70">
      <div className={cx('flex items-center justify-between gap-2 rounded-xl bg-violet-50/80 px-3 py-2.5 transition-[border-radius]', open && 'rounded-b-none border-b border-violet-100')}>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="group flex min-w-0 flex-1 items-center gap-1.5 text-left text-body font-semibold text-violet-950">
          <motion.svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 transition-transform group-active:scale-75" initial={false} animate={{ rotate: open ? 90 : 0 }} transition={SPRING_TAB}>
            <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
          <span className="min-w-0">
            <span className="block">{title}</span>
            {sub && <span className="block text-caption font-normal text-violet-800/70">{sub}</span>}
          </span>
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={id} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0, transition: { ...SPRING_FOLD, opacity: { duration: 0.12 } } }} transition={SPRING_FOLD} className="overflow-hidden">
            <motion.div initial={{ y: -8 }} animate={{ y: 0 }} exit={{ y: -8 }} transition={SPRING_FOLD} className="px-3 pb-3 pt-2.5">
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Accessible toggle: a button with aria-pressed, a small track and knob, label and caption. */
export function Switch({ on, onChange, label, caption, right, disabled }: { on: boolean; onChange: (on: boolean) => void; label: ReactNode; caption?: ReactNode; right?: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on} disabled={disabled} onClick={() => onChange(!on)} className={cx('flex w-full items-start gap-3 rounded-xl bg-white px-3 py-2 text-left ring-1 transition', on ? 'ring-violet-200' : 'ring-stone-200/80 hover:ring-stone-300', disabled && 'cursor-not-allowed opacity-60')}>
      <span aria-hidden className={cx('relative mt-0.5 inline-block h-5 w-9 shrink-0 rounded-full transition-colors', on ? 'bg-violet-600' : 'bg-stone-300')}>
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', on ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-small font-semibold text-slate-900">{label}</span>
        {caption && <span className="block text-caption text-slate-600">{caption}</span>}
      </span>
      {right}
    </button>
  );
}

const PANEL = 'rounded-2xl bg-white/95 shadow-[0_10px_40px_-10px_rgba(15,23,42,0.25)] ring-1 ring-black/5 backdrop-blur';
const TAB = 'flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-small font-semibold text-slate-800 shadow-lg ring-1 ring-black/5 backdrop-blur hover:bg-white';

/** The floating left panel. Closed, it folds into a small tab in its own corner, growing out of it and back. */
export function Rail({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: (open: boolean) => void; children: ReactNode }) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {open ? (
        <motion.aside key="rail" style={{ transformOrigin: 'top left' }} initial={{ opacity: 0, scale: 0.9, x: -14, filter: 'blur(6px)' }} animate={{ opacity: 1, scale: 1, x: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 0.92, x: -14, filter: 'blur(6px)', transition: { duration: 0.18, ease: 'easeIn' } }} transition={SPRING_PANEL} className={cx('absolute left-3 top-16 z-20 flex max-h-[calc(100%-7.5rem)] w-[340px] flex-col xl:w-[360px] max-sm:right-3 max-sm:w-auto max-sm:!max-h-[38vh]', PANEL)} aria-label={title}>
          <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
            <div className="font-display text-body font-bold text-slate-900">{title}</div>
            <FoldButton onClick={() => onToggle(false)} label="Hide the panel">
              <PanelLeftClose className="h-4 w-4" />
            </FoldButton>
          </div>
          <div className="scroll-quiet min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 pb-3 pt-1">{children}</div>
        </motion.aside>
      ) : (
        <motion.div key="rail-tab" style={{ transformOrigin: 'top left' }} initial={{ opacity: 0, scale: 0.6, x: -8 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.12 } }} transition={SPRING_TAB} className="absolute left-3 top-16 z-20">
          <motion.button onClick={() => onToggle(true)} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }} transition={SPRING_TAB} className={TAB} aria-label="Show the panel" title="Show the panel">
            <PanelLeftOpen className="h-4 w-4 text-slate-600" />
            {title}
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The floating right panel, placed under the question box. Closed, it folds into a small tab. */
export function PanelFrame({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: (open: boolean) => void; children: ReactNode }) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {open ? (
        <motion.div key="panel" style={{ transformOrigin: 'top right' }} initial={{ opacity: 0, scale: 0.9, x: 14, filter: 'blur(6px)' }} animate={{ opacity: 1, scale: 1, x: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 0.92, x: 14, filter: 'blur(6px)', transition: { duration: 0.18, ease: 'easeIn' } }} transition={SPRING_PANEL} className={cx('pointer-events-auto relative flex min-h-0 w-full flex-1 flex-col', PANEL)} aria-label={title}>
          <motion.button onClick={() => onToggle(false)} whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }} transition={SPRING_TAB} className="absolute -left-3.5 top-3 z-20 grid h-7 w-7 place-items-center rounded-full bg-white text-slate-500 shadow-md ring-1 ring-black/10 hover:text-slate-900" aria-label="Hide the details" title="Hide the details">
            <PanelRightClose className="h-3.5 w-3.5" />
          </motion.button>
          <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto rounded-2xl">{children}</div>
        </motion.div>
      ) : (
        <motion.div key="panel-tab" style={{ transformOrigin: 'top right' }} initial={{ opacity: 0, scale: 0.6, x: 8 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.12 } }} transition={SPRING_TAB} className="pointer-events-auto">
          <motion.button onClick={() => onToggle(true)} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }} transition={SPRING_TAB} className={TAB} aria-label="Show the details" title="Show the details">
            {title}
            <PanelRightOpen className="h-4 w-4 text-slate-600" />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
