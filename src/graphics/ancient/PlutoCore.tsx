import React from 'react';

interface PlutoCoreProps {
  className?: string;
}

export const PlutoCore: React.FC<PlutoCoreProps> = ({ className }) => (
  <svg
    width="44"
    height="74"
    viewBox="0 0 44 74"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M22 32L22 72" stroke="#9CFF84" strokeWidth="4" strokeLinecap="round"/>
    <path d="M2 52L42 52" stroke="#9CFF84" strokeWidth="4" strokeLinecap="round"/>
    <circle cx="22" cy="17" r="15" fill="black" stroke="#9CFF84" strokeWidth="4"/>
    <circle cx="22" cy="17" r="8" stroke="#9CFF84" strokeWidth="4"/>
  </svg>
);
