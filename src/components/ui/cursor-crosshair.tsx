// A crosshair that follows the mouse across its parent: two hairlines and a small square at the pointer.
// From the 21st.dev "variable-font-and-cursor" demo. Only the cursor-following part is used; see docs/ARCHITECTURE.md.
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/** Drop inside a positioned element. Mouse only: touch and pen never show it. */
export function CursorCrosshair({ className }: { className?: string }) {
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = layer.current;
    const host = el?.parentElement;
    if (!el || !host) return;
    // The position goes straight into two CSS variables, so following the mouse never re-renders React.
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const rect = host.getBoundingClientRect();
      el.style.setProperty('--x', `${e.clientX - rect.left}px`);
      el.style.setProperty('--y', `${e.clientY - rect.top}px`);
      el.dataset.on = 'true';
      // Links and buttons keep the browser's own pointer, so the square steps aside there.
      el.dataset.control = String(e.target instanceof Element && !!e.target.closest('a,button'));
    };
    const leave = () => (el.dataset.on = 'false');
    const down = (e: PointerEvent) => e.pointerType === 'mouse' && (el.dataset.pressed = 'true');
    const up = () => (el.dataset.pressed = 'false');
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerleave', leave);
    host.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', leave);
      host.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);
  return (
    <div
      ref={layer}
      aria-hidden="true"
      className={cn('group pointer-events-none absolute inset-0 z-[6] overflow-hidden opacity-0 transition-opacity duration-200 data-[on=true]:opacity-100', className)}
    >
      <div className="absolute inset-y-0 left-0 w-px translate-x-[var(--x)] bg-primary/20" />
      <div className="absolute inset-x-0 top-0 h-px translate-y-[var(--y)] bg-primary/20" />
      <div className="absolute left-0 top-0 translate-x-[var(--x)] translate-y-[var(--y)]">
        <div className="size-2 -translate-x-1/2 -translate-y-1/2 rounded-[2px] bg-primary transition-[scale,opacity] duration-150 group-data-[control=true]:opacity-0 group-data-[pressed=true]:scale-[1.75]" />
      </div>
    </div>
  );
}
