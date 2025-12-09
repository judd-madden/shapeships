import React from 'react';

export const Spiral: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="64" 
    height="64" 
    viewBox="0 0 64 64" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M2 2L2 62L62 62L62 2L24 2L24 32L40 32" stroke="#FF86E4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
