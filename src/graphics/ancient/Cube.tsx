import React from 'react';

export const Cube: React.FC<{ className?: string; highlighted?: boolean }> = ({
  className,
  highlighted = false,
}) => (
  <svg 
    width="74" 
    height="74" 
    viewBox="0 0 74 74" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M2 14.25L37 26.3928V72L2 59.8572V14.25Z" fill="#000000" stroke="#FFBB56" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M72 14.25L37 26.3928V72L72 59.8572V14.25Z" fill="#000000" stroke="#FFBB56" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M37 2L72 14.25L37 26.5L2 14.25L37 2Z" fill="#000000" stroke="#FFBB56" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    {highlighted && (
      <>
        <path d="M2 14.25L37 26.3928V72L2 59.8572V14.25Z" fill="var(--shapeships-pastel-orange)" opacity={0.3}/>
        <path d="M72 14.25L37 26.3928V72L72 59.8572V14.25Z" fill="var(--shapeships-pastel-orange)" opacity={0.3}/>
        <path d="M37 2L72 14.25L37 26.5L2 14.25L37 2Z" fill="var(--shapeships-pastel-orange)" opacity={0.3}/>
        <path d="M2 14.25L37 26.3928V72L2 59.8572V14.25Z" fill="none" stroke="#FFBB56" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M72 14.25L37 26.3928V72L72 59.8572V14.25Z" fill="none" stroke="#FFBB56" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M37 2L72 14.25L37 26.5L2 14.25L37 2Z" fill="none" stroke="#FFBB56" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      </>
    )}
  </svg>
);
