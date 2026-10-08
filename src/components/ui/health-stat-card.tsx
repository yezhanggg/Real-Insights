// A stat card (21st.dev "health-stat-card"): a title, three headline facts, a row of bars that spring up and lift on
// hover, and a legend. Changes: Motion instead of framer-motion; `children` go under the legend (the Subscribe form
// lives there); `showValues={false}` leaves the percentages out, for bars that are there to be looked at, not read as
// measurements; a bar's name and description show in a caption under the bars, inside the card, where the template
// had a tooltip floating over it; the grey panel behind the bars is gone; and on a short wide screen (a phone on
// its side) the card lays out in two columns, facts and bars beside `children`, with the legend left out.
import * as React from 'react';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { cn } from '@/lib/utils';

export interface StatData {
  title: string;
  value: string | number;
  unit?: string;
  changePercent?: number;
  changeDirection?: 'up' | 'down';
}

export interface HealthGraphData {
  label: string;
  /** Bar height, 0–100. */
  value: number;
  color?: string;
  description?: string;
}

export interface HealthStatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  headerIcon?: React.ReactNode;
  title: string;
  /** id for the title, so a dialog can point `aria-labelledby` at it. */
  titleId?: string;
  stats: StatData[];
  graphData?: HealthGraphData[];
  graphHeight?: number;
  showLegend?: boolean;
  legendTitle?: string;
  legendFormat?: (item: HealthGraphData) => string;
  /** Widest a bar may grow, in px. Unset, the bars share the full width as published. */
  barMaxWidth?: number;
  /** False when the bar heights are not figures: the caption and legend then show names only. */
  showValues?: boolean;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.15 } },
};
const barVariants: Variants = {
  hidden: { scaleY: 0 },
  visible: { scaleY: 1, transition: { type: 'spring', stiffness: 100, damping: 15 } },
};

export const HealthStatCard = React.forwardRef<HTMLDivElement, HealthStatCardProps>(
  ({ className, headerIcon, title, titleId, stats, graphData, graphHeight = 100, showLegend = true, legendTitle = 'Data Breakdown', legendFormat, barMaxWidth, showValues = true, children, ...props }, ref) => {
    // The bar the caption describes: the last one pointed at, focused or tapped. It starts on the first.
    const [active, setActive] = React.useState(0);
    const current = graphData?.[Math.min(active, graphData.length - 1)];
    const describes = !!graphData?.some((b) => b.description);
    return (
      <div ref={ref} className={cn('w-full max-w-md rounded-2xl border bg-card p-6 text-card-foreground shadow-sm', className)} {...props}>
        {/* Header */}
        <div className="mb-5 flex items-center gap-3 pr-10 short:mb-3">
          {headerIcon && <div className="text-primary">{headerIcon}</div>}
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
        </div>

        <div className="short:grid short:grid-cols-2 short:items-center short:gap-x-8">
        <div>
        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-4 text-center short:mb-4">
          {stats.map((item, i) => (
            <div key={i}>
              <div className="flex items-baseline justify-center gap-1">
                <p className="text-2xl font-bold max-[380px]:text-xl">{item.value}</p>
                {item.unit && <span className="text-sm text-muted-foreground">{item.unit}</span>}
              </div>
              <p className="text-xs text-muted-foreground">{item.title}</p>
              {item.changePercent !== undefined && (
                <div className={cn('mt-1 text-xs font-medium', item.changeDirection === 'up' ? 'text-green-500' : 'text-red-500')}>
                  {item.changeDirection === 'up' ? '▲' : '▼'} {item.changePercent}%
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Animated graph, with its caption under the bars. No tinted panel behind it: the bars stand on the card. */}
        {graphData && current && (
          <div>
            <motion.div className={cn('flex w-full items-end gap-2 short:h-16!', barMaxWidth ? 'justify-around' : 'justify-between')} variants={containerVariants} initial="hidden" animate="visible" style={{ height: graphHeight }}>
              {graphData.map((bar, i) => (
                <motion.button
                  key={i}
                  type="button"
                  aria-label={showValues ? `${bar.label}: ${bar.value}%` : bar.label}
                  aria-pressed={i === active}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                  className={cn('flex-1 origin-bottom cursor-pointer rounded-full outline-none transition-opacity duration-300 focus-visible:ring-2 focus-visible:ring-ring', i !== active && 'opacity-40')}
                  style={{ height: `${bar.value}%`, maxWidth: barMaxWidth, background: `linear-gradient(180deg, ${bar.color} 0%, ${bar.color}cc 100%)` }}
                  variants={barVariants}
                  whileHover={{ scale: 1.08, y: -4, transition: { type: 'spring', stiffness: 200, damping: 12 } }}
                  whileTap={{ scale: 0.95 }}
                />
              ))}
            </motion.div>
            {describes && (
              <div className="mt-4 min-h-[3.25rem] border-t border-border pt-3 text-xs" aria-live="polite">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={active} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>
                    <p className="flex items-center gap-2 font-semibold">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: current.color }} />
                      {current.label}
                      {showValues && <span className="font-normal text-muted-foreground">{current.value}%</span>}
                    </p>
                    {current.description && <p className="mt-0.5 text-muted-foreground">{current.description}</p>}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        {showLegend && graphData && (
          <div className="mt-6 short:hidden">
            <h4 className="mb-2 text-sm font-medium text-muted-foreground">{legendTitle}</h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {graphData.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-muted-foreground">{legendFormat ? legendFormat(item) : showValues ? `${item.label} (${item.value}%)` : item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        </div>
        <div>{children}</div>
        </div>
      </div>
    );
  },
);
HealthStatCard.displayName = 'HealthStatCard';
