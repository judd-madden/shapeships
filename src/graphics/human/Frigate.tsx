import React from 'react';

// Human - Frigate
// Composite ship with rectangle, triangle, and lens - 52×88px
export const FrigateShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="52" 
    height="88" 
    viewBox="0 0 52 88" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="13" y="18" width="26" height="62" fill="black"/>
    <rect x="15" y="20" width="22" height="58" stroke="#FFC300" strokeOpacity="0.6" strokeWidth="4"/>
    <line x1="26" y1="23" x2="26" y2="58" stroke="#FFC300" strokeOpacity="0.6" strokeWidth="4"/>
    <path d="M3.46582 86H48.5342L26 46.9971L3.46582 86Z" fill="black" stroke="#FFC400" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M3 15.5805C15.7006 30.8065 36.2994 30.8065 49 15.5805V15.4195C36.2994 0.1935 15.7006 0.1935 3 15.4195V15.5805Z" fill="black" stroke="#FFC400" strokeWidth="4" strokeMiterlimit="10"/>
  </svg>
);
