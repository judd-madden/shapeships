import { useId } from 'react';

interface WelcomeBuildFleetIllustrationProps {
  className?: string;
}

export function WelcomeBuildFleetIllustration({ className = '' }: WelcomeBuildFleetIllustrationProps) {
  const id = `welcome-build-fleet-${useId().replace(/:/g, '')}`;
  return (
    <svg
      width="171"
      height="153"
      viewBox="0 0 171 153"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path d="M87.1114 0L121.691 59.85H52.5314L87.1114 0Z" fill="black"/>
      <mask id={`${id}-stroke0_6593_31161`} fill="white">
      <path d="M87.1114 0L121.691 59.85H52.5314L87.1114 0Z"/>
      </mask>
      <path d="M87.1114 0L121.691 59.85H52.5314L87.1114 0Z" strokeWidth="10.64" strokeMiterlimit="10" stroke="var(--shapeships-pastel-red)" mask={`url(#${id}-stroke0_6593_31161)`}/>
      <path d="M3.98992 131.112C20.8817 151.363 48.2781 151.363 65.1699 131.112V130.898C48.2781 110.647 20.8817 110.647 3.98992 130.898V131.112Z" fill="black" strokeWidth="5.32" strokeMiterlimit="10" stroke="var(--shapeships-pastel-green)"/>
      <path d="M104.99 131.112C121.882 151.363 149.278 151.363 166.17 131.112V130.898C149.278 110.647 121.882 110.647 104.99 130.898V131.112Z" fill="black" strokeWidth="5.32" strokeMiterlimit="10" stroke="var(--shapeships-pastel-green)"/>
    </svg>
  );
}
