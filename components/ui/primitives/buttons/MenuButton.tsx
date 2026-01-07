/**
 * Menu Button
 * Used on Menu screens
 * Variants: Private, Public, Join
 * States: Default, Hover, Selected
 */

type MenuButtonVariant = 'private' | 'public' | 'join';

interface MenuButtonProps {
  variant: MenuButtonVariant;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}

const variantStyles = {
  private: {
    default: 'bg-[#CD8CFF]',
    hover: 'border-[#CD8CFF]',
  },
  public: {
    default: 'bg-[#9CFF84]',
    hover: 'border-[#9CFF84]',
  },
  join: {
    default: 'bg-[#555555]',
    hover: 'border-white',
  },
};

export function MenuButton({ 
  variant, 
  selected = false, 
  disabled = false, 
  onClick, 
  className = "", 
  children 
}: MenuButtonProps) {
  const styles = variantStyles[variant];
  
  if (selected) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          bg-black
          content-stretch flex h-[72px] items-center justify-center 
          p-[20px] 
          relative rounded-[10px] 
          w-[280px]
          before:absolute before:border-[3px] before:border-solid before:border-white before:inset-[-3px] before:pointer-events-none before:rounded-[13px]
          cursor-default
          disabled:cursor-pointer
          ${className}
        `}
      >
        <p 
          className="font-['Roboto'] font-black leading-[normal] relative shrink-0 text-[18px] text-nowrap text-white"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {children}
        </p>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${disabled ? 'bg-[#555555]' : styles.default}
        content-stretch flex h-[72px] items-center justify-center 
        p-[20px] 
        relative rounded-[10px] 
        w-[280px]
        hover:scale-105
        transition-transform
        cursor-pointer
        disabled:cursor-pointer
        ${className}
      `}
    >
      <p 
        className="font-['Roboto'] font-black leading-[normal] relative shrink-0 text-[18px] text-black text-nowrap"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {children}
      </p>
    </button>
  );
}