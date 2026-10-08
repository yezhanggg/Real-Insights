// A stat card (21st.dev "health-stat-card"): a title, three headline facts, a row of bars that spring up and lift on
// hover (each with a tooltip), and a legend. Changes: Motion instead of framer-motion; `children` go under the
// legend (the Subscribe form lives there); and `showValues={false}` leaves the percentages out, for bars that are
// there to be looked at, not read as measurements.
import * as React from 'react';
import { motion, type Variants } from 'motion/react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  /** False when the bar heights are not figures: tooltips and legend then show names only. */
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
  ({ className, headerIcon, title, titleId, stats, graphData, graphHeight = 100, showLegend = true, legendTitle = 'Data Breakdown', legendFormat, barMaxWidth, showValues = true, children, ...props }, ref) => (
    <div ref={ref} className={cn('w-full max-w-md rounded-2xl border bg-card p-6 text-card-foreground shadow-sm', className)} {...props}>
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        {headerIcon && <div className="text-primary">{headerIcon}</div>}
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4 text-center">
        {stats.map((item, i) => (
          <div key={i}>
            <div className="flex items-baseline justify-center gap-1">
              <p className="text-2xl font-bold">{item.value}</p>
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

      {/* Animated graph */}
      {graphData && (
        <TooltipProvider delayDuration={100}>
          <div className="rounded-lg bg-muted/50 p-4">
            <motion.div className={cn('flex w-full items-end gap-2', barMaxWidth ? 'justify-around' : 'justify-between')} variants={containerVariants} initial="hidden" animate="visible" style={{ height: graphHeight }}>
              {graphData.map((bar, i) => (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <motion.div
                      tabIndex={0}
                      role="img"
                      aria-label={showValues ? `${bar.label}: ${bar.value}%` : bar.label}
                      className="flex-1 origin-bottom cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{ height: `${bar.value}%`, maxWidth: barMaxWidth, background: `linear-gradient(180deg, ${bar.color} 0%, ${bar.color}cc 100%)` }}
                      variants={barVariants}
                      whileHover={{ scale: 1.1, y: -6, boxShadow: '0 10px 20px rgba(0,0,0,0.2)', rotateX: 8, rotateY: -6, transition: { type: 'spring', stiffness: 200, damping: 10 } }}
                      whileTap={{ scale: 0.95 }}
                    />
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">
                    <p className="font-semibold">{bar.label}</p>
                    {showValues && <p className="text-muted-foreground">{bar.value}%</p>}
                    {bar.description && <p className={cn('text-muted-foreground', showValues && 'mt-1')}>{bar.description}</p>}
                  </TooltipContent>
                </Tooltip>
              ))}
            </motion.div>
          </div>
        </TooltipProvider>
      )}

      {/* Legend */}
      {showLegend && graphData && (
        <div className="mt-6">
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

      {children}
    </div>
  ),
);
HealthStatCard.displayName = 'HealthStatCard';
