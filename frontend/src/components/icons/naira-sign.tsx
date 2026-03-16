import React from 'react';

interface NairaSignProps {
  className?: string;
  style?: React.CSSProperties;
  size?: number | string;
  color?: string;
  strokeWidth?: number | string;
}

/**
 * Custom Naira (₦) icon — drop-in replacement for lucide-react DollarSign.
 * Draws ₦: two vertical bars + diagonal (N-shape) + two horizontal crossbars.
 */
export function NairaSign({
  className,
  style,
  size = 24,
  color,
  strokeWidth = 2,
}: NairaSignProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color || 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {/* Left vertical bar */}
      <line x1="6" y1="3" x2="6" y2="21" />
      {/* Right vertical bar */}
      <line x1="18" y1="3" x2="18" y2="21" />
      {/* Diagonal (N stroke: top-left to bottom-right) */}
      <line x1="6" y1="3" x2="18" y2="21" />
      {/* Top horizontal crossbar */}
      <line x1="4" y1="9" x2="20" y2="9" />
      {/* Bottom horizontal crossbar */}
      <line x1="4" y1="15" x2="20" y2="15" />
    </svg>
  );
}

export default NairaSign;
