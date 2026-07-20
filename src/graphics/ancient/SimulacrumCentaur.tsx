import React from 'react';

export const SimulacrumCentaur: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    width="60"
    height="54"
    viewBox="0 0 60 54"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <g opacity="0.8">
      <path d="M40 16C49.9411 16 58 24.0589 58 34C58 43.9411 49.9411 52 40 52C30.0589 52 22 43.9411 22 34C22 24.0589 30.0589 16 40 16Z" stroke="#00B6EF" strokeWidth="4" strokeMiterlimit="10" />
      <path d="M40 16V52" stroke="#00B6EF" strokeWidth="4" strokeMiterlimit="10" />
    </g>
    <path d="M20 2C29.9411 2 38 10.0589 38 20C38 29.9411 29.9411 38 20 38C10.0589 38 2 29.9411 2 20C2 10.0589 10.0589 2 20 2Z" fill="black" stroke="#00B6EF" strokeWidth="4" strokeMiterlimit="10" />
    <path d="M20 2V38" stroke="#00B6EF" strokeWidth="4" strokeMiterlimit="10" />
  </svg>
);
