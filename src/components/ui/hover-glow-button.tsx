// Hover-glow button (21st.dev "hover-glow-button"): a soft light follows the cursor across the button.
// Adapted: violet defaults, the usual button props, and size and shape left to `className`. While disabled
// there is no glow and no inline color, so the caller's `disabled:` styles show.
import { useRef, useState, type ButtonHTMLAttributes, type MouseEvent } from 'react';
import { cn } from '@/lib/utils';

interface HoverButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  glowColor?: string;
  backgroundColor?: string;
  textColor?: string;
  hoverTextColor?: string;
}

function HoverButton({
  children,
  className,
  disabled = false,
  type = 'button',
  glowColor = '#c4b5fd', // violet-300
  backgroundColor = '#7c3aed', // violet-600
  textColor = '#ffffff',
  hoverTextColor = '#ffffff',
  style,
  ...props
}: HoverButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [glowPosition, setGlowPosition] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const glowing = isHovered && !disabled;

  const handleMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setGlowPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <button
      {...props}
      ref={buttonRef}
      type={type}
      disabled={disabled}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn('relative isolate inline-block cursor-pointer overflow-hidden transition-colors duration-300 disabled:cursor-default', className)}
      style={disabled ? style : { backgroundColor, color: glowing ? hoverTextColor : textColor, ...style }}
    >
      {/* Glow effect div */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 transition-transform duration-400 ease-out',
          glowing ? 'scale-120' : 'scale-0',
        )}
        style={{
          left: `${glowPosition.x}px`,
          top: `${glowPosition.y}px`,
          background: `radial-gradient(circle, ${glowColor} 10%, transparent 70%)`,
          zIndex: 0,
        }}
      />

      {/* Button content */}
      <span className="relative z-10">{children}</span>
    </button>
  );
}

export { HoverButton };
