import React from 'react';

// Human - Interceptor with 1 charge
// Diamond/kite shape - 73×63px
export const InterceptorShip1: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="73" 
    height="63" 
    viewBox="0 0 73 63" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M36.4205 3.95309L66.9205 55.9531L36.4205 36.5326L5.92047 55.9531L36.4205 3.95309Z" fill="black" stroke="#CD8CFF" strokeWidth="4" strokeMiterlimit="10"/>
  </svg>
);

// Human - Interceptor with 0 charges (depleted)
// Diamond/kite shape with energy dissipation pattern - 73×63px
export const InterceptorShip0: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="73" 
    height="63" 
    viewBox="0 0 73 63" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M36.4205 3.95309L66.9205 55.9531L36.4205 36.5326L5.92047 55.9531L36.4205 3.95309Z" fill="black" stroke="#CD8CFF" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M17.9205 25.647C23.7828 19.169 32.6599 15.5214 41.4031 15.994C34.1506 20.7316 28.2437 27.4931 24.5365 35.3056C34.8038 34.1713 44.8423 31.0296 53.9205 26.1252C49.454 32.403 44.9931 38.6753 40.5266 44.9531" stroke="#CD8CFF" strokeWidth="4" strokeMiterlimit="10" strokeLinejoin="round"/>
  </svg>
);