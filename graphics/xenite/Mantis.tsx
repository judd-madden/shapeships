import React from 'react';

// Xenite - Mantis
// U-shaped ship like mantis claws - 42×39px
// Green glow indicates healing/defensive function
export const MantisShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="42" 
    height="39" 
    viewBox="0 0 42 39" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M39.5 36.5V2.5L21 21.3222L2.5 2.5V36.5" stroke="#9CFF84" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
