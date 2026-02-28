import React from 'react';

// Human - Guardian with 2 charges
// Horizontal layout with square center and curved ends - 180×48px
export const GuardianShip2: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="180" 
    height="48" 
    viewBox="0 0 180 48" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="155" y="14" width="20" height="130" transform="rotate(90 155 14)" fill="black"/>
    <rect x="153" y="16" width="16" height="126" transform="rotate(90 153 16)" stroke="#2555FF" strokeOpacity="0.6" strokeWidth="4"/>
    <path d="M68 2V46H112V2H68Z" fill="black" stroke="#2555FF" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M3 23.5805C15.7006 38.8065 36.2994 38.8065 49 23.5805V23.4195C36.2994 8.1935 15.7006 8.1935 3 23.4195V23.5805Z" fill="black" stroke="#2555FF" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M130 23.5805C142.701 38.8065 163.299 38.8065 176 23.5805V23.4195C163.299 8.1935 142.701 8.1935 130 23.4195V23.5805Z" fill="black" stroke="#2555FF" strokeWidth="4" strokeMiterlimit="10"/>
  </svg>
);

// Human - Guardian with 1 charge
// Same as Guardian-2 but with damage pattern on left side
export const GuardianShip1: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="180" 
    height="48" 
    viewBox="0 0 180 48" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="155" y="14" width="20" height="130" transform="rotate(90 155 14)" fill="black"/>
    <rect x="153" y="16" width="16" height="126" transform="rotate(90 153 16)" stroke="#2555FF" strokeOpacity="0.6" strokeWidth="4"/>
    <path d="M68 2V46H112V2H68Z" fill="black" stroke="#2555FF" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M3 23.5805C15.7006 38.8065 36.2994 38.8065 49 23.5805V23.4195C36.2994 8.1935 15.7006 8.1935 3 23.4195V23.5805Z" fill="black" stroke="#2555FF" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M130 23.5805C142.701 38.8065 163.299 38.8065 176 23.5805V23.4195C163.299 8.1935 142.701 8.1935 130 23.4195V23.5805Z" fill="black" stroke="#2555FF" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M24.366 7.66254C32.7859 18.3871 38.4175 30.7953 39.2618 40.5276C32.6267 29.2944 23.7496 18.485 14.1294 9.40769C17.086 21.8719 19.039 27.5564 26.1618 41.005" stroke="#2555FF" strokeWidth="4" strokeMiterlimit="10" strokeLinejoin="round"/>
  </svg>
);

// Human - Guardian with 0 charges (depleted)
// Same as Guardian-1 but with damage patterns on both left and right sides
export const GuardianShip0: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="180" 
    height="48" 
    viewBox="0 0 180 48" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="155" y="14" width="20" height="130" transform="rotate(90 155 14)" fill="black"/>
    <rect x="153" y="16" width="16" height="126" transform="rotate(90 153 16)" stroke="#2555FF" strokeOpacity="0.6" strokeWidth="4"/>
    <path d="M68 2V46H112V2H68Z" fill="black" stroke="#2555FF" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M3 23.5805C15.7006 38.8065 36.2994 38.8065 49 23.5805V23.4195C36.2994 8.1935 15.7006 8.1935 3 23.4195V23.5805Z" fill="black" stroke="#2555FF" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M130 23.5805C142.701 38.8065 163.299 38.8065 176 23.5805V23.4195C163.299 8.1935 142.701 8.1935 130 23.4195V23.5805Z" fill="black" stroke="#2555FF" strokeWidth="4" strokeMiterlimit="10"/>
    <path d="M24.366 7.66254C32.7859 18.3871 38.4175 30.7953 39.2618 40.5276C32.6267 29.2944 23.7496 18.485 14.1294 9.40769C17.086 21.8719 19.039 27.5564 26.1618 41.005" stroke="#2555FF" strokeWidth="4" strokeMiterlimit="10" strokeLinejoin="round"/>
    <path d="M151.755 7.66254C160.175 18.3871 165.806 30.7953 166.65 40.5276C160.015 29.2944 151.138 18.485 141.518 9.40769C144.475 21.8719 146.428 27.5564 153.551 41.005" stroke="#2555FF" strokeWidth="4" strokeMiterlimit="10" strokeLinejoin="round"/>
  </svg>
);