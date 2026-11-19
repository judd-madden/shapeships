/**
 * Menu Button
 * Used on Menu screens
 * Variants: Private, Public, Community, Community Outline, Join
 * States: Default, Hover, Selected, Active (join only)
 */

import { AnimatedEllipsisText } from '../AnimatedEllipsisText';

type MenuButtonVariant = 'private' | 'public' | 'community' | 'communityOutline' | 'join';

interface MenuButtonProps {
  variant: MenuButtonVariant;
  selected?: boolean;
  disabled?: boolean;
  active?: boolean; // For join variant - indicates a game is selected and button is clickable
  onClick?: () => void;
  className?: string;
  // Community Outline sizing and decoration; existing variants retain their sizing.
  leadingIcon?: React.ReactNode;
  outlineSize?: 'desktop' | 'compact' | 'responsive';
  children: React.ReactNode;
}

const variantStyles = {
  private: {
    default: 'bg-[var(--shapeships-pastel-purple)]',
    hover: 'border-[var(--shapeships-pastel-purple)]',
  },
  public: {
    default: 'bg-[var(--shapeships-pastel-green)]',
    hover: 'border-[var(--shapeships-pastel-green)]',
  },
  community: {
    default: 'bg-[var(--shapeships-pastel-blue)]',
    hover: 'border-[var(--shapeships-pastel-blue)]',
  },
  join: {
    default: 'bg-[var(--shapeships-grey-70)]',
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
  leadingIcon,
  outlineSize = 'desktop',
  children 
}: MenuButtonProps) {
  if (variant === 'communityOutline') {
    const sizeClasses = {
      desktop: 'h-[72px] w-[352px] px-[28px] text-[18px]',
      compact: 'h-[56px] w-[280px] px-[16px] text-[14px]',
      responsive: 'h-[56px] w-[280px] px-[16px] text-[14px] md:h-[72px] md:w-[352px] md:px-[28px] md:text-[18px]',
    };

    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`relative flex max-w-full items-center justify-center gap-[8px] rounded-[10px] border-2 border-shapeships-pastel-blue bg-black font-black uppercase leading-[normal] text-shapeships-pastel-blue transition-transform enabled:cursor-pointer enabled:hover:scale-105 disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-shapeships-pastel-purple ${sizeClasses[outlineSize]} ${className}`}
      >
        {leadingIcon && (
          <span aria-hidden="true" className="flex size-[24px] shrink-0 items-center justify-center">
            {leadingIcon}
          </span>
        )}
        <span className="shrink-0 text-nowrap">
          <AnimatedEllipsisText text={children} />
        </span>
      </button>
    );
  }

  const styles = variantStyles[variant];
  const baseWidthClass = 'w-[280px] max-w-full';
  
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
          ${baseWidthClass}
          before:absolute before:border-[3px] before:border-solid before:border-white before:inset-[-3px] before:pointer-events-none before:rounded-[13px]
          cursor-default
          disabled:cursor-pointer
          ${className}
        `}
      >
        <p 
          className="font-black leading-[normal] relative shrink-0 text-[18px] text-nowrap text-white"
        >
          <AnimatedEllipsisText text={children} />
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
          ${isActive ? 'bg-white' : 'bg-[var(--shapeships-grey-70)]'}
          content-stretch flex h-[72px] items-center justify-center 
          p-[20px] 
          relative rounded-[10px] 
          ${baseWidthClass}
          ${isActive ? 'hover:scale-105 cursor-pointer' : 'cursor-default'}
          transition-transform
          ${className}
        `}
      >
        <p 
          className="font-black leading-[normal] relative shrink-0 text-[18px] text-black text-nowrap"
        >
          <AnimatedEllipsisText text={children} />
        </p>
      </button>
    );
  }

  // Private, Public, and Community variants
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${disabled ? 'bg-[var(--shapeships-grey-70)]' : styles.default}
        content-stretch flex h-[72px] items-center justify-center 
        p-[20px] 
        relative rounded-[10px] 
        ${baseWidthClass}
        hover:scale-105
        transition-transform
        cursor-pointer
        disabled:cursor-pointer
        ${className}
      `}
    >
      <p 
        className="font-black leading-[normal] relative shrink-0 text-[18px] text-black text-nowrap"
      >
        <AnimatedEllipsisText text={children} />
      </p>
    </button>
  );
}
