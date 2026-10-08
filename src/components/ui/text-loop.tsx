// The site's name, set like the 21st.dev "text-loop": a plain word, then a word that wipes in over a soft violet
// block, in a violet gradient, with a blinking cursor after it. Used for "Vision" + "REAL" in both headers.
// Changes: the size, weight and tracking come from `className` (the template's hero sizes are only its default);
// with a single word there is nothing to rotate, so it wipes in once and stays; and with `settle`, once that wipe has
// played, the violet block and the cursor fade away and only the word is left.
import { useEffect, useState } from 'react';
import { AnimatePresence, LazyMotion, domAnimation, m, type Transition } from 'motion/react';
import { cn } from '@/lib/utils';

interface TextLoopProps {
  staticText?: string;
  rotatingTexts?: string[];
  className?: string;
  interval?: number;
  transition?: Transition;
  staticTextClassName?: string;
  rotatingTextClassName?: string;
  backgroundClassName?: string;
  cursorClassName?: string;
  /** After the first wipe-in, fade out the block behind the word and the cursor. */
  settle?: boolean;
}

export default function TextLoop({
  staticText = 'Design',
  rotatingTexts = ['Limitless', 'Timeless', 'Flawless'],
  className = 'text-4xl md:text-7xl font-medium tracking-tight',
  interval = 3000,
  transition = { duration: 0.8, ease: 'easeInOut' },
  staticTextClassName,
  rotatingTextClassName,
  backgroundClassName,
  cursorClassName,
  settle = false,
}: TextLoopProps) {
  const [index, setIndex] = useState(0);
  const [settled, setSettled] = useState(false);
  const fade = cn('transition-opacity duration-700', settled && 'opacity-0');

  useEffect(() => {
    if (rotatingTexts.length < 2) return;
    const timer = setInterval(() => setIndex((prev) => (prev + 1) % rotatingTexts.length), interval);
    return () => clearInterval(timer);
  }, [rotatingTexts.length, interval]);

  return (
    <LazyMotion features={domAnimation}>
      <div className={cn('flex w-fit flex-row items-center justify-start', className)}>
        <span className={cn('mr-3 whitespace-nowrap', staticTextClassName)}>{staticText}</span>
        <div className="relative flex items-center">
          <AnimatePresence mode="wait">
            <m.div
              key={rotatingTexts[index]}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={transition}
              onAnimationComplete={() => settle && setSettled(true)}
              className="relative overflow-hidden whitespace-nowrap"
            >
              {/* Background gradient box */}
              <div className={cn('absolute inset-0 bg-linear-to-r from-transparent via-purple-200/30 to-purple-200', fade, backgroundClassName)} />
              <span className={cn('relative bg-linear-to-r from-violet-400 to-violet-800 bg-clip-text pr-1 text-transparent', rotatingTextClassName)}>{rotatingTexts[index]}</span>
            </m.div>
          </AnimatePresence>

          {/* Cursor line */}
          <div className={fade}>
            <m.div className={cn('h-[1.1em] w-[3px] bg-violet-500 sm:h-[1em] md:w-[4px]', cursorClassName)} animate={settled ? { opacity: 0 } : { opacity: [1, 0.5] }} transition={settled ? { duration: 0.3 } : { duration: 0.8, repeat: Infinity, repeatType: 'reverse' }} />
          </div>
        </div>
      </div>
    </LazyMotion>
  );
}

/** The site's name as a mark: every word but the last plain, the last one in a violet gradient ("Vision" + "REAL").
 * The last word wipes in once over a violet block with a cursor, then both fade and the name stands plain.
 * Without a `className` it takes the size and weight of whatever it sits in. */
export function BrandMark({ name, className }: { name: string; className?: string }) {
  const words = name.trim().split(/\s+/);
  const last = words.pop() ?? '';
  return <TextLoop staticText={words.join(' ')} rotatingTexts={[last]} className={className ?? ''} settle staticTextClassName="mr-[0.16em]" rotatingTextClassName="pr-[0.04em]" cursorClassName="w-[2px] md:w-[2px]" />;
}
