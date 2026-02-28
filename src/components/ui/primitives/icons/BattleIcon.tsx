/**
 * Battle Icon
 */

interface BattleIconProps {
  className?: string;
  color?: string;
}

export function BattleIcon({ className = "", color = "#D5D5D5" }: BattleIconProps) {
  return (
    <div className={`relative size-[24px] ${className}`}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <path 
          d="M8 0L9.79611 5.52786H15.6085L10.9062 8.94427L12.7023 14.4721L8 11.0557L3.29772 14.4721L5.09383 8.94427L0.391548 5.52786H6.20389L8 0Z" 
          fill={color} 
        />
      </svg>
    </div>
  );
}