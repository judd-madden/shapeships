/**
 * Secondary Nav Item
 * States: Default, Hover, Selected
 */

interface SecondaryNavItemProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function SecondaryNavItem({ 
  label,
  selected = false, 
  onClick, 
  disabled = false, 
  className = "" 
}: SecondaryNavItemProps) {
  if (selected) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          bg-white
          content-stretch flex items-center justify-center 
          px-[20px] py-[10px] 
          relative rounded-[10px]
          cursor-pointer
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
      >
        <p 
          className="font-['Roboto'] font-bold leading-[normal] relative text-[18px] text-black text-nowrap"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {label}
        </p>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        bg-[#212121]
        content-stretch flex items-center justify-center 
        px-[20px] py-[10px] 
        relative rounded-[10px]
        group
        cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      <p 
        className="font-['Roboto'] font-bold leading-[normal] relative text-[18px] text-nowrap text-white group-hover:underline decoration-solid"
        style={{ 
          fontVariationSettings: "'wdth' 100",
          textUnderlinePosition: 'from-font'
        }}
      >
        {label}
      </p>
    </button>
  );
}