import React from 'react';

// Human - Fighter
// Simple triangle - 52×45px
export const FighterShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="52" 
    height="45" 
    viewBox="0 0 52 45" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M3.46582 43H48.5342L26 3.99707L3.46582 43Z" fill="black" stroke="#FF8282" strokeWidth="4" strokeMiterlimit="10"/>
  </svg>
);
