import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ActionPanelViewModel,
  BoardViewModel,
  BottomActionRailViewModel,
  GameSessionActions,
  HudViewModel,
  LeftRailViewModel,
} from '../../client/useGameSession';
import type { ShipDefId } from '../../types/ShipTypes.engine';
import { FleetShipHoverCard } from '../layout/boardStage/FleetShipHoverCard';
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

type ActiveFleetShipHover = {
  shipId: ShipDefId;
  anchorRect: DOMRect;
  side: 'my' | 'opponent';
};

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
  const [activeFleetShipHover, setActiveFleetShipHover] =
    useState<ActiveFleetShipHover | null>(null);
  const fleetShipHoverCardRef = useRef<HTMLDivElement | null>(null);
  const isCataloguePanelActive = CATALOGUE_PANEL_IDS.has(actionPanelVm.activePanelId);
  const handleCloseFleetShipHover = useCallback(() => {
    setActiveFleetShipHover(null);
  }, []);
  const handleFleetShipHoverCardElementChange = useCallback((element: HTMLDivElement | null) => {
    fleetShipHoverCardRef.current = element;
  }, []);
  const handleFleetShipInspect = useCallback((
    shipId: ShipDefId,
    anchorEl: HTMLElement,
    side: 'my' | 'opponent'
  ) => {
    setActiveShipModalId(null);
    setActiveFleetShipHover({
      shipId,
      anchorRect: anchorEl.getBoundingClientRect(),
      side,
    });
  }, []);
  const handleCatalogueShipInspect = useCallback((shipId: ShipDefId) => {
    setActiveFleetShipHover(null);
    setActiveShipModalId(shipId);
  }, []);
  const mobileActions: GameSessionActions = {
    ...actions,
    onReadyToggle: () => {
      setActiveShipModalId(null);
      setActiveFleetShipHover(null);
      actions.onReadyToggle();
    },
    onActionPanelTabClick: (tabId) => {
      setActiveShipModalId(null);
      setActiveFleetShipHover(null);
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
    setActiveFleetShipHover(null);
  }, [actionPanelVm.menu.phaseKey, actionPanelVm.menu.turnNumber, boardVm.mode]);

  useEffect(() => {
    if (!activeFleetShipHover) {
      return;
    }

    function handleDocumentPointerDown(event: PointerEvent) {
      const cardEl = fleetShipHoverCardRef.current;
      const target = event.target;

      if (cardEl && target instanceof Node && cardEl.contains(target)) {
        return;
      }

      handleCloseFleetShipHover();
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
    };
  }, [activeFleetShipHover, handleCloseFleetShipHover]);

  return (
    <div className="h-dvh min-h-dvh w-full min-w-0 overflow-hidden flex flex-col bg-transparent text-white font-['Roboto']">
      <MobileTopNav turnNumber={leftRailVm.turn} />

      {boardVm.mode === 'board' ? (
        <MobileBoardView
          hudVm={hudVm}
          boardVm={boardVm}
          leftRailVm={leftRailVm}
          onFleetShipInspect={handleFleetShipInspect}
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
            onShipInspect={handleCatalogueShipInspect}
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

      {activeFleetShipHover ? (
        <div className="fixed inset-0 z-[55] pointer-events-none">
          <FleetShipHoverCard
            shipId={activeFleetShipHover.shipId}
            anchorRect={activeFleetShipHover.anchorRect}
            onClose={handleCloseFleetShipHover}
            onCardElementChange={handleFleetShipHoverCardElementChange}
            portal={false}
            placementMode="mobile-viewport-centered"
            density="mobile"
            preferredPlacement={activeFleetShipHover.side === 'opponent' ? 'bottom' : 'top'}
          />
        </div>
      ) : null}
    </div>
  );
}
