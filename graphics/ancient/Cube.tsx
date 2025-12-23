import React from 'react';

export const Cube: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="74" 
    height="74" 
    viewBox="0 0 74 74" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M2 14.25L37 26.3928V72L2 59.8572V14.25Z" stroke="#FFBB56" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M72 14.25L37 26.3928V72L72 59.8572V14.25Z" stroke="#FFBB56" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M37 2L72 14.25L37 26.5L2 14.25L37 2Z" stroke="#FFBB56" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
