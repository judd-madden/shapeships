import React from 'react';

export const SimulacrumAncient: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    width="52"
    height="68"
    viewBox="0 0 52 68"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <g opacity="0.8">
      <path d="M34 34L34 66" stroke="#00B6EF" strokeWidth="4" strokeLinecap="round" />
      <path d="M18 50L50 50" stroke="#00B6EF" strokeWidth="4" strokeLinecap="round" />
      <circle cx="34" cy="22" r="12" fill="black" stroke="#00B6EF" strokeWidth="4" />
    </g>
    <path d="M18 26L18 58" stroke="#00B6EF" strokeWidth="4" strokeLinecap="round" />
    <path d="M2 42L34 42" stroke="#00B6EF" strokeWidth="4" strokeLinecap="round" />
    <circle cx="18" cy="14" r="12" fill="black" stroke="#00B6EF" strokeWidth="4" />
  </svg>
);
