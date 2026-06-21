interface MobileTopNavProps {
  turnLabel: string;
  isGameOver: boolean;
  activeTakeover: 'chat' | 'battleLog' | 'menu' | null;
  unreadChatCount?: number;
  onReturnToBoard: () => void;
  onOpenChat: () => void;
  onOpenBattleLog: () => void;
  onOpenMenu: () => void;
}

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

export function MobileTopNav({
  turnLabel,
  isGameOver,
  activeTakeover,
  unreadChatCount = 0,
  onReturnToBoard,
  onOpenChat,
  onOpenBattleLog,
  onOpenMenu,
}: MobileTopNavProps) {
  const boardActive = activeTakeover === null;
  const showUnreadChatBubble = unreadChatCount > 0 && activeTakeover !== 'chat';
  const displayedUnreadChatCount = Math.min(99, unreadChatCount);

  function navItemClass(isActive: boolean) {
    return cx(
      'py-[15px] text-[14px] font-bold leading-none focus:outline-none',
      isActive ? 'text-white' : 'text-[var(--shapeships-grey-50)]'
    );
  }

  return (
    <div className="shrink-0 w-full">
      <div className="flex items-center justify-between w-full min-w-0">
        <button
          type="button"
          onClick={onReturnToBoard}
          className={cx(
            'flex min-w-0 items-center gap-[4px] py-[14px] pl-[14px] pr-[8px] text-left focus:outline-none',
            boardActive ? 'text-white' : 'text-[var(--shapeships-grey-50)]'
          )}
        >
          <span className="truncate text-[15px] font-bold leading-none">SHAPESHIPS</span>
          <span
            className={cx(
              'flex shrink-0 items-center gap-[4px]',
              isGameOver && 'max-[370px]:hidden'
            )}
          >
            <span aria-hidden="true" className="shrink-0 text-[14px] font-bold leading-none">
              &middot;
            </span>
            <span className="shrink-0 text-[14px] font-bold leading-none">{turnLabel}</span>
          </span>
        </button>

        <div className="flex shrink-0 items-center justify-end gap-[13px] pr-[14px] whitespace-nowrap">
          <button
            type="button"
            onClick={onOpenChat}
            className={navItemClass(activeTakeover === 'chat')}
          >
            <span className="inline-flex items-center gap-[4px]">
              <span>Chat</span>
              {showUnreadChatBubble ? (
                <span className="rounded-[99px] bg-[var(--shapeships-grey-50)] px-[4px] py-[2px] text-[11px] font-bold leading-none text-[var(--shapeships-black)]">
                  {displayedUnreadChatCount}
                </span>
              ) : null}
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenBattleLog}
            className={navItemClass(activeTakeover === 'battleLog')}
          >
            Battle Log
          </button>
          <button
            type="button"
            onClick={onOpenMenu}
            className={navItemClass(activeTakeover === 'menu')}
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
