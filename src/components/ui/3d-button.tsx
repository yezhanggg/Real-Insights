// The Subscribe button, from the 21st.dev "3d-button" ("Join Today" → "Join Now"). Its moves are kept: the letters
// roll on hover while a light runs round the edge and the arrow swings, lines splash out on a press, and after a
// click the outline draws itself and the label changes. The look is not: no purple slab, no stacked shadow and no
// tilt. It is a clear, upright pill with a hairline edge. The styles are in src/styles.css under `.sub3d`.
import { useState } from 'react';
import type React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** One span per letter; the visible glyphs are drawn by ::before / ::after from `data-label`. */
function Letters({ text, className }: { text: string; className: string }) {
  return (
    <span className={cn('sub3d-char', className)} aria-hidden="true">
      {[...text.replace(/ /g, '\u00a0')].map((ch, i) => (
        <span key={i} data-label={ch} style={{ '--i': i + 1 } as React.CSSProperties}>
          {ch}
        </span>
      ))}
    </span>
  );
}

interface SubscribeButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label?: string;
  /** Shown once the button has been clicked, for as long as it keeps focus. */
  clickedLabel?: string;
  /** The reader is already on the list: a quiet, still "Subscribed". */
  done?: boolean;
  doneLabel?: string;
}

export function SubscribeButton({ label = 'Subscribe', clickedLabel = 'Join us', done = false, doneLabel = 'Subscribed', className, onPointerDown, ...props }: SubscribeButtonProps) {
  // Counts presses. A new key restarts the splash, so even a quick tap plays it to the end.
  const [presses, setPresses] = useState(0);
  if (done)
    return (
      <button type="button" disabled className={cn('sub3d', className)} {...props}>
        <span className="sub3d-wrap">
          <span className="sub3d-content">
            {doneLabel}
            <Check className="sub3d-check" aria-hidden="true" />
          </span>
        </span>
      </button>
    );
  return (
    <button
      type="button"
      className={cn('sub3d', className)}
      aria-label={label}
      onPointerDown={(e) => {
        setPresses((n) => n + 1);
        onPointerDown?.(e);
      }}
      {...props}
    >
      <svg key={presses} className={cn('sub3d-splash', presses > 0 && 'sub3d-splash-go')} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 342 208" aria-hidden="true">
        <path strokeLinecap="round" strokeWidth={3} d="M54.1054 99.7837C54.1054 99.7837 40.0984 90.7874 26.6893 97.6362C13.2802 104.485 1.5 97.6362 1.5 97.6362" />
        <path strokeLinecap="round" strokeWidth={3} d="M285.273 99.7841C285.273 99.7841 299.28 90.7879 312.689 97.6367C326.098 104.486 340.105 95.4893 340.105 95.4893" />
        <path strokeLinecap="round" strokeWidth={3} strokeOpacity="0.3" d="M281.133 64.9917C281.133 64.9917 287.96 49.8089 302.934 48.2295C317.908 46.6501 319.712 36.5272 319.712 36.5272" />
        <path strokeLinecap="round" strokeWidth={3} strokeOpacity="0.3" d="M281.133 138.984C281.133 138.984 287.96 154.167 302.934 155.746C317.908 157.326 319.712 167.449 319.712 167.449" />
        <path strokeLinecap="round" strokeWidth={3} d="M230.578 57.4476C230.578 57.4476 225.785 41.5051 236.061 30.4998C246.337 19.4945 244.686 12.9998 244.686 12.9998" />
        <path strokeLinecap="round" strokeWidth={3} d="M230.578 150.528C230.578 150.528 225.785 166.471 236.061 177.476C246.337 188.481 244.686 194.976 244.686 194.976" />
        <path strokeLinecap="round" strokeWidth={3} strokeOpacity="0.3" d="M170.392 57.0278C170.392 57.0278 173.89 42.1322 169.571 29.54C165.252 16.9478 168.751 2.05227 168.751 2.05227" />
        <path strokeLinecap="round" strokeWidth={3} strokeOpacity="0.3" d="M170.392 150.948C170.392 150.948 173.89 165.844 169.571 178.436C165.252 191.028 168.751 205.924 168.751 205.924" />
        <path strokeLinecap="round" strokeWidth={3} d="M112.609 57.4476C112.609 57.4476 117.401 41.5051 107.125 30.4998C96.8492 19.4945 98.5 12.9998 98.5 12.9998" />
        <path strokeLinecap="round" strokeWidth={3} d="M112.609 150.528C112.609 150.528 117.401 166.471 107.125 177.476C96.8492 188.481 98.5 194.976 98.5 194.976" />
        <path strokeLinecap="round" strokeWidth={3} strokeOpacity="0.3" d="M62.2941 64.9917C62.2941 64.9917 55.4671 49.8089 40.4932 48.2295C25.5194 46.6501 23.7159 36.5272 23.7159 36.5272" />
        <path strokeLinecap="round" strokeWidth={3} strokeOpacity="0.3" d="M62.2941 145.984C62.2941 145.984 55.4671 161.167 40.4932 162.746C25.5194 164.326 23.7159 174.449 23.7159 174.449" />
      </svg>
      <span className="sub3d-wrap">
        {/* The pill's own outline, starting and ending at the top; it draws itself after a click. */}
        <svg className="sub3d-path" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 160 44" preserveAspectRatio="none" aria-hidden="true">
          <path strokeLinecap="round" pathLength={100} d="M104 1H138C149.598 1 159 10.402 159 22C159 33.598 149.598 43 138 43H22C10.402 43 1 33.598 1 22C1 10.402 10.402 1 22 1H56" />
        </svg>
        <span className="sub3d-outline" />
        <span className="sub3d-content">
          <span className="sub3d-labels">
            <Letters text={label} className="sub3d-state-1" />
            <Letters text={clickedLabel} className="sub3d-state-2" />
          </span>
          <span className="sub3d-icon">
            <span />
          </span>
        </span>
      </span>
    </button>
  );
}
