import type { ReactNode } from 'react';

interface AnimatedEllipsisTextProps {
  text: ReactNode;
}

export function AnimatedEllipsisText({ text }: AnimatedEllipsisTextProps) {
  const hasTerminalEllipsis =
    typeof text === 'string' && text.endsWith('...') && !text.endsWith('....');

  if (!hasTerminalEllipsis) {
    return <>{text}</>;
  }

  return (
    <>
      {text.slice(0, -3)}
      <span className="ss-animatedEllipsisText-dot ss-animatedEllipsisText-dot--one">.</span>
      <span className="ss-animatedEllipsisText-dot ss-animatedEllipsisText-dot--two">.</span>
      <span className="ss-animatedEllipsisText-dot ss-animatedEllipsisText-dot--three">.</span>
    </>
  );
}
