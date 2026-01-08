/**
 * Open Full Icon
 */

interface OpenFullIconProps {
  className?: string;
  color?: string;
}

export function OpenFullIcon({ className = "", color = "white" }: OpenFullIconProps) {
  return (
    <div className={`relative size-[24px] ${className}`}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
        <path 
          d="M21 8.59V4C21 3.45 20.55 3 20 3L15.41 3C14.52 3 14.07 4.08 14.7 4.71L16.29 6.3L6.29 16.3L4.7 14.71C4.08 14.08 3 14.52 3 15.41L3 20C3 20.55 3.45 21 4 21H8.59C9.48 21 9.93 19.92 9.3 19.29L7.71 17.7L17.71 7.7L19.3 9.29C19.92 9.92 21 9.48 21 8.59Z" 
          fill={color} 
        />
      </svg>
    </div>
  );
}
