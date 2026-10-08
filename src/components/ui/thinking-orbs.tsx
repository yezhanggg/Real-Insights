// Thinking Orbs: the animated "thinking" mark of the question box.
//
// A thin door onto the `thinking-orbs` package (MIT, by Jakub Antalik, https://libraries.dev/orbs), supplied by the
// project owner. It draws on a plain 2D canvas, has no dependencies and makes no network request, so it also runs in
// the offline single-file export. States used here: searching, solving, composing, breathing.
import { useEffect, useRef } from 'react';
import { MODE_FRAMES, resolvePreset, scaleCounts, type OrbState } from 'thinking-orbs';

export { ThinkingOrb } from 'thinking-orbs';
export type { ThinkingOrbProps, OrbState, OrbSize, OrbTheme } from 'thinking-orbs';

/**
 * The same orb at any size. The package's component stops at 64 px, and stretching that canvas blurs it, so this one
 * asks the library for each frame's geometry at the size wanted and paints the dots itself, the way the library does
 * (a dot's `white` fades the ink toward the paper). For light backgrounds.
 */
export function LargeOrb({ state = 'breathing', size = 220, color = '#7c3aed', density = 3, className, label }: { state?: OrbState; size?: number; color?: string; density?: number; className?: string; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.height = Math.round(size * dpr);
    // The 64 px preset is the tuned look; a larger orb has room for more dots.
    const preset = resolvePreset(state, 64);
    const opts = scaleCounts(preset.opts, density);
    const frame = MODE_FRAMES[preset.mode];
    const n = parseInt(color.slice(1), 16);
    const ink = (white: number, alpha: number) => {
      const w = Math.min(1, Math.max(0, white));
      const ramp = (c: number) => Math.round(c + (255 - c) * w);
      return `rgba(${ramp((n >> 16) & 255)},${ramp((n >> 8) & 255)},${ramp(n & 255)},${alpha})`;
    };
    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const f = frame(size, t, opts);
      for (const l of f.lines) {
        ctx.strokeStyle = ink(l.white, l.a ?? 1);
        ctx.lineWidth = l.w;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
      }
      for (const d of f.dots) {
        ctx.fillStyle = ink(d.white, d.a ?? 1);
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return draw(0.6);
    let raf = 0;
    const loop = () => {
      draw((performance.now() / 1000) * preset.speed);
      raf = document.hidden ? 0 : requestAnimationFrame(loop);
    };
    const onVisible = () => {
      if (!document.hidden && !raf) loop();
    };
    loop();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [state, size, color, density]);
  return <canvas ref={ref} role="img" aria-label={label} aria-hidden={label ? undefined : true} className={className} style={{ width: size, height: size, display: 'block' }} />;
}
