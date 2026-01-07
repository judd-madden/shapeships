/**
 * Heart Icon
 */

interface HeartIconProps {
  className?: string;
  color?: string;
}

export function HeartIcon({ className = "", color = "white" }: HeartIconProps) {
  return (
    <div className={`relative size-[24px] ${className}`}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 62 59">
        <path 
          d="M30.9932 48.5226L27.9492 45.7515C17.1377 35.9476 10 29.4817 10 21.5463C10 15.0804 15.0804 10 21.5463 10C25.1991 10 28.705 11.7005 30.9932 14.3876C33.2815 11.7005 36.7874 10 40.4402 10C46.9061 10 51.9865 15.0804 51.9865 21.5463C51.9865 29.4817 44.8488 35.9476 34.0372 45.7725L30.9932 48.5226Z" 
          fill={color} 
        />
      </svg>
    </div>
  );
}