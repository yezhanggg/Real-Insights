// A list of past work and updates. Hover a row and a preview image follows the cursor.
// From the 21st.dev "project-showcase" component; the rows come in as props instead of a fixed list, and the
// follow animation only runs while a preview is showing.
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

export interface ShowcaseItem {
  title: string;
  description: string;
  /** Short date label, e.g. "Oct 2026". */
  year: string;
  link: string;
  image: string;
  /** Small tag after the title, e.g. "Example". */
  badge?: string;
}

export function ProjectShowcase({ items, heading = 'Selected Work', onSelect, id }: { items: ShowcaseItem[]; heading?: string; onSelect?: (item: ShowcaseItem, event: React.MouseEvent) => void; id?: string }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [smoothPosition, setSmoothPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isVisible) return;
    const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;
    const animate = () => {
      setSmoothPosition((prev) => ({ x: lerp(prev.x, mousePosition.x, 0.15), y: lerp(prev.y, mousePosition.y, 0.15) }));
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [mousePosition, isVisible]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  const handleMouseEnter = (index: number) => {
    setHoveredIndex(index);
    setIsVisible(true);
  };
  const handleMouseLeave = () => {
    setHoveredIndex(null);
    setIsVisible(false);
  };

  return (
    <section ref={containerRef} id={id} onMouseMove={handleMouseMove} className="relative mx-auto w-full max-w-2xl scroll-mt-8 px-6 py-16">
      <h2 className="mb-8 text-sm font-medium uppercase tracking-wide text-muted-foreground">{heading}</h2>

      <div
        className="pointer-events-none fixed z-50 overflow-hidden rounded-xl shadow-2xl max-md:hidden"
        style={{
          left: containerRef.current?.getBoundingClientRect().left ?? 0,
          top: containerRef.current?.getBoundingClientRect().top ?? 0,
          transform: `translate3d(${smoothPosition.x + 20}px, ${smoothPosition.y - 100}px, 0)`,
          opacity: isVisible ? 1 : 0,
          scale: isVisible ? 1 : 0.8,
          transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), scale 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="relative h-[180px] w-[280px] overflow-hidden rounded-xl bg-secondary">
          {items.map((item, index) => (
            <img
              key={item.link}
              src={item.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-all duration-500 ease-out"
              style={{ opacity: hoveredIndex === index ? 1 : 0, scale: hoveredIndex === index ? 1 : 1.1, filter: hoveredIndex === index ? 'none' : 'blur(10px)' }}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-violet-950/25 to-transparent" />
        </div>
      </div>

      <div className="space-y-0">
        {items.map((item, index) => (
          <a key={item.link} href={item.link} className="group block" onClick={(e) => onSelect?.(item, e)} onMouseEnter={() => handleMouseEnter(index)} onMouseLeave={handleMouseLeave}>
            <div className="relative border-t border-border py-5 transition-all duration-300 ease-out">
              <div className={`absolute inset-0 -mx-4 rounded-lg bg-secondary/50 px-4 transition-all duration-300 ease-out ${hoveredIndex === index ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`} />
              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="inline-flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-medium tracking-tight text-foreground">
                      <span className="relative">
                        {item.title}
                        <span className={`absolute -bottom-0.5 left-0 h-px bg-violet-600 transition-all duration-300 ease-out ${hoveredIndex === index ? 'w-full' : 'w-0'}`} />
                      </span>
                    </h3>
                    {item.badge && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">{item.badge}</span>}
                    <ArrowUpRight className={`h-4 w-4 text-violet-600 transition-all duration-300 ease-out ${hoveredIndex === index ? 'translate-x-0 translate-y-0 opacity-100' : '-translate-x-2 translate-y-2 opacity-0'}`} />
                  </div>
                  <p className={`mt-1 text-sm leading-relaxed transition-all duration-300 ease-out ${hoveredIndex === index ? 'text-foreground/70' : 'text-muted-foreground'}`}>{item.description}</p>
                </div>
                <span className={`font-mono text-xs tabular-nums text-muted-foreground transition-all duration-300 ease-out ${hoveredIndex === index ? 'text-foreground/60' : ''}`}>{item.year}</span>
              </div>
            </div>
          </a>
        ))}
        <div className="border-t border-border" />
      </div>
    </section>
  );
}

export default ProjectShowcase;
