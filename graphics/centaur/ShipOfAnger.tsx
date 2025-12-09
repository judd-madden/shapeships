// Centaur ship: Ship of Anger
// Pink/red horizontal vessel with dual energy cores

import React from 'react';

export const ShipOfAngerShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="70" 
    height="36" 
    viewBox="0 0 70 36" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M18 1.7998C26.947 1.7998 34.2002 9.05299 34.2002 18C34.2002 26.947 26.947 34.2002 18 34.2002C9.05299 34.2002 1.7998 26.947 1.7998 18C1.79981 9.05299 9.05299 1.79981 18 1.7998Z" fill="black" stroke="#FF8282" strokeWidth="3.6" strokeMiterlimit="10"/>
    <path d="M51.2998 1.7998C60.2468 1.7998 67.5 9.05299 67.5 18C67.5 26.947 60.2468 34.2002 51.2998 34.2002C42.3528 34.2002 35.0996 26.947 35.0996 18C35.0996 9.05299 42.3528 1.79981 51.2998 1.7998Z" fill="black" stroke="#FF8282" strokeWidth="3.6" strokeMiterlimit="10"/>
    <path d="M51.3 18H18" stroke="#FF8282" strokeWidth="3.6" strokeMiterlimit="10"/>
  </svg>
);
