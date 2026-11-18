import { useId } from 'react';

interface WelcomeSpeciesIllustrationProps {
  className?: string;
}

export function WelcomeSpeciesIllustration({ className = '' }: WelcomeSpeciesIllustrationProps) {
  const id = `welcome-species-${useId().replace(/:/g, '')}`;
  return (
    <svg
      width="165"
      height="165"
      viewBox="0 0 165 165"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path d="M0 13.3C0 5.95463 5.95461 0 13.3 0H80.4884V80.4884H0V13.3Z" fill="var(--shapeships-pastel-blue)"/>
      <path d="M0 84.5132H80.4884V165.002H13.3C5.95463 165.002 0 159.047 0 151.702V84.5132Z" fill="var(--shapeships-pastel-red)"/>
      <path d="M84.5117 0H151.7C159.045 0 165 5.95461 165 13.3V80.4884H84.5117V0Z" fill="var(--shapeships-pastel-green)"/>
      <path d="M84.5117 84.5132H165V151.702C165 159.047 159.045 165.002 151.7 165.002H84.5117V84.5132Z" fill="var(--shapeships-pastel-purple)"/>
      <path d="M27.0241 16.0977H54.2459L67.8584 39.8054L54.2459 63.5163H27.0241L13.4147 39.8054L27.0241 16.0977Z" fill="var(--shapeships-pastel-blue)" strokeWidth="4" strokeMiterlimit="10" stroke="black"/>
      <path d="M137.827 26.9316L111.444 53.3139" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" stroke="black"/>
      <path d="M111.444 26.9316L137.827 53.3139" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" stroke="black"/>
      <use href={`#${id}-stroke0_6593_31131`} fill="var(--shapeships-pastel-red)"/>
      <mask id={`${id}-stroke1_6593_31131`} fill="white">
      <use href={`#${id}-stroke0_6593_31131`}/>
      </mask>
      <path d="M67.8328 124.491C67.8328 139.874 55.3619 152.345 39.9784 152.345C24.5949 152.345 12.124 139.874 12.124 124.491C12.124 109.107 24.5949 96.6362 39.9784 96.6362C55.3619 96.6362 67.8328 109.107 67.8328 124.491Z" strokeWidth="6.58807" strokeMiterlimit="10" stroke="black" mask={`url(#${id}-stroke1_6593_31131)`}/>
      <use href={`#${id}-stroke2_6593_31131`} fill="var(--shapeships-pastel-red)"/>
      <mask id={`${id}-stroke3_6593_31131`} fill="white">
      <use href={`#${id}-stroke2_6593_31131`}/>
      </mask>
      <path d="M61.6425 124.491C61.6425 136.456 51.943 146.155 39.978 146.155C28.013 146.155 18.3135 136.456 18.3135 124.491C18.3135 112.526 28.013 102.826 39.978 102.826C51.943 102.826 61.6425 112.526 61.6425 124.491Z" strokeWidth="6.58807" strokeMiterlimit="10" stroke="black" mask={`url(#${id}-stroke3_6593_31131)`}/>
      <use href={`#${id}-stroke4_6593_31131`} fill="var(--shapeships-pastel-red)"/>
      <mask id={`${id}-stroke5_6593_31131`} fill="white">
      <use href={`#${id}-stroke4_6593_31131`}/>
      </mask>
      <path d="M38.7404 124.491C38.7404 128.593 35.4149 131.919 31.3126 131.919C27.2103 131.919 23.8848 128.593 23.8848 124.491C23.8848 120.389 27.2103 117.063 31.3126 117.063C35.4149 117.063 38.7404 120.389 38.7404 124.491Z" strokeWidth="6.58807" strokeMiterlimit="10" stroke="black" mask={`url(#${id}-stroke5_6593_31131)`}/>
      <use href={`#${id}-stroke6_6593_31131`} fill="var(--shapeships-pastel-red)"/>
      <mask id={`${id}-stroke7_6593_31131`} fill="white">
      <use href={`#${id}-stroke6_6593_31131`}/>
      </mask>
      <path d="M56.0725 124.491C56.0725 128.593 52.7469 131.919 48.6446 131.919C44.5424 131.919 41.2168 128.593 41.2168 124.491C41.2168 120.389 44.5424 117.063 48.6446 117.063C52.7469 117.063 56.0725 120.389 56.0725 124.491Z" strokeWidth="6.58807" strokeMiterlimit="10" stroke="black" mask={`url(#${id}-stroke7_6593_31131)`}/>
      <path d="M124.222 125.719L124.222 151.615" strokeWidth="4" strokeLinecap="round" stroke="black"/>
      <path d="M111.343 138.667H137.101" strokeWidth="4" strokeLinecap="round" stroke="black"/>
      <ellipse cx="124.222" cy="116.008" rx="9.65936" ry="9.71102" strokeWidth="4" stroke="black"/>
      <path d="M133.881 96.5859C133.881 101.949 129.557 106.297 124.222 106.297C118.887 106.297 114.562 101.949 114.562 96.5859" strokeWidth="4" stroke="black"/>
      <defs>
      <path id={`${id}-stroke0_6593_31131`} d="M39.9784 152.345C55.3619 152.345 67.8328 139.874 67.8328 124.491C67.8328 109.107 55.3619 96.6362 39.9784 96.6362C24.5949 96.6362 12.124 109.107 12.124 124.491C12.124 139.874 24.5949 152.345 39.9784 152.345Z"/>
      <path id={`${id}-stroke2_6593_31131`} d="M39.978 146.155C51.943 146.155 61.6425 136.456 61.6425 124.491C61.6425 112.526 51.943 102.826 39.978 102.826C28.013 102.826 18.3135 112.526 18.3135 124.491C18.3135 136.456 28.013 146.155 39.978 146.155Z"/>
      <path id={`${id}-stroke4_6593_31131`} d="M31.3126 131.919C35.4149 131.919 38.7404 128.593 38.7404 124.491C38.7404 120.389 35.4149 117.063 31.3126 117.063C27.2103 117.063 23.8848 120.389 23.8848 124.491C23.8848 128.593 27.2103 131.919 31.3126 131.919Z"/>
      <path id={`${id}-stroke6_6593_31131`} d="M48.6446 131.919C52.7469 131.919 56.0725 128.593 56.0725 124.491C56.0725 120.389 52.7469 117.063 48.6446 117.063C44.5424 117.063 41.2168 120.389 41.2168 124.491C41.2168 128.593 44.5424 131.919 48.6446 131.919Z"/>
      </defs>
    </svg>
  );
}
