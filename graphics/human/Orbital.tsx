import React from 'react';

// Human - Orbital
// Hourglass/double triangle shape with cyan glow - 79×70px
export const OrbitalShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="79" 
    height="70" 
    viewBox="0 0 79 70" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M72.46 3L70.7334 5.99805L54.0254 35.002L70.7334 64.002L72.4609 67H6.53906L8.2666 64.002L24.9736 35.002L8.2666 5.99805L6.54004 3H72.46Z" fill="black" stroke="#62FFF6" strokeWidth="4" strokeMiterlimit="10"/>
  </svg>
);
