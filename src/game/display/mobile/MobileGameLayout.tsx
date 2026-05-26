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
import { MobileBattleLogTakeover } from './takeovers/MobileBattleLogTakeover';
import { MobileChatTakeover } from './takeovers/MobileChatTakeover';
import { MobileMenuTakeover } from './takeovers/MobileMenuTakeover';

interface MobileGameLayoutProps {
  hudVm: HudViewModel;
  boardVm: BoardViewModel;
  leftRailVm: LeftRailViewModel;
  bottomActionRailVm: BottomActionRailViewModel;
  actionPanelVm: ActionPanelViewModel;
  actions: GameSessionActions;
  soundEnabled: boolean;
  boardFlashEnabled: boolean;
  onSoundEnabledChange: (checked: boolean) => void;
  onBoardFlashEnabledChange: (checked: boolean) => void;
  onToggleSound: () => void;
  onToggleBoardFlash: () => void;
  onReturnToMainMenu: () => void;
}

type ActiveFleetShipHover = {
  shipId: ShipDefId;
  anchorRect: DOMRect;
  side: 'my' | 'opponent';
};

type ActiveTakeover = 'chat' | 'battleLog' | 'menu' | null;

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
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
  soundEnabled,
  boardFlashEnabled,
  onSoundEnabledChange,
  onBoardFlashEnabledChange,
  onToggleSound,
  onToggleBoardFlash,
  onReturnToMainMenu,
}: MobileGameLayoutProps) {
  const [activeTakeover, setActiveTakeover] = useState<ActiveTakeover>(null);
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
  const handleReturnToBoard = useCallback(() => {
    setActiveTakeover(null);
  }, []);
  const handleOpenTakeover = useCallback((takeover: Exclude<ActiveTakeover, null>) => {
    setActiveShipModalId(null);
    setActiveFleetShipHover(null);
    setActiveTakeover(takeover);
  }, []);
  const handleOpenChat = useCallback(() => {
    handleOpenTakeover('chat');
  }, [handleOpenTakeover]);
  const handleOpenBattleLog = useCallback(() => {
    handleOpenTakeover('battleLog');
  }, [handleOpenTakeover]);
  const handleOpenMenu = useCallback(() => {
    handleOpenTakeover('menu');
  }, [handleOpenTakeover]);
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
      <MobileTopNav
        turnNumber={leftRailVm.turn}
        activeTakeover={activeTakeover}
        onReturnToBoard={handleReturnToBoard}
        onOpenChat={handleOpenChat}
        onOpenBattleLog={handleOpenBattleLog}
        onOpenMenu={handleOpenMenu}
      />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          aria-hidden={activeTakeover !== null}
          inert={activeTakeover !== null}
          className={cx(
            'flex min-h-0 flex-1 flex-col',
            activeTakeover !== null && 'pointer-events-none opacity-0'
          )}
        >
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

          <div className="shrink-0 flex flex-col gap-[6px] w-full">
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
        </div>

        {activeTakeover ? (
          <div className="absolute inset-0 z-[70] flex min-h-0 flex-col">
            {activeTakeover === 'chat' ? (
              <MobileChatTakeover vm={leftRailVm} actions={actions} onClose={handleReturnToBoard} />
            ) : activeTakeover === 'battleLog' ? (
              <MobileBattleLogTakeover vm={leftRailVm} onClose={handleReturnToBoard} />
            ) : (
              <MobileMenuTakeover
                vm={actionPanelVm.menu}
                actions={actions}
                onClose={handleReturnToBoard}
                onReturnToMainMenu={onReturnToMainMenu}
                soundEnabled={soundEnabled}
                boardFlashEnabled={boardFlashEnabled}
                onSoundEnabledChange={onSoundEnabledChange}
                onBoardFlashEnabledChange={onBoardFlashEnabledChange}
                onToggleSound={onToggleSound}
                onToggleBoardFlash={onToggleBoardFlash}
              />
            )}
          </div>
        ) : null}
      </div>

      {activeTakeover === null && activeShipModalId ? (
        <MobileShipModal
          shipId={activeShipModalId}
          buildCatalogue={actionPanelVm.buildCatalogue}
          actions={mobileActions}
          onClose={() => setActiveShipModalId(null)}
        />
      ) : null}

      {activeTakeover === null && activeFleetShipHover ? (
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
