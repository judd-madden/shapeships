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
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  requiresConfirm?: boolean; // Requires two clicks to activate (shows red on first click)
  confirmLabel?: string; // Custom label shown during confirmation state
  pendingLabel?: string; // Custom label shown while async click is in flight
  className?: string;
  children: React.ReactNode;
}

export function GameMenuButton({ 
  onClick, 
  disabled = false,
  requiresConfirm = false,
  confirmLabel = 'Confirm?',
  pendingLabel,
  className = "", 
  children 
}: GameMenuButtonProps) {
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Handle click outside to reset confirmation state
  useEffect(() => {
    if (!awaitingConfirm || isPending) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setAwaitingConfirm(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [awaitingConfirm, isPending]);

  const isDisabled = disabled || isPending;
  const isPromiseLike = (value: void | Promise<void>): value is Promise<void> => {
    return !!value && typeof (value as Promise<void>).then === 'function';
  };

  const runClickHandler = () => {
    const result = onClick?.();

    if (!pendingLabel || !isPromiseLike(result)) {
      return;
    }

    setIsPending(true);
    void result.finally(() => {
      if (isMountedRef.current) {
        setIsPending(false);
      }
    });
  };

  const buttonLabel = isPending
    ? pendingLabel
    : awaitingConfirm
      ? confirmLabel
      : children;

  const handleClick = () => {
    if (isDisabled) return;

    if (requiresConfirm) {
      if (awaitingConfirm) {
        // Second click - execute action
        setAwaitingConfirm(false);
        runClickHandler();
      } else {
        // First click - show confirmation state
        setAwaitingConfirm(true);
      }
    } else {
      // No confirmation needed - execute immediately
      runClickHandler();
    }
  };

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        ${awaitingConfirm ? 'bg-[#ff8282]' : 'bg-[#d4d4d4]'}
        content-stretch flex h-[50px] items-center justify-center 
        px-[30px] py-[19px] 
        relative rounded-[10px] 
        w-[210px]
        ${awaitingConfirm || isPending ? '' : 'hover:bg-white'}
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
        {buttonLabel}
      </p>
    </button>
  );
}
