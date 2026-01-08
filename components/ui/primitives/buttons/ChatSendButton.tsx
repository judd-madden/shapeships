/**
 * Chat Send Button
 * Used in Game Screen chat to send messages
 * States: Default, Hover
 */

interface ChatSendButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function ChatSendButton({ 
  onClick, 
  disabled = false,
  className = "", 
  children 
}: ChatSendButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        bg-black
        content-stretch flex items-center justify-center 
        px-[15px] py-[8px] 
        relative rounded-[7px]
        hover:bg-[#212121]
        transition-colors
        cursor-pointer
        disabled:opacity-50
        disabled:cursor-not-allowed
        ${className}
      `}
    >
      <p 
        className="font-medium leading-[normal] relative shrink-0 text-[13px] text-nowrap"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {children}
      </p>
    </button>
  );
}
