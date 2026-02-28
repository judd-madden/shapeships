import React from 'react';

// Xenite - Antlion with 1 charge
// Simple triangle outline with horizontal line - 45×39px
export const AntlionShip1: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="45" 
    height="39" 
    viewBox="0 0 45 39" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M42.5 36.5L22.5028 2.5L2.5 36.5" stroke="#FFBB56" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9.30859 27.1504H35.6916" stroke="#FFBB56" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Xenite - Antlion with 0 charges (depleted)
// Triangle with horizontal line and internal flame pattern - 45×39px
export const AntlionShip0: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="45" 
    height="39" 
    viewBox="0 0 45 39" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M42.5 36.5L22.5028 2.5L2.5 36.5" stroke="#FFBB56" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9.30859 27.1504H35.6916" stroke="#FFBB56" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14.415 18.6498C14.5285 21.3489 16.9156 23.5947 17.6826 26.197C19.238 20.7072 17.8338 14.7336 19.6053 9.2998C21.9979 14.3873 22.9376 21.8021 23.6127 27.3327C23.899 23.9512 24.8117 18.5887 25.098 15.2123C25.2222 13.7253 25.3842 12.1567 26.3078 10.9498C27.1827 16.7401 28.6139 22.454 30.5853 27.9998" stroke="#FFBB56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);