import { useId } from 'react';

/**
 * SplitCircle mark: a circle split into three equal parts around a coin —
 * one bill, shared fairly. Colours follow the selected theme.
 * variant="tile" draws the rounded app-icon tile; variant="mark" only the symbol.
 */
export default function Logo({ size = 40, variant = 'tile', className = '', title = 'SplitCircle' }) {
  const id = useId().replace(/:/g, '');
  const c = 2 * Math.PI * 24; // ring circumference
  const gap = 15;
  const seg = c / 3 - gap;
  return (
    <svg
      className={`sc-logo ${className}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--brand-2)' }} />
          <stop offset="1" style={{ stopColor: 'var(--brand-3)' }} />
        </linearGradient>
      </defs>
      {variant === 'tile' && <rect width="100" height="100" rx="26" fill={`url(#g${id})`} />}
      <g
        fill="none"
        stroke={variant === 'tile' ? '#fff' : `url(#g${id})`}
        strokeWidth="9"
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
      >
        <circle cx="50" cy="50" r="24" strokeDasharray={`${seg} ${gap}`} strokeDashoffset={-gap / 2} />
      </g>
      <circle cx="50" cy="50" r="8" fill={variant === 'tile' ? '#fff' : `url(#g${id})`} />
    </svg>
  );
}
