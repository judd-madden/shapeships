/**
 * Build Icon
 */

interface BuildIconProps {
  className?: string;
  color?: string;
}

export function BuildIcon({ className = "", color = "#D5D5D5" }: BuildIconProps) {
  return (
    <div className={`relative size-[24px] ${className}`}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <path 
          d="M1.42871 8.51856V10.3704H3.21442L8.48109 4.90868L6.69538 3.05683L1.42871 8.51856ZM10.1954 3.13091L8.40966 1.27905L7.2049 2.53337L8.99061 4.38523L10.1954 3.13091Z" 
          fill={color} 
        />
        <path 
          d="M6.00002 12.667V14.5189H7.78574L13.0524 9.05712L11.2667 7.20527L6.00002 12.667ZM14.7667 7.27934L12.981 5.42749L11.7762 6.68181L13.5619 8.53367L14.7667 7.27934Z" 
          fill={color} 
        />
      </svg>
    </div>
  );
}