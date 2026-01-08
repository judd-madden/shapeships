/**
 * Clock Icon
 */

interface ClockIconProps {
  className?: string;
  color?: string;
}

export function ClockIcon({ className = "", color = "white" }: ClockIconProps) {
  return (
    <div className={`relative size-[24px] ${className}`}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 48 48">
        <path 
          d="M23.98 4.00024C12.94 4.00024 4 12.9602 4 24.0002C4 35.0402 12.94 44.0002 23.98 44.0002C35.04 44.0002 44 35.0402 44 24.0002C44 12.9602 35.04 4.00024 23.98 4.00024ZM24 40.0002C15.16 40.0002 8 32.8402 8 24.0002C8 15.1602 15.16 8.00024 24 8.00024C32.84 8.00024 40 15.1602 40 24.0002C40 32.8402 32.84 40.0002 24 40.0002Z" 
          fill={color} 
        />
        <path 
          d="M25 13.9998H22V25.9998L32.5 32.2998L34 29.8398L25 24.4998V13.9998Z" 
          fill={color} 
        />
      </svg>
    </div>
  );
}
