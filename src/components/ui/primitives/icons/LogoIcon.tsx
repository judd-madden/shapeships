/**
 * Logo Icon - Shapeships purple triangle logo
 */

interface LogoIconProps {
  className?: string;
}

export function LogoIcon({ className = "" }: LogoIconProps) {
  return (
    <div className={className}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 200 171">
        <path 
          d="M99.7781 14L179.556 150.015L99.7781 99.2174L20 150.015L99.7781 14Z" 
          fill="black" 
          stroke="#CD8CFF" 
          strokeWidth="13" 
          strokeMiterlimit="10"
        />
      </svg>
    </div>
  );
}
