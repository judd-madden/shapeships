import React from 'react';

export const SimulacrumXenite: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    width="44"
    height="64"
    viewBox="0 0 44 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M37 7L7 37" stroke="#00B6EF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 7L37 37" stroke="#00B6EF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    <g opacity="0.8">
      <path d="M37 27L7 57" stroke="#00B6EF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 27L37 57" stroke="#00B6EF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
);
