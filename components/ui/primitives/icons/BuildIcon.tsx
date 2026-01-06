/**
 * Build Icon
 */

interface BuildIconProps {
  className?: string;
  color?: string;
}

export function BuildIcon({ className = "", color = "#D5D5D5" }: BuildIconProps) {
  return (
    <div className={`relative w-[19.533px] h-[11.091px] ${className}`}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 19.5333 11.0914">
        <path 
          d="M1 8.23951V10.0914H2.78571L8.05238 4.62963L6.26666 2.77778L1 8.23951ZM9.76666 2.85185L7.98095 1L6.77619 2.25432L8.5619 4.10617L9.76666 2.85185V2.85185Z" 
          fill={color} 
        />
        <path 
          d="M9.76666 8.23951V10.0914H11.5524L16.819 4.62963L15.0333 2.77778L9.76666 8.23951ZM18.5333 2.85185L16.7476 1L15.5429 2.25432L17.3286 4.10617L18.5333 2.85185V2.85185Z" 
          fill={color} 
        />
      </svg>
    </div>
  );
}
