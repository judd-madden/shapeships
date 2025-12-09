import React from 'react';

// Xenite - Oxite Face
// Square ship with face design (two X eyes and U mouth) - 110×110px
// Yellow glow indicates damage dealing function
export const OxiteFaceShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="110" 
    height="110" 
    viewBox="0 0 110 110" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="4.5" y="4.5" width="100.5" height="100.5" fill="black"/>
    <rect x="2.25" y="2.25" width="105" height="105" stroke="#FFC300" strokeOpacity="0.6" strokeWidth="4.5" strokeLinejoin="round"/>
    <path d="M84.75 27L69.75 42" stroke="#FFC400" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M69.75 27L84.75 42" stroke="#FFC400" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="77.75" cy="35" r="18.75" stroke="#FFC400" strokeWidth="4.5"/>
    <path d="M39.75 27L24.75 42" stroke="#FFC400" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M24.75 27L39.75 42" stroke="#FFC400" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="32.75" cy="35" r="18.75" stroke="#FFC400" strokeWidth="4.5"/>
    <path d="M42 76.5H69.75" stroke="#FFC400" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M69.75 61.5H39.75V91.5H69.75" stroke="#FFC400" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
