/**
 * Online Status Icon
 * Two states: online (green) and offline (gray)
 */

interface OnlineStatusIconProps {
  className?: string;
  status?: 'online' | 'offline';
}

export function OnlineStatusIcon({ className = "", status = 'online' }: OnlineStatusIconProps) {
  const fillColor = status === 'online' ? '#00BD13' : '#888888';
  
  return (
    <div className={`relative size-[22px] ${className}`}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22 22">
        <circle cx="11" cy="11" r="11" fill={fillColor} />
      </svg>
    </div>
  );
}
