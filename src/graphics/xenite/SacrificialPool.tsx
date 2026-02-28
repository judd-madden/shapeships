import React from 'react';

// Xenite - Sacrificial Pool
// Square ship with X and two arrows - 110×110px
// Red glow indicates sacrificial/destructive function
export const SacrificialPoolShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="110" 
    height="110" 
    viewBox="0 0 110 110" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="4.5" y="4.5" width="100.5" height="100.5" fill="black"/>
    <rect x="2.25" y="2.25" width="105" height="105" stroke="#DD0000" strokeOpacity="0.6" strokeWidth="4.5" strokeLinejoin="round"/>
    <path d="M66.5 23.75L44 46.25" stroke="#DD0000" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M44 23.75L66.5 46.25" stroke="#DD0000" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M51 90L33.3775 60L15.75 90" stroke="#DD0000" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21.75 81.75H45" stroke="#DD0000" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M26.25 74.25C26.3499 76.6315 28.4537 78.6132 29.1295 80.9093C30.5003 76.0654 29.2628 70.7945 30.8239 66C32.9324 70.489 33.7605 77.0315 34.3555 81.9114C34.6077 78.9277 35.4121 74.1961 35.6643 71.2169C35.7738 69.9048 35.9166 68.5208 36.7305 67.4559C37.5015 72.565 38.7628 77.6066 40.5 82.5" stroke="#DD0000" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M93.75 90L76.1275 60L58.5 90" stroke="#DD0000" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M64.5 81.75H87.75" stroke="#DD0000" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M69 74.25C69.0999 76.6315 71.2037 78.6132 71.8795 80.9093C73.2503 76.0654 72.0128 70.7945 73.5739 66C75.6824 70.489 76.5105 77.0315 77.1055 81.9114C77.3577 78.9277 78.1621 74.1961 78.4143 71.2169C78.5238 69.9048 78.6666 68.5208 79.4805 67.4559C80.2515 72.565 81.5128 77.6066 83.25 82.5" stroke="#DD0000" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
