import type { ActionPanelViewModel, GameSessionActions } from '../../client/useGameSession';

interface MobileBottomTabsProps {
  vm: ActionPanelViewModel;
  actions: GameSessionActions;
}

interface MobileBottomTabRenderItem {
  key: string;
  label: string;
  selected: boolean;
  disabled: boolean;
  tabId?: ActionPanelViewModel['tabs'][number]['tabId'];
}

export function MobileBottomTabs({ vm, actions }: MobileBottomTabsProps) {
  const tabsLocked = vm.tabInteractionLocked === true;
  const isSpectator = vm.menu.isSpectator === true;
  const isEndGame = vm.activePanelId === 'ap.end_of_game.result' || vm.endOfGame != null;
  const actionTab = vm.tabs.find((tab) => tab.tabId === 'tab.actions');
  const realActionVisible = actionTab?.visible === true;
  const shouldReserveActions = !isSpectator && !isEndGame && !realActionVisible;
  const catalogueTabs = vm.tabs.filter(
    (tab) => tab.visible && tab.tabId !== 'tab.menu' && tab.tabId !== 'tab.actions',
  );

  const tabs: MobileBottomTabRenderItem[] = [
    ...(realActionVisible && actionTab != null
      ? [
          {
            key: actionTab.tabId,
            label: actionTab.label,
            selected: vm.activePanelId === actionTab.targetPanelId,
            disabled: tabsLocked,
            tabId: actionTab.tabId,
          },
        ]
      : []),
    ...(shouldReserveActions
      ? [
          {
            key: 'tab.actions.reserved',
            label: 'Actions',
            selected: false,
            disabled: true,
          },
        ]
      : []),
    ...catalogueTabs.map((tab) => ({
      key: tab.tabId,
      label: tab.label,
      selected: vm.activePanelId === tab.targetPanelId,
      disabled: tabsLocked,
      tabId: tab.tabId,
    })),
  ];

  return (
    <div className="flex items-center justify-end gap-[4px] px-[14px]">
      {tabs.map((tab) => {
        const tabId = tab.tabId;
        const baseClasses = tab.selected
          ? 'bg-[var(--shapeships-grey-70)] text-white'
          : 'bg-[var(--shapeships-grey-90)] text-[var(--shapeships-grey-50)]';
        const interactionClasses = tab.disabled
          ? 'cursor-not-allowed opacity-80'
          : 'cursor-pointer';
        const handleClick = tabId == null
          ? undefined
          : () => actions.onActionPanelTabClick(tabId);

        return (
          <button
            key={tab.key}
            type="button"
            aria-pressed={tab.selected}
            disabled={tab.disabled}
            onClick={handleClick}
            className={`flex h-[34px] min-w-0 flex-1 items-center justify-center rounded-t-[7px] px-[10px] ${baseClasses} ${interactionClasses}`}
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
  );
}
