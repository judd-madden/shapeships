import React from 'react';

// Human - Commander
// Simple square - 48×48px
export const CommanderShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="48" 
    height="48" 
    viewBox="0 0 48 48" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M2 2V46H46V2H2Z" fill="black" stroke="#FFBB56" strokeWidth="4" strokeMiterlimit="10"/>
  </svg>
);
