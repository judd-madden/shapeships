import React from 'react';

// Xenite - Asterite
// Simple asterisk pattern - 41×41px
export const AsteriteShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="41" 
    height="41" 
    viewBox="0 0 41 41" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M32.6777 7.67773L7.67773 32.6777" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7.67773 7.67773L32.6777 32.6777" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20.1777 2.50007V37.8554" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2.5 20.1777H37.8553" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
