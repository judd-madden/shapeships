// Centaur ship: Ship of Fear
// Green vessel with vertical dividing line

import React from 'react';

export const ShipOfFearShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="36" 
    height="36" 
    viewBox="0 0 36 36" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M18 1.7998C26.947 1.7998 34.2002 9.05299 34.2002 18C34.2002 26.947 26.947 34.2002 18 34.2002C9.05299 34.2002 1.7998 26.947 1.7998 18C1.7998 9.05299 9.05299 1.7998 18 1.7998Z" fill="black" stroke="#9CFF84" strokeWidth="3.6" strokeMiterlimit="10"/>
    <path d="M18 1.7998V34.1998" stroke="#9CFF84" strokeWidth="3.6" strokeMiterlimit="10"/>
  </svg>
);
