// Text that settles out of random letters, left to right (21st.dev "text-scramble"). It plays whenever `trigger`
// turns true; the start page's slogan plays it once on load and again each time the pointer comes onto it.
// Changes: Motion instead of framer-motion; the motion element is made once, not on every render; the timer is
// cleared if the text leaves the page mid-play; and with reduced motion the text simply stands.
import { type JSX, useEffect, useMemo, useRef, useState } from 'react';
import { motion, type MotionProps } from 'motion/react';

type TextScrambleProps = {
  children: string;
  duration?: number;
  speed?: number;
  characterSet?: string;
  as?: React.ElementType;
  className?: string;
  trigger?: boolean;
  onScrambleComplete?: () => void;
} & MotionProps;

const defaultChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function TextScramble({ children, duration = 0.8, speed = 0.04, characterSet = defaultChars, className, as: Component = 'p', trigger = true, onScrambleComplete, ...props }: TextScrambleProps) {
  const MotionComponent = useMemo(() => motion.create(Component as keyof JSX.IntrinsicElements), [Component]);
  const [displayText, setDisplayText] = useState(children);
  const timer = useRef(0);
  const done = useRef(onScrambleComplete);
  done.current = onScrambleComplete;
  const text = children;

  useEffect(() => {
    if (!trigger) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      done.current?.();
      return;
    }
    const steps = duration / speed;
    let step = 0;
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      let scrambled = '';
      const progress = step / steps;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === ' ') scrambled += ' ';
        else if (progress * text.length > i) scrambled += text[i];
        else scrambled += characterSet[Math.floor(Math.random() * characterSet.length)];
      }
      setDisplayText(scrambled);
      step++;
      if (step > steps) {
        window.clearInterval(timer.current);
        setDisplayText(text);
        done.current?.();
      }
    }, speed * 1000);
    return () => window.clearInterval(timer.current);
  }, [trigger, text, duration, speed, characterSet]);

  return (
    <MotionComponent className={className} {...props}>
      {displayText}
    </MotionComponent>
  );
}
