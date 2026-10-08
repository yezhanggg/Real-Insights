// The site's name, set like the 21st.dev "text-loop": a plain word, then a word that wipes in over a soft violet
// block, in a violet gradient, with a blinking cursor after it. Used for "Vision" + "REAL" in both headers.
// Changes: the size, weight and tracking come from `className` (the template's hero sizes are only its default), and
// with a single word there is nothing to rotate, so it wipes in once and stays.
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
}: TextLoopProps) {
  const [index, setIndex] = useState(0);

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
              className="relative overflow-hidden whitespace-nowrap"
            >
              {/* Background gradient box */}
              <div className={cn('absolute inset-0 bg-linear-to-r from-transparent via-purple-200/30 to-purple-200', backgroundClassName)} />
              <span className={cn('relative bg-linear-to-r from-violet-400 to-violet-800 bg-clip-text pr-1 text-transparent', rotatingTextClassName)}>{rotatingTexts[index]}</span>
            </m.div>
          </AnimatePresence>

          {/* Cursor line */}
          <m.div className={cn('h-[1.1em] w-[3px] bg-violet-500 sm:h-[1em] md:w-[4px]', cursorClassName)} animate={{ opacity: [1, 0.5] }} transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse' }} />
        </div>
      </div>
    </LazyMotion>
  );
}

/** The site's name as a mark: every word but the last plain, the last one highlighted ("Vision" + "REAL").
 * Without a `className` it takes the size and weight of whatever it sits in. */
export function BrandMark({ name, className }: { name: string; className?: string }) {
  const words = name.trim().split(/\s+/);
  const last = words.pop() ?? '';
  return <TextLoop staticText={words.join(' ')} rotatingTexts={[last]} className={className ?? ''} staticTextClassName="mr-[0.26em]" rotatingTextClassName="px-[0.12em]" cursorClassName="w-[2px] md:w-[2px]" />;
}
