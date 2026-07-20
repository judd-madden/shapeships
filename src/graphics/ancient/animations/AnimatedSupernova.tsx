import React from 'react';
import { Supernova } from '../Supernova';
import { usePrefersReducedMotion } from '../../../game/display/shared/usePrefersReducedMotion';
import './solarPowerAnimations.css';

export const AnimatedSupernova: React.FC<{ className?: string }> = ({ className }) => {
  const prefersReducedMotion = usePrefersReducedMotion();

  if (prefersReducedMotion) {
    return <Supernova className={className} />;
  }

  return (
    <svg
      width="69"
      height="69"
      viewBox="0 0 69 69"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g className="ss-ancient-animated-supernova__square-a">
        <rect x="12.105" y="12.105" width="44.7904" height="44.7904" stroke="#DD0000" strokeWidth="4" />
      </g>
      <g className="ss-ancient-animated-supernova__square-b">
        <rect x="34.5" y="2.82843" width="44.7904" height="44.7904" transform="rotate(45 34.5 2.82843)" stroke="#DD0000" strokeWidth="4" />
      </g>
    </svg>
  );
};
