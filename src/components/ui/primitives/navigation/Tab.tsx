/**
 * Tab
 * States: Default, Hover, Selected
 */

interface TabProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function Tab({ 
  label,
  selected = false, 
  onClick, 
  disabled = false, 
  className = "" 
}: TabProps) {
  const bgColor = selected ? '#555555' : '#212121'; // Grey 70 selected, Grey 90 default

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative rounded-tl-[10px] rounded-tr-[10px] w-full
        group
        cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      style={{ backgroundColor: bgColor }}
    >
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex items-center justify-center px-[20px] py-[10px] relative w-full">
          <p 
            className={`
              font-['Roboto'] font-bold leading-[normal] relative text-[18px] text-nowrap text-white
              ${!selected ? 'group-hover:underline decoration-solid' : ''}
            `}
            style={{ 
              fontVariationSettings: "'wdth' 100",
              textUnderlinePosition: 'from-font'
            }}
          >
            {label}
          </p>
        </div>
      </div>
    </button>
  );
}