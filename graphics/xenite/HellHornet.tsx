import React from 'react';

// Xenite - Hell Hornet
// Two "H" shapes representing dual stingers - 89×39px
// Red glow indicates offensive/damage function
export const HellHornetShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="89" 
    height="39" 
    viewBox="0 0 89 39" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M2.5 20.3496H36.5" stroke="#FF8282" strokeWidth="5" strokeLinejoin="round"/>
    <path d="M2.5 2.5V36.5" stroke="#FF8282" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M37.3496 2.5V36.5" stroke="#FF8282" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M51.7998 20.3496H85.7998" stroke="#FF8282" strokeWidth="5" strokeLinejoin="round"/>
    <path d="M51.7998 2.5V36.5" stroke="#FF8282" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M85.7998 2.5V36.5" stroke="#FF8282" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
