// Human ship: Defender
// Green healing ship

import React from 'react';

export const DefenderShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="52" 
    height="32" 
    viewBox="0 0 52 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M3 15.5805C15.7006 30.8065 36.2994 30.8065 49 15.5805V15.4195C36.2994 0.1935 15.7006 0.1935 3 15.4195V15.5805Z" 
      fill="black" 
      stroke="#9CFF84" 
      strokeWidth="4" 
      strokeMiterlimit="10"
    />
  </svg>
);
