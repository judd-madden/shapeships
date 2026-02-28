/**
 * Black Carrier Icon
 * Special treatment icon
 */

interface BlackCarrierIconProps {
  className?: string;
  color?: string;
}

export function BlackCarrierIcon({ className = "", color = "black" }: BlackCarrierIconProps) {
  return (
    <div className={`relative size-[24px] ${className}`}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 63 55">
        <path 
          d="M16.8892 2.07812H45.8785L60.3748 27.3252L45.8785 52.5756H16.8892L2.3962 27.3252L16.8892 2.07812Z" 
          stroke={color} 
          strokeWidth="4.15617" 
          strokeMiterlimit="10"
        />
      </svg>
    </div>
  );
}
