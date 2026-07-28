interface MusicIconProps {
  className?: string;
}

export function MusicIcon({ className = '' }: MusicIconProps) {
  return (
    <svg
      width="37"
      height="31"
      viewBox="0 0 37 31"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path d="M10.0299 0V17.6358C9.04358 17.0675 7.90687 16.7164 6.68657 16.7164C2.99224 16.7164 0 19.7087 0 23.403C0 27.0973 2.99224 30.0896 6.68657 30.0896C10.3809 30.0896 13.3731 27.0973 13.3731 23.403V6.68657H20.0597V0H10.0299Z" />
      <path d="M26.9107 0V17.6358C25.9244 17.0675 24.7877 16.7164 23.5674 16.7164C19.8731 16.7164 16.8809 19.7087 16.8809 23.403C16.8809 27.0973 19.8731 30.0896 23.5674 30.0896C27.2618 30.0896 30.254 27.0973 30.254 23.403V6.68657H36.9406V0H26.9107Z" />
    </svg>
  );
}
