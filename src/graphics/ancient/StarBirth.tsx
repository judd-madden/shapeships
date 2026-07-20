import React from 'react';

export const StarBirth: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    width="65"
    height="62"
    viewBox="0 0 65 62"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="32.4993" cy="21.3587" r="19.3587" stroke="#00BD13" strokeWidth="4" />
    <circle cx="43.6413" cy="40.5133" r="19.3587" transform="rotate(90 43.6413 40.5133)" stroke="#00BD13" strokeWidth="4" />
    <circle cx="21.3586" cy="40.5133" r="19.3587" transform="rotate(90 21.3586 40.5133)" stroke="#00BD13" strokeWidth="4" />
  </svg>
);
