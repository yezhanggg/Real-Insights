// An async action button that morphs between idle, loading, success and error (21st.dev "Morph Button", Spectrum UI):
// the pill changes width to fit each state, with a turning arc while loading, a check that draws itself on success,
// and an X with a tight shake on error. It honors reduced motion and announces each state to screen readers.
// Changes: Motion instead of framer-motion; `type` so it can submit a form; the site's violet when idle; the content
// keeps its shape while the pill resizes (`layout="position"`); and `burst`, a ring of small dots thrown out on success.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

export type MorphButtonState = 'idle' | 'loading' | 'success' | 'error';

export interface MorphButtonProps {
  /** Idle content of the button, usually a short action label. */
  children: React.ReactNode;
  /** Async work to run on click when uncontrolled: loading while pending, success or error after, then back to idle. */
  onAction?: () => Promise<void> | void;
  /** Controlled state. When given, the button shows exactly this state. */
  state?: MorphButtonState;
  /** Click handler; fires on idle clicks in both modes. */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** `submit` inside a form: the form's onSubmit does the work and `state` reports it. */
  type?: 'button' | 'submit';
  loadingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  /** Milliseconds success/error is held before auto-resetting (uncontrolled). */
  resetDelay?: number;
  size?: 'sm' | 'md' | 'lg';
  /** Throw a ring of small dots out from the button when it reaches success. */
  burst?: boolean;
  /** Idle, the button spans its container; in the other states it shrinks to its content, centered. */
  block?: boolean;
  disabled?: boolean;
  className?: string;
}

const SPRING_SNAPPY = { type: 'spring', stiffness: 500, damping: 30 } as const;
const SPRING_SOFT = { type: 'spring', stiffness: 260, damping: 22 } as const;
const EASE_REVEAL: [number, number, number, number] = [0.22, 1, 0.36, 1];
const CONTENT_SHIFT = 8;
const CONTENT_DURATION = 0.3;
const DRAW_DURATION = 0.25;
const SHAKE_KEYFRAMES = [0, -3, 3, -2, 2, 0];
const SHAKE_DURATION = 0.25;
const SPIN_DURATION = 0.8;
const SPINNER_ARC = 0.75;
const SPINNER_RADIUS = 10;
const DEFAULT_RESET_DELAY = 1800;

const SIZES = {
  sm: { button: 'h-8 px-3 text-xs', content: 'gap-1.5', icon: 14 },
  md: { button: 'h-10 px-4 text-sm', content: 'gap-2', icon: 16 },
  lg: { button: 'h-12 px-6 text-sm', content: 'gap-2', icon: 18 },
} as const;

const CHECK_PATH = 'M5 13l4.5 4.5L19 7';
const X_PATHS = ['M7 7l10 10', 'M17 7L7 17'];

const STATE_CLASSES: Record<MorphButtonState, string> = {
  idle: 'bg-primary text-primary-foreground shadow-lg shadow-violet-500/25 hover:bg-primary/90',
  loading: 'bg-primary text-primary-foreground',
  success: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25',
  error: 'bg-rose-500 text-white',
};

function SpinnerIcon({ size }: { size: number }) {
  const circumference = 2 * Math.PI * SPINNER_RADIUS;
  return (
    <motion.svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true" animate={{ rotate: 360 }} transition={{ duration: SPIN_DURATION, ease: 'linear', repeat: Infinity }}>
      <circle cx="12" cy="12" r={SPINNER_RADIUS} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${circumference * SPINNER_ARC} ${circumference}`} />
    </motion.svg>
  );
}

function DrawnIcon({ paths, size, instant }: { paths: string[]; size: number; instant: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d, index) => (
        <motion.path key={d} d={d} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={instant ? { duration: 0 } : { duration: DRAW_DURATION, ease: EASE_REVEAL, delay: 0.12 + index * 0.05 }} />
      ))}
    </svg>
  );
}

const BURST_COLORS = ['#7c3aed', '#a78bfa', '#22d3ee', '#10b981'];
/** A ring of dots thrown out from the middle of the button, each a little further than the last. */
function Burst() {
  const dots = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2 + 0.2;
    const reach = 54 + (i % 3) * 16;
    return { x: Math.cos(angle) * reach * 1.7, y: Math.sin(angle) * reach, color: BURST_COLORS[i % BURST_COLORS.length], size: 5 + (i % 3) * 2 };
  });
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2" aria-hidden="true">
      {dots.map((d, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{ width: d.size, height: d.size, marginLeft: -d.size / 2, marginTop: -d.size / 2, backgroundColor: d.color }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
          animate={{ x: d.x, y: d.y, opacity: [0, 1, 0], scale: [0.4, 1, 0.5] }}
          transition={{ duration: 0.85, ease: EASE_REVEAL, delay: 0.08 + (i % 4) * 0.02 }}
        />
      ))}
    </span>
  );
}

export function MorphButton({ children, onAction, state: stateProp, onClick, type = 'button', loadingLabel, successLabel = 'Done', errorLabel = 'Failed', resetDelay = DEFAULT_RESET_DELAY, size = 'md', burst = false, block = false, disabled = false, className }: MorphButtonProps) {
  const shouldReduceMotion = useReducedMotion();
  const [internalState, setInternalState] = useState<MorphButtonState>('idle');
  const mountedRef = useRef(true);

  const isControlled = stateProp !== undefined;
  const state = stateProp ?? internalState;
  const interactive = state === 'idle' && !disabled;
  const { button: sizeClasses, content: contentGap, icon: iconSize } = SIZES[size];

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isControlled) return;
    if (internalState !== 'success' && internalState !== 'error') return;
    const timer = setTimeout(() => setInternalState('idle'), resetDelay);
    return () => clearTimeout(timer);
  }, [internalState, isControlled, resetDelay]);

  const handleClick = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!interactive) return;
      onClick?.(event);
      if (isControlled || !onAction) return;
      setInternalState('loading');
      try {
        await onAction();
        if (mountedRef.current) setInternalState('success');
      } catch {
        if (mountedRef.current) setInternalState('error');
      }
    },
    [interactive, isControlled, onAction, onClick],
  );

  const announcement = state === 'loading' ? (loadingLabel ?? 'Loading') : state === 'success' ? successLabel : state === 'error' ? errorLabel : '';

  let content: React.ReactNode;
  if (state === 'loading') {
    content = (
      <>
        <SpinnerIcon size={iconSize} />
        {loadingLabel && <span>{loadingLabel}</span>}
      </>
    );
  } else if (state === 'success') {
    content = (
      <>
        <motion.span className="inline-flex" initial={shouldReduceMotion ? false : { scale: 0.6 }} animate={{ scale: 1 }} transition={SPRING_SOFT}>
          <DrawnIcon paths={[CHECK_PATH]} size={iconSize} instant={!!shouldReduceMotion} />
        </motion.span>
        {successLabel && <span>{successLabel}</span>}
      </>
    );
  } else if (state === 'error') {
    content = (
      <>
        <DrawnIcon paths={X_PATHS} size={iconSize} instant={!!shouldReduceMotion} />
        {errorLabel && <span>{errorLabel}</span>}
      </>
    );
  } else {
    content = children;
  }

  return (
    <span className={cn('relative', block ? 'flex w-full justify-center' : 'inline-flex')}>
      <motion.button
        type={type}
        layout
        onClick={handleClick}
        disabled={disabled}
        aria-disabled={!interactive || undefined}
        aria-busy={state === 'loading' || undefined}
        aria-label={typeof children === 'string' ? children : undefined}
        style={{ borderRadius: 999 }}
        whileTap={interactive && !shouldReduceMotion ? { scale: 0.97 } : undefined}
        animate={state === 'error' && !shouldReduceMotion ? { x: SHAKE_KEYFRAMES } : { x: 0 }}
        transition={{ layout: shouldReduceMotion ? { duration: 0 } : SPRING_SNAPPY, scale: SPRING_SNAPPY, x: { duration: SHAKE_DURATION, ease: 'easeInOut' } }}
        className={cn(
          'relative inline-flex select-none items-center justify-center overflow-hidden rounded-full font-medium',
          'transition-colors duration-300',
          'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          !interactive && 'pointer-events-none',
          STATE_CLASSES[state],
          sizeClasses,
          block && state === 'idle' && 'w-full',
          className,
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={state}
            layout="position"
            className={cn('inline-flex items-center justify-center whitespace-nowrap', contentGap)}
            initial={{ y: CONTENT_SHIFT, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -CONTENT_SHIFT, opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: CONTENT_DURATION, ease: EASE_REVEAL }}
          >
            {content}
          </motion.span>
        </AnimatePresence>
        <span aria-live="polite" role="status" className="sr-only">
          {announcement}
        </span>
      </motion.button>
      {burst && state === 'success' && !shouldReduceMotion && <Burst />}
    </span>
  );
}

export default MorphButton;
