// Centaur ship: Ark of Terror
// Green horizontal vessel with dual energy cores

import React from 'react';

export const ArkOfTerrorShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="110" 
    height="40" 
    viewBox="0 0 110 40" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="86" y="7" width="26" height="62" transform="rotate(90 86 7)" fill="black"/>
    <rect x="84" y="9" width="22" height="58" transform="rotate(90 84 9)" stroke="#00BD13" strokeOpacity="0.6" strokeWidth="4"/>
    <line x1="72" y1="20" x2="37" y2="20" stroke="#00BD13" strokeOpacity="0.6" strokeWidth="4"/>
    <path d="M20 2C29.9411 2 38 10.0589 38 20C38 29.9411 29.9411 38 20 38C10.0589 38 2 29.9411 2 20C2 10.0589 10.0589 2 20 2Z" fill="black" stroke="#00BD13" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M20 2V38" stroke="#00BD13" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M90 2C99.9411 2 108 10.0589 108 20C108 29.9411 99.9411 38 90 38C80.0589 38 72 29.9411 72 20C72 10.0589 80.0589 2 90 2Z" fill="black" stroke="#00BD13" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M90 2V38" stroke="#00BD13" strokeWidth="4" strokeMiterlimit="10"/>
  </svg>
);
