import React from 'react';

// Human - Tactical Cruiser
// Complex design with main triangle, small top triangle, and curved elements - 129×115px
export const TacticalCruiserShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="129" 
    height="115" 
    viewBox="0 0 129 115" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M64.5 23L110 101H19L64.5 23Z" fill="black"/>
    <path d="M22.4824 99H106.518L64.5 26.9688L22.4824 99Z" stroke="#FF5900" strokeOpacity="0.6" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M41.4658 43H86.5342L64 3.99707L41.4658 43Z" fill="black" stroke="#FF5900" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M3 98.5805C15.7006 113.806 36.2994 113.806 49 98.5805V98.4195C36.2994 83.1935 15.7006 83.1935 3 98.4195V98.5805Z" fill="black" stroke="#FF5900" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M79 98.5805C91.7006 113.806 112.299 113.806 125 98.5805V98.4195C112.299 83.1935 91.7006 83.1935 79 98.4195V98.5805Z" fill="black" stroke="#FF5900" strokeWidth="4" strokeMiterlimit="10"/>
  </svg>
);
