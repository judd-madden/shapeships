/**
 * Action Button Small
 * Used on Game screens
 * States: Default (with hover), Selected (no hover)
 * Background color is configurable (based on ship color)
 * Text color can be black or white for legibility
 * Default: 2px black border only, hover changes to Grey 50
 * Selected: 2px black border + 3px white border (via box-shadow), no hover
 */

interface ActionButtonSmallProps {
  label: string;
  selected?: boolean;
  backgroundColor?: string; // Hex color for background
  textColor?: 'black' | 'white'; // Text color for legibility
  density?: 'desktop' | 'mobile';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function ActionButtonSmall({ 
  label,
  selected = false, 
  backgroundColor = '#D4D4D4', // Grey 20 default
  textColor = 'black',
  density = 'desktop',
  onClick, 
  disabled = false, 
  className = "" 
}: ActionButtonSmallProps) {
  const textColorClass = textColor === 'white' ? 'text-white' : 'text-black';
  const buttonDensityClass =
    density === 'mobile'
      ? 'h-[32px] w-full min-w-0'
      : 'h-[34px] w-full';
  const contentDensityClass = density === 'mobile' ? 'px-[10px] min-w-0 max-w-full' : 'px-[20px]';
  const textDensityClass = density === 'mobile' ? 'text-[12px] min-w-0 truncate' : 'text-[14px] text-nowrap';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${buttonDensityClass}
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
      <div className={`flex items-center justify-center ${contentDensityClass}`}>
        <p 
          className={`font-['Roboto'] font-normal leading-[normal] ${textDensityClass} ${textColorClass}`}
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {label}
        </p>
      </div>
    </button>
  );
}
