import React from 'react';

// Human - Science Vessel
// Complex geometric design with diamond center and various elements - 138×116px
export const ScienceVesselShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="138" 
    height="116" 
    viewBox="0 0 138 116" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect width="20" height="53.033" transform="matrix(-0.707107 0.707107 0.707107 0.707107 77.5 51)" fill="black"/>
    <rect y="2.82843" width="16" height="49.033" transform="matrix(-0.707107 0.707107 0.707107 0.707107 75.5 51.8284)" stroke="#FA00FF" strokeOpacity="0.6" strokeWidth="4"/>
    <rect x="59.8579" y="51" width="20" height="53.033" transform="rotate(45 59.8579 51)" fill="black"/>
    <rect x="59.8579" y="53.8284" width="16" height="49.033" transform="rotate(45 59.8579 53.8284)" stroke="#FA00FF" strokeOpacity="0.6" strokeWidth="4"/>
    <path d="M134.534 110.5H89.4658L112 71.4971L134.534 110.5Z" fill="black" stroke="#FA00FF" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M3 99.0805C15.7006 114.306 36.2994 114.306 49 99.0805V98.9195C36.2994 83.6935 15.7006 83.6935 3 98.9195V99.0805Z" fill="black" stroke="#FA00FF" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M80.8525 37.9619L81.1719 38.8281L82.0381 39.1475L114.214 50.9971L82.0381 62.8525L81.1719 63.1719L80.8525 64.0381L69.002 96.2139L57.1475 64.0381L56.8281 63.1719L55.9619 62.8525L23.7852 50.9971L55.9619 39.1475L56.8281 38.8281L57.1475 37.9619L69.002 5.78516L80.8525 37.9619Z" fill="black" stroke="#FA00FF" strokeWidth="4" strokeMiterlimit="10"/>
  </svg>
);
