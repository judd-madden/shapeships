/**
 * Primary Button
 * Used on Login screens
 * States: Default, Hover
 */

interface PrimaryButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  className?: string;
  children: React.ReactNode;
}

export function PrimaryButton({ 
  onClick, 
  disabled = false, 
  loading = false,
  loadingLabel,
  className = "", 
  children 
}: PrimaryButtonProps) {
  const isInactive = disabled || loading;
  const stateClasses = isInactive
    ? 'bg-[#555555] cursor-default'
    : 'bg-white hover:scale-[1.03] transition-transform cursor-pointer';

  return (
    <button
      onClick={onClick}
      disabled={isInactive}
      aria-busy={loading}
      className={`
        ${stateClasses}
        content-stretch flex items-center justify-center 
        px-[20px] py-[17px] 
        relative rounded-[10px] 
        shadow-[0px_0px_10px_0px_rgba(0,0,0,0.25)] 
        w-full
        ${className}
      `}
    >
      <p 
        className="font-['Roboto'] font-black leading-[normal] relative shrink-0 text-[22px] text-black text-nowrap"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {loading ? loadingLabel ?? children : children}
      </p>
    </button>
  );
}
