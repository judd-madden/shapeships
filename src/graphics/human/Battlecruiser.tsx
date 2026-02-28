// Human ship: Battlecruiser
// Blue combat ship

import React from 'react';

export const BattlecruiserShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="183" 
    height="114" 
    viewBox="0 0 183 114" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="78" y="17" width="28" height="40" fill="black"/>
    <rect x="80" y="19" width="24" height="36" stroke="#00B6EF" strokeOpacity="0.6" strokeWidth="4"/>
    <rect x="157" y="53" width="20" height="131" transform="rotate(90 157 53)" fill="black"/>
    <rect x="155" y="55" width="16" height="127" transform="rotate(90 155 55)" stroke="#00B6EF" strokeOpacity="0.6" strokeWidth="4"/>
    <path d="M124.46 47L122.733 49.998L106.025 79.002L122.733 108.002L124.461 111H58.5391L60.2666 108.002L76.9736 79.002L60.2666 49.998L58.54 47H124.46Z" fill="black" stroke="#00B6EF" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M134.466 77H179.534L157 37.9971L134.466 77Z" fill="black" stroke="#00B6EF" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M3.46582 77H48.5342L26 37.9971L3.46582 77Z" fill="black" stroke="#00B6EF" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M69 15.5805C81.7006 30.8065 102.299 30.8065 115 15.5805V15.4195C102.299 0.1935 81.7006 0.1935 69 15.4195V15.5805Z" fill="black" stroke="#00B6EF" strokeWidth="4" strokeMiterlimit="10"/>
  </svg>
);
