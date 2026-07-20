import React from 'react';
import { StarBirth } from '../StarBirth';
import { usePrefersReducedMotion } from '../../../game/display/shared/usePrefersReducedMotion';
import './solarPowerAnimations.css';

export const AnimatedStarBirth: React.FC<{ className?: string }> = ({ className }) => {
  const prefersReducedMotion = usePrefersReducedMotion();

  if (prefersReducedMotion) {
    return <StarBirth className={className} />;
  }

  return (
    <svg
      width="65"
      height="62"
      viewBox="0 0 65 62"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g className="ss-ancient-animated-star-birth__circle-a">
        <circle cx="32.4993" cy="21.3587" r="19.3587" stroke="#00BD13" strokeWidth="4" />
      </g>
      <g className="ss-ancient-animated-star-birth__circle-b">
        <circle cx="43.6413" cy="40.5133" r="19.3587" transform="rotate(90 43.6413 40.5133)" stroke="#00BD13" strokeWidth="4" />
      </g>
      <g className="ss-ancient-animated-star-birth__circle-c">
        <circle cx="21.3586" cy="40.5133" r="19.3587" transform="rotate(90 21.3586 40.5133)" stroke="#00BD13" strokeWidth="4" />
      </g>
    </svg>
  );
};
