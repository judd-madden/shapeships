/**
 * Black Mercury Core Icon
 * Special treatment icon
 */

interface BlackMercuryCoreIconProps {
  className?: string;
  color?: string;
}

export function BlackMercuryCoreIcon({ className = "", color = "black" }: BlackMercuryCoreIconProps) {
  return (
    <div className={`relative size-[24px] ${className}`}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 61">
        <path 
          d="M15.7935 31.0247L15.7935 58.6021" 
          stroke={color} 
          strokeWidth="4.15617" 
          strokeLinecap="round"
        />
        <path 
          d="M2.07812 44.8132L29.5088 44.8132" 
          stroke={color} 
          strokeWidth="4.15617" 
          strokeLinecap="round"
        />
        <ellipse 
          cx="15.7936" 
          cy="20.6831" 
          rx="10.2865" 
          ry="10.3415" 
          stroke={color} 
          strokeWidth="4.15617"
        />
        <path 
          d="M26.0801 0C26.0801 5.71147 21.4747 10.3415 15.7936 10.3415C10.1125 10.3415 5.50708 5.71147 5.50708 0" 
          stroke={color} 
          strokeWidth="4.15617"
        />
      </svg>
    </div>
  );
}
