import React from 'react';

// Xenite - Asterite Face
// Square with two asterisks at top and mouth pattern at bottom - 110×110px
export const AsteriteFaceShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="110" 
    height="110" 
    viewBox="0 0 110 110" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="4.5" y="4.5" width="100.5" height="100.5" fill="black"/>
    <rect x="2.25" y="2.25" width="105" height="105" stroke="#2555FF" strokeOpacity="0.6" strokeWidth="4.5" strokeLinejoin="round"/>
    <path d="M89 23.75L66.5 46.25" stroke="#2555FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M66.5 23.75L89 46.25" stroke="#2555FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M77.7497 19.0901V50.9099" stroke="#2555FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M61.8398 35H93.6596" stroke="#2555FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M44 23.75L21.5 46.25" stroke="#2555FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21.5 23.75L44 46.25" stroke="#2555FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M32.7497 19.0901V50.9099" stroke="#2555FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16.8398 35H48.6596" stroke="#2555FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M42 76.5H69.75" stroke="#2555FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M69.75 61.5H39.75V91.5H69.75" stroke="#2555FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
