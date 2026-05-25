interface MobileTopNavProps {
  turnNumber: number;
}

export function MobileTopNav({ turnNumber }: MobileTopNavProps) {
  return (
    <div className="shrink-0 w-full">
      <div className="flex items-center justify-between w-full min-w-0">
        <button
          type="button"
          className="flex min-w-0 items-center gap-[4px] py-[14px] pl-[14px] pr-[8px] text-left text-white focus:outline-none"
        >
          <span className="truncate text-[15px] font-bold leading-none">SHAPESHIPS</span>
          <span aria-hidden="true" className="shrink-0 text-[14px] font-bold leading-none">
            &middot;
          </span>
          <span className="shrink-0 text-[14px] font-bold leading-none">Turn {turnNumber}</span>
        </button>

        <div className="flex shrink-0 items-center justify-end gap-[13px] pr-[14px] whitespace-nowrap">
          <button
            type="button"
            className="py-[15px] text-[14px] font-bold leading-none text-[var(--shapeships-grey-50)] focus:outline-none"
          >
            Chat
          </button>
          <button
            type="button"
            className="py-[15px] text-[14px] font-bold leading-none text-[var(--shapeships-grey-50)] focus:outline-none"
          >
            Battle Log
          </button>
          <button
            type="button"
            className="py-[15px] text-[14px] font-bold leading-none text-[var(--shapeships-grey-50)] focus:outline-none"
          >
            Menu
          </button>
        </div>
      </div>

      <div className="px-[14px] w-full">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white to-transparent opacity-70" />
      </div>
    </div>
  );
}
