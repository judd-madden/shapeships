/**
 * Draw Icon
 */

interface DrawIconProps {
  className?: string;
  color?: string;
}

export function DrawIcon({ className = "", color = "white" }: DrawIconProps) {
  return (
    <div className={`relative size-[24px] ${className}`}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 48 48">
        <path 
          d="M6 34.5003V42.0003H13.5L35.62 19.8803L28.12 12.3803L6 34.5003ZM42.82 12.6803L35.32 5.1803L30.26 10.2603L37.76 17.7603L42.82 12.6803V12.6803Z" 
          fill={color} 
        />
      </svg>
    </div>
  );
}
