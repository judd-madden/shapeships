/**
 * In-Chat Button
 * Used within Game Screen chat for quick actions
 * States: Default, Hover
 */

interface InChatButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function InChatButton({ 
  onClick, 
  disabled = false,
  className = "", 
  children 
}: InChatButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        bg-[#d4d4d4]
        content-stretch flex items-center justify-center 
        px-[20px] py-[9px] 
        relative rounded-[10px] 
        w-[118px]
        hover:bg-white
        transition-colors
        cursor-pointer
        disabled:opacity-50
        disabled:cursor-not-allowed
        ${className}
      `}
    >
      <p 
        className="font-normal leading-[normal] relative shrink-0 text-[14px] text-black text-nowrap"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {children}
      </p>
    </button>
  );
}
