import type React from 'react';
import { useEffect, useRef } from 'react';

interface LeftRailScrollAreaProps {
  children: React.ReactNode;
  outerClassName?: string;
  innerClassName?: string;
  stickToBottomOnChange?: boolean; // NEW
}

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

export function LeftRailScrollArea({
  children,
  outerClassName,
  innerClassName,
  stickToBottomOnChange,
}: LeftRailScrollAreaProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const wasNearBottomRef = useRef(true);

  // Track whether user is near bottom (don’t steal scroll if they’re reading up)
  useEffect(() => {
    if (!stickToBottomOnChange) return;

    const el = viewportRef.current;
    if (!el) return;

    const onScroll = () => {
      const thresholdPx = 24; // “near bottom” tolerance
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      wasNearBottomRef.current = distanceFromBottom <= thresholdPx;
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // initialize
    return () => el.removeEventListener('scroll', onScroll);
  }, [stickToBottomOnChange]);

  // On content change: if user was near bottom, jump to bottom
  useEffect(() => {
    if (!stickToBottomOnChange) return;
    if (!wasNearBottomRef.current) return;

    // Scroll sentinel into view; no animation
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [children, stickToBottomOnChange]);

  return (
    <div
      ref={viewportRef}
      className={cx('min-h-0 overflow-y-auto overflow-x-hidden break-words', outerClassName)}
    >
      <div className={cx('min-h-full flex flex-col', innerClassName)}>
        {children}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
