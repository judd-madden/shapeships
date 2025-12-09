import React from 'react';

// Human - Starship
// Diamond/star shape with pink glow - 102×102px
export const StarshipShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="102" 
    height="102" 
    viewBox="0 0 102 102" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M39.1475 37.9619L38.8281 38.8281L37.9619 39.1475L5.78613 50.9971L37.9619 62.8525L38.8281 63.1719L39.1475 64.0381L50.998 96.2139L62.8525 64.0381L63.1719 63.1719L64.0381 62.8525L96.2148 50.9971L64.0381 39.1475L63.1719 38.8281L62.8525 37.9619L50.998 5.78516L39.1475 37.9619Z" fill="black" stroke="#FF86E4" strokeWidth="4" strokeMiterlimit="10"/>
  </svg>
);
