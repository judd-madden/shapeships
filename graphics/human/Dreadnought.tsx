import React from 'react';

// Human - Dreadnought
// Complex composite ship - 198×105px
export const DreadnoughtShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="198" 
    height="105" 
    viewBox="0 0 198 105" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="89" y="21" width="20" height="78" fill="black"/>
    <rect x="91" y="23" width="16" height="74" stroke="#DD0000" strokeOpacity="0.6" strokeWidth="4"/>
    <rect x="162" y="26" width="20" height="59" fill="black"/>
    <rect x="164" y="28" width="16" height="55" stroke="#DD0000" strokeOpacity="0.6" strokeWidth="4"/>
    <rect x="16" y="26" width="20" height="59" fill="black"/>
    <rect x="18" y="28" width="16" height="55" stroke="#DD0000" strokeOpacity="0.6" strokeWidth="4"/>
    <rect x="172" y="71" width="20" height="146" transform="rotate(90 172 71)" fill="black"/>
    <rect x="170" y="73" width="16" height="142" transform="rotate(90 170 73)" stroke="#DD0000" strokeOpacity="0.6" strokeWidth="4"/>
    <path d="M77 59V103H121V59H77Z" fill="black" stroke="#DD0000" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M149.466 98H194.534L172 58.9971L149.466 98Z" fill="black" stroke="#DD0000" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M3.46582 98H48.5342L26 58.9971L3.46582 98Z" fill="black" stroke="#DD0000" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M76.4658 43H121.534L99 3.99707L76.4658 43Z" fill="black" stroke="#DD0000" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M3 26.5805C15.7006 41.8065 36.2994 41.8065 49 26.5805V26.4195C36.2994 11.1935 15.7006 11.1935 3 26.4195V26.5805Z" fill="black" stroke="#DD0000" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M149 26.5805C161.701 41.8065 182.299 41.8065 195 26.5805V26.4195C182.299 11.1935 161.701 11.1935 149 26.4195V26.5805Z" fill="black" stroke="#DD0000" strokeWidth="4" strokeMiterlimit="10"/>
  </svg>
);
