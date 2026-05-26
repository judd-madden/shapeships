import type React from 'react';
import { CloseIcon } from '../../../../components/ui/primitives/icons/CloseIcon';

interface MobileTakeoverShellProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  rightHeaderContent?: React.ReactNode;
  bodyClassName?: string;
  bodyScroll?: boolean;
}

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

export function MobileTakeoverShell({
  title,
  onClose,
  children,
  rightHeaderContent,
  bodyClassName,
  bodyScroll = true,
}: MobileTakeoverShellProps) {
  return (
    <section className="flex-1 min-h-0 px-[16px] pb-[16px]">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[10px] border border-[#555] bg-black">
        <div className="shrink-0 pl-[16px] pr-[8px]  pt-[10px]">
          <div className="flex min-h-[44px] items-center justify-between gap-[12px]">
            <p className="min-w-0 truncate text-[20px] font-black leading-none text-white">
              {title}
            </p>
            <div className="flex shrink-0 items-center gap-[10px]">
              {rightHeaderContent}
              <button
                type="button"
                onClick={onClose}
                className="flex min-h-[44px] items-center justify-center gap-[7px] rounded-[7px] px-[8px] text-[14px] font-bold leading-none text-white opacity-70 transition-opacity active:opacity-100"
                aria-label={`Close ${title}`}
              >
                <span>Close</span>
                <CloseIcon className="!size-[20px]" />
              </button>
            </div>
          </div>
        </div>
        <div
          className={cx(
            'min-h-0 flex-1',
            bodyScroll ? 'overflow-y-auto' : 'overflow-hidden',
            bodyClassName
          )}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
