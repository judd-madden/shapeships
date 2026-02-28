import React from 'react';

// Xenite - Xenite
// Simple X shape - 36×36px
// White glow indicates basic/neutral function
export const XeniteShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="36" 
    height="36" 
    viewBox="0 0 36 36" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M30.5 5.5L5.5 30.5" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5.5 5.5L30.5 30.5" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
