import React from 'react';

// Xenite - Evolver
// Square with arrow pattern - 39×39px
// Purple glow indicates evolution/upgrade function
export const EvolverShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="39" 
    height="39" 
    viewBox="0 0 39 39" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M5.0498 19.5H36.4998" stroke="#CD8CFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M36.5 2.5H2.5V36.5H36.5" stroke="#CD8CFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
