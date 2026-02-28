/**
 * Checkbox
 * States: Default, Selected
 */

interface CheckboxProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({ 
  checked, 
  onChange, 
  disabled = false, 
  className = "" 
}: CheckboxProps) {
  return (
    <button
      onClick={() => onChange?.(!checked)}
      disabled={disabled}
      className={`relative size-[30px] cursor-pointer ${className}`}
      aria-checked={checked}
      role="checkbox"
    >
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 30 30">
        {!checked && (
          <path 
            d="M23.75 6.25V23.75H6.25V6.25H23.75ZM23.75 3.75H6.25C4.875 3.75 3.75 4.875 3.75 6.25V23.75C3.75 25.125 4.875 26.25 6.25 26.25H23.75C25.125 26.25 26.25 25.125 26.25 23.75V6.25C26.25 4.875 25.125 3.75 23.75 3.75Z" 
            fill="white" 
          />
        )}
        {checked && (
          <path 
            d="M23.75 3.41675H6.25C4.8625 3.41675 3.75 4.54175 3.75 5.91675V23.4167C3.75 24.7917 4.8625 25.9167 6.25 25.9167H23.75C25.1375 25.9167 26.25 24.7917 26.25 23.4167V5.91675C26.25 4.54175 25.1375 3.41675 23.75 3.41675ZM12.5 20.9167L6.25 14.6667L8.0125 12.9042L12.5 17.3792L21.9875 7.89175L23.75 9.66675L12.5 20.9167Z" 
            fill="white" 
          />
        )}
      </svg>
    </button>
  );
}