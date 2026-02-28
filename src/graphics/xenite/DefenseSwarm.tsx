import React from 'react';

// Xenite - Defense Swarm
// Triangle with three asterisks - 129×113px
// Green glow indicates defensive/healing function
export const DefenseSwarmShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="129" 
    height="113" 
    viewBox="0 0 129 113" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M64.5 110.25C65.3022 110.25 66.0438 109.823 66.4463 109.129L126.446 5.62891C126.85 4.93286 126.851 4.07407 126.449 3.37695C126.048 2.67983 125.305 2.25 124.5 2.25H4.5C3.69544 2.25 2.95244 2.67983 2.55078 3.37695C2.14913 4.07407 2.15021 4.93286 2.55371 5.62891L62.5537 109.129L62.6328 109.256C63.0489 109.875 63.7478 110.25 64.5 110.25Z" fill="black" stroke="#006316" strokeWidth="4.5" strokeMiterlimit="10" strokeLinejoin="round"/>
    <path d="M58.25 16.25L35.75 38.75" stroke="#00BD13" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M35.75 16.25L58.25 38.75" stroke="#00BD13" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M76.25 49.25L53.75 71.75" stroke="#00BD13" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M53.75 49.25L76.25 71.75" stroke="#00BD13" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M94.25 16.25L71.75 38.75" stroke="#00BD13" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M71.75 16.25L94.25 38.75" stroke="#00BD13" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
