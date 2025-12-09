import React from 'react';

// Xenite - Oxite
// Circle with X inside - 47×47px
// White glow indicates basic/neutral function
export const OxiteShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="47" 
    height="47" 
    viewBox="0 0 47 47" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M31.515 15.1514L15.1514 31.515" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15.1514 15.1514L31.515 31.515" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="23.3333" cy="23.3333" r="20.8333" stroke="white" strokeWidth="5"/>
  </svg>
);
