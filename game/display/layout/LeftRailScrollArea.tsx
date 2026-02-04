import type React from 'react';

interface LeftRailScrollAreaProps {
  children: React.ReactNode;
  outerClassName?: string; // viewport styling (height/padding/etc)
  innerClassName?: string; // content wrapper styling (justify-end/gap/etc)
}

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

export function LeftRailScrollArea({ children, outerClassName, innerClassName }: LeftRailScrollAreaProps) {
  return (
    <div
      className={cx(
        'min-h-0 overflow-y-auto overflow-x-hidden break-words',
        outerClassName
      )}
    >
      <div className={cx('min-h-full flex flex-col', innerClassName)}>
        {children}
      </div>
    </div>
  );
}
