/**
 * Chevron Down Icon
 */

interface ChevronDownProps {
  className?: string;
  color?: string;
}

export function ChevronDown({ className = "", color = "white" }: ChevronDownProps) {
  return (
    <div className={`relative size-[40px] ${className}`}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 40 40.35">
        <path 
          d="M12.35 14L10 16.35L20 26.35L30 16.35L27.65 14L20 21.6333L12.35 14Z" 
          fill={color} 
        />
      </svg>
    </div>
  );
}
