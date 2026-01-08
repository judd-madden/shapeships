/**
 * Game Menu Button
 * Used on Game Screen for menu actions
 * States: Default, Hover, Awaiting Confirmation
 * 
 * If requiresConfirm is true:
 * - First click: Shows red background (confirmation state)
 * - Second click: Executes onClick handler
 * - Click elsewhere: Resets to default state
 */

import { useState, useEffect, useRef } from 'react';

interface GameMenuButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  requiresConfirm?: boolean; // Requires two clicks to activate (shows red on first click)
  className?: string;
  children: React.ReactNode;
}

export function GameMenuButton({ 
  onClick, 
  disabled = false,
  requiresConfirm = false,
  className = "", 
  children 
}: GameMenuButtonProps) {
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Handle click outside to reset confirmation state
  useEffect(() => {
    if (!awaitingConfirm) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setAwaitingConfirm(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [awaitingConfirm]);

  const handleClick = () => {
    if (disabled) return;

    if (requiresConfirm) {
      if (awaitingConfirm) {
        // Second click - execute action
        setAwaitingConfirm(false);
        onClick?.();
      } else {
        // First click - show confirmation state
        setAwaitingConfirm(true);
      }
    } else {
      // No confirmation needed - execute immediately
      onClick?.();
    }
  };

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      disabled={disabled}
      className={`
        ${awaitingConfirm ? 'bg-[#ff8282]' : 'bg-[#d4d4d4]'}
        content-stretch flex h-[50px] items-center justify-center 
        px-[30px] py-[19px] 
        relative rounded-[10px] 
        w-[210px]
        ${awaitingConfirm ? '' : 'hover:bg-white'}
        transition-colors
        cursor-pointer
        disabled:opacity-50
        disabled:cursor-not-allowed
        ${className}
      `}
    >
      <p 
        className="font-bold leading-[normal] relative shrink-0 text-[16px] text-black text-nowrap"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {awaitingConfirm ? 'Confirm?' : children}
      </p>
    </button>
  );
}