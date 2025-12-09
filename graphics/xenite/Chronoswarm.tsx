import React from 'react';

// Xenite - Chronoswarm
// Large rectangular ship with asterisks and lightning bolts - 153×142px
// Special ship with pink glow (Pink Dice reminder)
export const ChronoswarmShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="153" 
    height="142" 
    viewBox="0 0 153 142" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="4.5" y="4.5" width="143.25" height="132.75" fill="black"/>
    <rect x="2.25" y="2.25" width="147.75" height="137.25" stroke="#FA00FF" strokeOpacity="0.6" strokeWidth="4.5" strokeLinejoin="round"/>
    <path d="M19.5 93H49.5L19.5 123H49.5" stroke="#FA00FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M60.75 93H90.75L60.75 123H90.75" stroke="#FA00FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M102 93H132L102 123H132" stroke="#FA00FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M46.25 53.75L23.75 76.25" stroke="#FA00FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M23.75 53.75L46.25 76.25" stroke="#FA00FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M87.5 53.75L65 76.25" stroke="#FA00FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M65 53.75L87.5 76.25" stroke="#FA00FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M128.75 53.75L106.25 76.25" stroke="#FA00FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M106.25 53.75L128.75 76.25" stroke="#FA00FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M46.25 18.5L23.75 41" stroke="#FA00FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M23.75 18.5L46.25 41" stroke="#FA00FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M87.5 18.5L65 41" stroke="#FA00FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M65 18.5L87.5 41" stroke="#FA00FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M128.75 18.5L106.25 41" stroke="#FA00FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M106.25 18.5L128.75 41" stroke="#FA00FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
