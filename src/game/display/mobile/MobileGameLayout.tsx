import { useEffect, useState } from 'react';
import type {
  ActionPanelViewModel,
  BoardViewModel,
  BottomActionRailViewModel,
  GameSessionActions,
  HudViewModel,
  LeftRailViewModel,
} from '../../client/useGameSession';
import type { ShipDefId } from '../../types/ShipTypes.engine';
import { MobileBoardView } from './MobileBoardView';
import { MobileBottomPhase } from './MobileBottomPhase';
import { MobileBottomTabs } from './MobileBottomTabs';
import { MobileActionPanel } from './actionPanel/MobileActionPanel';
import { MobileShipModal } from './actionPanel/MobileShipModal';
import { MobileSpeciesConfirmPhase, MobileSpeciesSelectionView } from './MobileSpeciesSelectionView';
import { MobileTopNav } from './MobileTopNav';

interface MobileGameLayoutProps {
  hudVm: HudViewModel;
  boardVm: BoardViewModel;
  leftRailVm: LeftRailViewModel;
  bottomActionRailVm: BottomActionRailViewModel;
  actionPanelVm: ActionPanelViewModel;
  actions: GameSessionActions;
}

const CATALOGUE_PANEL_IDS = new Set<ActionPanelViewModel['activePanelId']>([
  'ap.catalog.ships.human',
  'ap.catalog.ships.xenite',
  'ap.catalog.ships.centaur',
  'ap.catalog.ships.ancient',
]);

export function MobileGameLayout({
  hudVm,
  boardVm,
  leftRailVm,
  bottomActionRailVm,
  actionPanelVm,
  actions,
}: MobileGameLayoutProps) {
  const [activeShipModalId, setActiveShipModalId] = useState<ShipDefId | null>(null);
  const isCataloguePanelActive = CATALOGUE_PANEL_IDS.has(actionPanelVm.activePanelId);
  const mobileActions: GameSessionActions = {
    ...actions,
    onReadyToggle: () => {
      setActiveShipModalId(null);
      actions.onReadyToggle();
    },
    onActionPanelTabClick: (tabId) => {
      setActiveShipModalId(null);
      actions.onActionPanelTabClick(tabId);
    },
  };

  useEffect(() => {
    if (!isCataloguePanelActive) {
      setActiveShipModalId(null);
    }
  }, [isCataloguePanelActive]);

  useEffect(() => {
    setActiveShipModalId(null);
  }, [actionPanelVm.menu.phaseKey, actionPanelVm.menu.turnNumber, boardVm.mode]);

  return (
    <div className="h-dvh min-h-dvh w-full min-w-0 overflow-hidden flex flex-col bg-transparent text-white font-['Roboto']">
      <MobileTopNav turnNumber={leftRailVm.turn} />

      {boardVm.mode === 'board' ? (
        <MobileBoardView
          hudVm={hudVm}
          boardVm={boardVm}
          leftRailVm={leftRailVm}
        />
      ) : (
        <MobileSpeciesSelectionView
          hudVm={hudVm}
          boardVm={boardVm}
          leftRailVm={leftRailVm}
          actions={actions}
        />
      )}

      <div className="shrink-0 flex flex-col gap-[12px] w-full">
        {boardVm.mode === 'board' ? (
          <MobileBottomPhase vm={bottomActionRailVm} actions={mobileActions} />
        ) : (
          <MobileSpeciesConfirmPhase
            boardVm={boardVm}
            bottomActionRailVm={bottomActionRailVm}
            actions={actions}
          />
        )}
        <div className="shrink-0 w-full flex flex-col">
          <MobileBottomTabs vm={actionPanelVm} actions={mobileActions} />
          <MobileActionPanel
            vm={actionPanelVm}
            actions={mobileActions}
            onShipInspect={setActiveShipModalId}
          />
        </div>
      </div>

      {activeShipModalId ? (
        <MobileShipModal
          shipId={activeShipModalId}
          buildCatalogue={actionPanelVm.buildCatalogue}
          actions={mobileActions}
          onClose={() => setActiveShipModalId(null)}
        />
      ) : null}
    </div>
  );
}
