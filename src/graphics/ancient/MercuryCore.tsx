// Ancient ship: Mercury Core
// Red geometric vessel with spherical core

import React from 'react';

// Ancient - Mercury Core
export const MercuryCore: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="44" 
    height="87" 
    viewBox="0 0 44 87" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M22 45L22 85" stroke="#FF8282" strokeWidth="4" strokeLinecap="round"/>
    <path d="M2 65H42" stroke="#FF8282" strokeWidth="4" strokeLinecap="round"/>
    <circle cx="22" cy="30" r="15" fill="black" stroke="#FF8282" strokeWidth="4"/>
    <path d="M37 0C37 8.28427 30.2843 15 22 15C13.7157 15 7 8.28427 7 0" stroke="#FF8282" strokeWidth="4"/>
  </svg>
);