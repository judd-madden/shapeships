import React from 'react';

export const UranusCore: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="70" 
    height="74" 
    viewBox="0 0 70 74" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M35 42L35 2" stroke="#62FFF6" strokeWidth="4" strokeLinecap="round"/>
    <path d="M55 22L15 22" stroke="#62FFF6" strokeWidth="4" strokeLinecap="round"/>
    <circle cx="35" cy="57" r="15" transform="rotate(180 35 57)" fill="black" stroke="#62FFF6" strokeWidth="4"/>
    <path d="M-1.31134e-06 7C8.28427 7 15 13.7157 15 22C15 30.2843 8.28427 37 0 37" stroke="#62FFF6" strokeWidth="4"/>
    <path d="M70 7C61.7157 7 55 13.7157 55 22C55 30.2843 61.7157 37 70 37" stroke="#62FFF6" strokeWidth="4"/>
    <path d="M70 14C65.5817 14 62 17.5817 62 22C62 26.4183 65.5817 30 70 30" stroke="#62FFF6" strokeWidth="4"/>
    <path d="M-6.99382e-07 30C4.41828 30 8 26.4183 8 22C8 17.5817 4.41828 14 0 14" stroke="#62FFF6" strokeWidth="4"/>
  </svg>
);
