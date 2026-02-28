/**
 * Action Button (Large)
 * Used on Game screens
 * States: Default (with hover), Selected (no hover)
 * Background color is configurable (based on ship color)
 * Text color can be black or white for legibility
 * Default: 2px black border only, hover changes to Grey 50
 * Selected: 2px black border + 3px white border (via box-shadow), no hover
 */

interface ActionButtonProps {
  label: string;
  detail?: string;
  selected?: boolean;
  backgroundColor?: string; // Hex color for background
  textColor?: 'black' | 'white'; // Text color for legibility
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function ActionButton({ 
  label,
  detail,
  selected = false, 
  backgroundColor = '#D4D4D4', // Grey 20 default
  textColor = 'black',
  onClick, 
  disabled = false, 
  className = "" 
}: ActionButtonProps) {
  const textColorClass = textColor === 'white' ? 'text-white' : 'text-black';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        h-[50px] w-full
        rounded-[10px]
        border-2 border-black border-solid
        flex items-center justify-center
        cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed
        ${selected ? 'shadow-[0_0_0_3px_white]' : 'hover:!bg-[#888888]'}
        ${className}
      `}
      style={{ backgroundColor }}
    >
      <div className={`flex gap-[4px] items-center justify-center px-[20px] text-[16px] text-nowrap ${textColorClass}`}>
        <p 
          className="font-['Roboto'] font-bold leading-[normal]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {label}
        </p>
        {detail && (
          <p 
            className="font-['Roboto'] font-normal leading-[normal]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {detail}
          </p>
        )}
      </div>
    </button>
  );
}