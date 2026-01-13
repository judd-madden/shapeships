/**
 * Black Xenite Icon
 * Special treatment icon
 */

interface BlackXeniteIconProps {
  className?: string;
  color?: string;
}

export function BlackXeniteIcon({ className = "", color = "black" }: BlackXeniteIconProps) {
  return (
    <div className={`relative size-[24px] ${className}`}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 42 42">
        <path 
          d="M35.1686 6.8313L6.83105 35.1688" 
          stroke={color} 
          strokeWidth="4.9874" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
        <path 
          d="M6.83105 6.8313L35.1686 35.1688" 
          stroke={color} 
          strokeWidth="4.9874" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
