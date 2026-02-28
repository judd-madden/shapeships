/**
 * Radio Button
 * States: Default, Selected
 */

interface RadioButtonProps {
  selected: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  color?: 'green' | 'white'; // Color variant for selected state
}

export function RadioButton({ 
  selected, 
  onClick, 
  disabled = false, 
  className = "",
  color = 'green'
}: RadioButtonProps) {
  const selectedColor = color === 'white' ? 'white' : '#9CFF84';
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative size-[40px] cursor-pointer ${className}`}
      aria-checked={selected}
      role="radio"
    >
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 40 40">
        {!selected && (
          <path 
            d="M20 3.33333C10.8 3.33333 3.33333 10.8 3.33333 20C3.33333 29.2 10.8 36.6667 20 36.6667C29.2 36.6667 36.6667 29.2 36.6667 20C36.6667 10.8 29.2 3.33333 20 3.33333ZM20 33.3333C12.6333 33.3333 6.66667 27.3667 6.66667 20C6.66667 12.6333 12.6333 6.66667 20 6.66667C27.3667 6.66667 33.3333 12.6333 33.3333 20C33.3333 27.3667 27.3667 33.3333 20 33.3333Z" 
            fill="white" 
          />
        )}
        {selected && (
          <>
            <path 
              d="M20.0002 3.33325C10.8002 3.33325 3.3335 10.7999 3.3335 19.9999C3.3335 29.1999 10.8002 36.6666 20.0002 36.6666C29.2002 36.6666 36.6668 29.1999 36.6668 19.9999C36.6668 10.7999 29.2002 3.33325 20.0002 3.33325ZM20.0002 33.3333C12.6335 33.3333 6.66683 27.3666 6.66683 19.9999C6.66683 12.6333 12.6335 6.66659 20.0002 6.66659C27.3668 6.66659 33.3335 12.6333 33.3335 19.9999C33.3335 27.3666 27.3668 33.3333 20.0002 33.3333Z" 
              fill={selectedColor} 
            />
            <path 
              d="M19.9998 28.3334C24.6022 28.3334 28.3332 24.6025 28.3332 20.0001C28.3332 15.3977 24.6022 11.6667 19.9998 11.6667C15.3975 11.6667 11.6665 15.3977 11.6665 20.0001C11.6665 24.6025 15.3975 28.3334 19.9998 28.3334Z" 
              fill={selectedColor} 
            />
          </>
        )}
      </svg>
    </button>
  );
}