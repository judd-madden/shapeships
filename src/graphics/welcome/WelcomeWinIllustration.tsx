import { useId } from 'react';

interface WelcomeWinIllustrationProps {
  className?: string;
}

export function WelcomeWinIllustration({ className = '' }: WelcomeWinIllustrationProps) {
  const id = `welcome-win-${useId().replace(/:/g, '')}`;
  return (
    <svg
      width="172"
      height="153"
      viewBox="0 0 172 153"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path d="M85.7848 30.5898L146.3 134.33H25.2698L85.7848 30.5898Z" fill="black"/>
      <mask id={`${id}-stroke0_6593_31162`} fill="white">
      <path d="M85.7848 30.5898L146.3 134.33H25.2698L85.7848 30.5898Z"/>
      </mask>
      <path d="M85.7848 30.5898L146.3 134.33H25.2698L85.7848 30.5898Z" strokeWidth="10.64" strokeMiterlimit="10" stroke="var(--shapeships-orange)" strokeOpacity="0.6" mask={`url(#${id}-stroke0_6593_31162)`}/>
      <path d="M85.1202 0L119.7 59.85H50.5402L85.1202 0Z" fill="black"/>
      <mask id={`${id}-stroke1_6593_31162`} fill="white">
      <path d="M85.1202 0L119.7 59.85H50.5402L85.1202 0Z"/>
      </mask>
      <path d="M85.1202 0L119.7 59.85H50.5402L85.1202 0Z" strokeWidth="10.64" strokeMiterlimit="10" stroke="var(--shapeships-orange)" mask={`url(#${id}-stroke1_6593_31162)`}/>
      <path d="M3.98992 131.112C20.8817 151.363 48.2781 151.363 65.1699 131.112V130.898C48.2781 110.647 20.8817 110.647 3.98992 130.898V131.112Z" fill="black" strokeWidth="5.32" strokeMiterlimit="10" stroke="var(--shapeships-orange)"/>
      <path d="M105.07 131.112C121.962 151.363 149.358 151.363 166.25 131.112V130.898C149.358 110.647 121.962 110.647 105.07 130.898V131.112Z" fill="black" strokeWidth="5.32" strokeMiterlimit="10" stroke="var(--shapeships-orange)"/>
    </svg>
  );
}
