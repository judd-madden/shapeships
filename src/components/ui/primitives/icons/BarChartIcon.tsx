interface BarChartIconProps {
  className?: string;
}

export function BarChartIcon({ className = '' }: BarChartIconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <g transform="translate(1.5, 2.5)">
        <rect y="9" width="5" height="10"/>
        <rect x="8" width="5" height="19"/>
        <rect x="16" y="7" width="5" height="12"/>
      </g>
    </svg>
  );
}
