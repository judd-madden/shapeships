import React from 'react';

export const SimulacrumCentaur: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    width="60"
    height="64"
    viewBox="0 0 60 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <g opacity="0.8">
      <path d="M40 22C49.9411 22 58 30.0589 58 40C58 49.9411 49.9411 58 40 58C30.0589 58 22 49.9411 22 40C22 30.0589 30.0589 22 40 22Z" stroke="#00B6EF" strokeWidth="4" strokeMiterlimit="10" />
      <path d="M40 22V58" stroke="#00B6EF" strokeWidth="4" strokeMiterlimit="10" />
    </g>
    <path d="M20 8C29.9411 8 38 16.0589 38 26C38 35.9411 29.9411 44 20 44C10.0589 44 2 35.9411 2 26C2 16.0589 10.0589 8 20 8Z" fill="black" stroke="#00B6EF" strokeWidth="4" strokeMiterlimit="10" />
    <path d="M20 8V44" stroke="#00B6EF" strokeWidth="4" strokeMiterlimit="10" />
  </svg>
);
