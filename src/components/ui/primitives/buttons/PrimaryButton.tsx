/**
 * Primary Button
 * Used on Login screens
 * States: Default, Hover
 */

interface PrimaryButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function PrimaryButton({ 
  onClick, 
  disabled = false, 
  className = "", 
  children 
}: PrimaryButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${disabled ? 'bg-[#555555]' : 'bg-white'}
        content-stretch flex items-center justify-center 
        px-[20px] py-[17px] 
        relative rounded-[10px] 
        shadow-[0px_0px_10px_0px_rgba(0,0,0,0.25)] 
        w-full
        hover:scale-[1.03]
        transition-transform
        cursor-pointer
        disabled:cursor-pointer
        ${className}
      `}
    >
      <p 
        className="font-['Roboto'] font-black leading-[normal] relative shrink-0 text-[22px] text-black text-nowrap"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {children}
      </p>
    </button>
  );
}