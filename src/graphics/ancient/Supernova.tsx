import React from 'react';

export const Supernova: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    width="69"
    height="69"
    viewBox="0 0 69 69"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="12.105" y="12.105" width="44.7904" height="44.7904" stroke="#DD0000" strokeWidth="4" />
    <rect x="34.5" y="2.82843" width="44.7904" height="44.7904" transform="rotate(45 34.5 2.82843)" stroke="#DD0000" strokeWidth="4" />
  </svg>
);
