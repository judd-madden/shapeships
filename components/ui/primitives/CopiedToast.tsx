import type React from 'react';

interface CopiedToastProps {
  className?: string;
}

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

export function CopiedToast({ className }: CopiedToastProps) {
  return (
    <div
      className={cx(
        'pointer-events-none animate-[slideDown_0.3s_ease-in,fadeOut_0.3s_ease-out_4.7s_forwards]',
        className
      )}
      style={{
        backgroundColor: 'var(--shapeships-green)',
        paddingTop: '8px',
        paddingBottom: '8px',
        paddingLeft: '16px',
        paddingRight: '16px',
        borderRadius: '7px',
      }}
    >
      <p
        className="font-['Roboto',sans-serif] font-normal leading-[normal] text-[16px] text-black text-center text-nowrap"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        Copied!
      </p>
    </div>
  );
}
