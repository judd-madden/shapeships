/**
 * Game Vertical Background Line
 * Vertical divider line for game board layout
 */

interface GameVerticalLineProps {
  className?: string;
  color?: string;
}

export function GameVerticalLine({ 
  className = "", 
  color = "#212121" 
}: GameVerticalLineProps) {
  return (
    <svg 
      width="8" 
      height="2000" 
      viewBox="0 0 8 2000" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="8" height="2000" fill={color} />
    </svg>
  );
}
