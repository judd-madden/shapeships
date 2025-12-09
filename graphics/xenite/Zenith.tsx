import React from 'react';

// Xenite - Zenith
// Three Z shapes in a row - 133×39px
// Yellow glow indicates damage/offensive function
export const ZenithShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="133" 
    height="39" 
    viewBox="0 0 133 39" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M2.5 2.5H36.5L2.5 36.5H36.5" stroke="#FCFF81" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M49.25 2.5H83.25L49.25 36.5H83.25" stroke="#FCFF81" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M96 2.5H130L96 36.5H130" stroke="#FCFF81" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
