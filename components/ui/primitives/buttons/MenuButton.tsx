/**
 * Menu Button
 * Used on Menu screens
 * Variants: Private, Public, Join
 * States: Default, Hover, Selected, Active (join only)
 */

type MenuButtonVariant = 'private' | 'public' | 'join';

interface MenuButtonProps {
  variant: MenuButtonVariant;
  selected?: boolean;
  disabled?: boolean;
  active?: boolean; // For join variant - indicates a game is selected and button is clickable
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
  active = false,
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

  // Join variant has special behavior with active state
  if (variant === 'join') {
    const isActive = active && !disabled;
    
    return (
      <button
        onClick={isActive ? onClick : undefined}
        disabled={disabled}
        className={`
          ${isActive ? 'bg-white' : 'bg-[#555555]'}
          content-stretch flex h-[72px] items-center justify-center 
          p-[20px] 
          relative rounded-[10px] 
          w-[280px]
          ${isActive ? 'hover:scale-105 cursor-pointer' : 'cursor-default'}
          transition-transform
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

  // Private and Public variants
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