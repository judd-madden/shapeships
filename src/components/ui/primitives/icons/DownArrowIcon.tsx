interface DownArrowIconProps {
  className?: string;
  color?: string;
}

export function DownArrowIcon({ className = '', color = 'currentColor' }: DownArrowIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      width="10"
      height="12"
      viewBox="0 0 10 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4.928 11.36L0 6.432V4.496L4.208 8.704V0H5.648V8.704L9.856 4.496V6.432L4.928 11.36Z"
        fill={color}
      />
    </svg>
  );
}
