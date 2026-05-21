import type { ActionPanelViewModel, GameSessionActions } from '../../client/useGameSession';

interface MobileBottomTabsProps {
  vm: ActionPanelViewModel;
  actions: Pick<GameSessionActions, 'onActionPanelTabClick'>;
}

export function MobileBottomTabs({ vm, actions }: MobileBottomTabsProps) {
  const tabs = vm.tabs.filter((tab) => tab.visible && tab.tabId !== 'tab.menu');
  const tabsLocked = vm.tabInteractionLocked === true;

  return (
    <div className="shrink-0 w-full flex flex-col">
      <div className="flex items-center justify-end gap-[4px] px-[14px]">
        {tabs.map((tab) => {
          const selected = vm.activePanelId === tab.targetPanelId;

          return (
            <button
              key={tab.tabId}
              type="button"
              aria-pressed={selected}
              disabled={tabsLocked}
              onClick={() => actions.onActionPanelTabClick(tab.tabId)}
              className={`flex h-[34px] min-w-0 flex-1 items-center justify-center rounded-t-[7px] px-[10px] disabled:cursor-not-allowed disabled:opacity-50 ${
                selected
                  ? 'bg-[var(--shapeships-grey-70)] text-white'
                  : 'bg-[var(--shapeships-grey-90)] text-[var(--shapeships-grey-50)]'
              }`}
            >
              <span
                className="min-w-0 truncate text-[13px] font-bold leading-none"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      <div
        aria-label="Mobile bottom panel placeholder"
        className="h-[204px] w-full shrink-0 border-t border-[var(--shapeships-grey-70)] bg-black shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
      />
    </div>
  );
}
