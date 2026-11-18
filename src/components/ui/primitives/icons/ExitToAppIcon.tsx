interface ExitToAppIconProps {
  className?: string;
}

export function ExitToAppIcon({ className = '' }: ExitToAppIconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path d="M13.91 8.41L12.5 7L7.5 12L12.5 17L13.91 15.59L11.33 13L21 13V11L11.33 11L13.91 8.41ZM5 21L19 21C20.11 21 21 20.1 21 19V15H19V19H5L5 5L19 5L19 9H21L21 5C21 3.9 20.11 3 19 3L5 3C3.9 3 3 3.9 3 5L3 19C3 20.1 3.9 21 5 21Z"/>
    </svg>
  );
}
