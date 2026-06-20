import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ActionPanelViewModel,
  BoardViewModel,
  BottomActionRailViewModel,
  GameSessionActions,
  GameSessionViewModel,
  HudViewModel,
  LeftRailViewModel,
} from '../../client/useGameSession';
import type { ShipDefId } from '../../types/ShipTypes.engine';
import { FleetShipHoverCard } from '../layout/boardStage/FleetShipHoverCard';
import { MobileBoardView } from './MobileBoardView';
import { MobileBottomPhase } from './MobileBottomPhase';
import { MobileBottomTabs } from './MobileBottomTabs';
import {
  MobileStatBreakdownPopovers,
  type MobileStatAnchorRect,
} from './MobileStatBreakdownPopovers';
import { MobileActionPanel } from './actionPanel/MobileActionPanel';
import { MobileShipModal } from './actionPanel/MobileShipModal';
import { MobileSpeciesConfirmPhase, MobileSpeciesSelectionView } from './MobileSpeciesSelectionView';
import { MobileTopNav } from './MobileTopNav';
import { MobileVoidPanel } from './MobileVoidPanel';
import { MobileBattleLogTakeover } from './takeovers/MobileBattleLogTakeover';
import { MobileChatTakeover } from './takeovers/MobileChatTakeover';
import { MobileEndGameStatsTakeover } from './takeovers/MobileEndGameStatsTakeover';
import { MobileEndOfGameMenuTakeover } from './takeovers/MobileEndOfGameMenuTakeover';
import { MobileMenuTakeover } from './takeovers/MobileMenuTakeover';

interface MobileGameLayoutProps {
  hudVm: HudViewModel;
  boardVm: BoardViewModel;
  leftRailVm: LeftRailViewModel;
  bottomActionRailVm: BottomActionRailViewModel;
  actionPanelVm: ActionPanelViewModel;
  gameStats: GameSessionViewModel['gameStats'];
  actions: GameSessionActions;
  firstTurnBuildHelperEligible?: boolean;
  firstTurnBuildHelperDismissSignal?: number;
  onFirstTurnBuildHelperDismiss?: () => void;
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
type ActiveMobileBottomPanel = 'normal' | 'void';

type MobileStatPopoverAnchors = {
  top: MobileStatAnchorRect;
  bottom: MobileStatAnchorRect;
};

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
  gameStats,
  actions,
  firstTurnBuildHelperEligible = false,
  firstTurnBuildHelperDismissSignal = 0,
  onFirstTurnBuildHelperDismiss,
  soundEnabled,
  boardFlashEnabled,
  onSoundEnabledChange,
  onBoardFlashEnabledChange,
  onToggleSound,
  onToggleBoardFlash,
  onReturnToMainMenu,
}: MobileGameLayoutProps) {
  const [activeTakeover, setActiveTakeover] = useState<ActiveTakeover>(null);
  const [isGameStatsOpen, setIsGameStatsOpen] = useState(false);
  const [activeMobileBottomPanel, setActiveMobileBottomPanel] =
    useState<ActiveMobileBottomPanel>('normal');
  const [activeShipModalId, setActiveShipModalId] = useState<ShipDefId | null>(null);
  const [activeFleetShipHover, setActiveFleetShipHover] =
    useState<ActiveFleetShipHover | null>(null);
  const [statPopoverAnchors, setStatPopoverAnchors] =
    useState<MobileStatPopoverAnchors | null>(null);
  const topStatusRowRef = useRef<HTMLDivElement | null>(null);
  const bottomStatusRowRef = useRef<HTMLDivElement | null>(null);
  const topStatsAnchorRef = useRef<HTMLDivElement | null>(null);
  const bottomStatsAnchorRef = useRef<HTMLDivElement | null>(null);
  const topStatPopoverRef = useRef<HTMLDivElement | null>(null);
  const bottomStatPopoverRef = useRef<HTMLDivElement | null>(null);
  const fleetShipHoverCardRef = useRef<HTMLDivElement | null>(null);
  const isCataloguePanelActive = CATALOGUE_PANEL_IDS.has(actionPanelVm.activePanelId);
  const isEndGamePanel = actionPanelVm.activePanelId === 'ap.end_of_game.result' || actionPanelVm.endOfGame != null;
  const isGameOver = actionPanelVm.endOfGame != null;
  const hasVoidShips =
    boardVm.mode === 'board' &&
    (boardVm.myVoidFleet.length > 0 || boardVm.opponentVoidFleet.length > 0);
  const shouldForceMobileActionPanel =
    actionPanelVm.healthResolutionOverlay != null || isEndGamePanel;
  const canViewGameStats = gameStats != null;
  const showVoidTab = boardVm.mode === 'board' && hasVoidShips;
  const isVoidPanelSelected =
    activeMobileBottomPanel === 'void' &&
    showVoidTab &&
    !shouldForceMobileActionPanel &&
    activeTakeover === null;
  const shouldShowVoidPanel =
    boardVm.mode === 'board' &&
    activeMobileBottomPanel === 'void' &&
    hasVoidShips &&
    !shouldForceMobileActionPanel;
  const turnLabel = isGameOver ? 'Game Over' : `Turn ${leftRailVm.turn}`;
  const activeDestroyTargetSourceInstanceId =
    boardVm.mode === 'board' ? boardVm.destroyTargeting?.activeSourceInstanceId : null;
  const handleCloseStatPopovers = useCallback(() => {
    setStatPopoverAnchors(null);
  }, []);
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
    handleCloseStatPopovers();
    setActiveShipModalId(null);
    setActiveFleetShipHover({
      shipId,
      anchorRect: anchorEl.getBoundingClientRect(),
      side,
    });
  }, [handleCloseStatPopovers]);
  const handleCatalogueShipInspect = useCallback((shipId: ShipDefId) => {
    handleCloseStatPopovers();
    setActiveFleetShipHover(null);
    setActiveShipModalId(shipId);
  }, [handleCloseStatPopovers]);
  const handleReturnToBoard = useCallback(() => {
    setIsGameStatsOpen(false);
    setActiveTakeover(null);
  }, []);
  const handleCloseGameStats = useCallback(() => {
    setIsGameStatsOpen(false);
  }, []);
  const handleOpenGameStats = useCallback(() => {
    if (gameStats) {
      setIsGameStatsOpen(true);
    }
  }, [gameStats]);
  const handleOpenTakeover = useCallback((takeover: Exclude<ActiveTakeover, null>) => {
    handleCloseStatPopovers();
    setActiveMobileBottomPanel('normal');
    setActiveShipModalId(null);
    setActiveFleetShipHover(null);
    setActiveTakeover(takeover);
  }, [handleCloseStatPopovers]);
  const handleVoidTabClick = useCallback(() => {
    handleCloseStatPopovers();
    setActiveShipModalId(null);
    setActiveFleetShipHover(null);
    setActiveMobileBottomPanel('void');
  }, [handleCloseStatPopovers]);
  const handleToggleStatPopovers = useCallback(() => {
    if (statPopoverAnchors) {
      handleCloseStatPopovers();
      return;
    }

    const topRowEl = topStatusRowRef.current;
    const bottomRowEl = bottomStatusRowRef.current;
    const topStatsEl = topStatsAnchorRef.current;
    const bottomStatsEl = bottomStatsAnchorRef.current;

    if (!topRowEl || !bottomRowEl || !topStatsEl || !bottomStatsEl) {
      return;
    }

    setActiveShipModalId(null);
    setActiveFleetShipHover(null);
    setStatPopoverAnchors({
      top: snapshotRect(topStatsEl.getBoundingClientRect()),
      bottom: snapshotRect(bottomStatsEl.getBoundingClientRect()),
    });
  }, [handleCloseStatPopovers, statPopoverAnchors]);
  const handleOpenChat = useCallback(() => {
    handleOpenTakeover('chat');
  }, [handleOpenTakeover]);
  const handleOpenBattleLog = useCallback(() => {
    handleOpenTakeover('battleLog');
  }, [handleOpenTakeover]);
  const handleOpenMenu = useCallback(() => {
    handleOpenTakeover('menu');
  }, [handleOpenTakeover]);
  const shouldShowEndGameStatsTakeover =
    activeTakeover === 'menu' &&
    actionPanelVm.endOfGame != null &&
    isGameStatsOpen &&
    gameStats != null;
  const mobileActions: GameSessionActions = {
    ...actions,
    onReadyToggle: () => {
      handleCloseStatPopovers();
      setActiveShipModalId(null);
      setActiveFleetShipHover(null);
      actions.onReadyToggle();
    },
    onActionPanelTabClick: (tabId) => {
      handleCloseStatPopovers();
      setActiveMobileBottomPanel('normal');
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
    if (activeTakeover !== 'menu' || !canViewGameStats || !isEndGamePanel) {
      setIsGameStatsOpen(false);
    }
  }, [activeTakeover, canViewGameStats, isEndGamePanel]);

  useEffect(() => {
    if (activeDestroyTargetSourceInstanceId == null) {
      return;
    }

    handleCloseStatPopovers();
    setActiveShipModalId(null);
    setActiveFleetShipHover(null);
  }, [activeDestroyTargetSourceInstanceId, handleCloseStatPopovers]);

  useEffect(() => {
    setActiveShipModalId(null);
    setActiveFleetShipHover(null);
    setActiveMobileBottomPanel('normal');
    handleCloseStatPopovers();
  }, [
    actionPanelVm.menu.phaseKey,
    actionPanelVm.menu.turnNumber,
    boardVm.mode,
    isGameOver,
    handleCloseStatPopovers,
  ]);

  useEffect(() => {
    if (activeMobileBottomPanel !== 'void') {
      return;
    }

    if (boardVm.mode !== 'board' || !hasVoidShips || shouldForceMobileActionPanel || activeTakeover !== null) {
      setActiveMobileBottomPanel('normal');
    }
  }, [
    activeMobileBottomPanel,
    activeTakeover,
    boardVm.mode,
    hasVoidShips,
    shouldForceMobileActionPanel,
  ]);

  useEffect(() => {
    if (!statPopoverAnchors) {
      return;
    }

    function handleDocumentPointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        handleCloseStatPopovers();
        return;
      }

      const ignoredElements = [
        topStatusRowRef.current,
        bottomStatusRowRef.current,
        topStatPopoverRef.current,
        bottomStatPopoverRef.current,
      ];

      if (ignoredElements.some((element) => element?.contains(target))) {
        return;
      }

      handleCloseStatPopovers();
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
    };
  }, [handleCloseStatPopovers, statPopoverAnchors]);

  useEffect(() => {
    if (!statPopoverAnchors || typeof window === 'undefined') {
      return;
    }

    const visualViewport = window.visualViewport;
    window.addEventListener('resize', handleCloseStatPopovers);
    window.addEventListener('orientationchange', handleCloseStatPopovers);
    visualViewport?.addEventListener('resize', handleCloseStatPopovers);

    return () => {
      window.removeEventListener('resize', handleCloseStatPopovers);
      window.removeEventListener('orientationchange', handleCloseStatPopovers);
      visualViewport?.removeEventListener('resize', handleCloseStatPopovers);
    };
  }, [handleCloseStatPopovers, statPopoverAnchors]);

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
    <div className="h-full min-h-0 w-full min-w-0 overflow-hidden flex flex-col bg-transparent text-white font-['Roboto']">
      <MobileTopNav
        turnLabel={turnLabel}
        isGameOver={isGameOver}
        activeTakeover={activeTakeover}
        onReturnToBoard={handleReturnToBoard}
        onOpenChat={handleOpenChat}
        onOpenBattleLog={handleOpenBattleLog}
        onOpenMenu={handleOpenMenu}
      />

      <div className="relative flex min-h-0 flex-1 flex-col pt-[8px]">
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
              firstTurnBuildHelperEligible={firstTurnBuildHelperEligible}
              firstTurnBuildHelperDismissSignal={firstTurnBuildHelperDismissSignal}
              onFirstTurnBuildHelperDismiss={onFirstTurnBuildHelperDismiss}
              onFleetShipInspect={handleFleetShipInspect}
              onBoardBackgroundMouseDown={actions.onBoardBackgroundMouseDown}
              onDestroyTargetHoverChange={actions.onDestroyTargetStackHoverChange}
              onDestroyTargetMouseDown={actions.onDestroyTargetStackMouseDown}
              topStatusRowRef={topStatusRowRef}
              bottomStatusRowRef={bottomStatusRowRef}
              topStatsAnchorRef={topStatsAnchorRef}
              bottomStatsAnchorRef={bottomStatsAnchorRef}
              onStatusRowToggle={handleToggleStatPopovers}
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
              <MobileBottomTabs
                vm={actionPanelVm}
                actions={mobileActions}
                showVoidTab={showVoidTab}
                voidTabSelected={isVoidPanelSelected}
                onVoidTabClick={shouldForceMobileActionPanel ? undefined : handleVoidTabClick}
              />
              {shouldShowVoidPanel && boardVm.mode === 'board' ? (
                <MobileVoidPanel hudVm={hudVm} boardVm={boardVm} />
              ) : (
                <MobileActionPanel
                  vm={actionPanelVm}
                  actions={mobileActions}
                  onShipInspect={handleCatalogueShipInspect}
                  onOpenMenuTakeover={handleOpenMenu}
                />
              )}
            </div>
          </div>
        </div>

        {activeTakeover ? (
          <div className="absolute inset-0 z-[70] flex min-h-0 flex-col mt-[16px]">
            {shouldShowEndGameStatsTakeover ? (
              <MobileEndGameStatsTakeover
                gameStats={gameStats}
                onCloseStats={handleCloseGameStats}
              />
            ) : activeTakeover === 'chat' ? (
              <MobileChatTakeover vm={leftRailVm} actions={actions} onClose={handleReturnToBoard} />
            ) : activeTakeover === 'battleLog' ? (
              <MobileBattleLogTakeover vm={leftRailVm} onClose={handleReturnToBoard} />
            ) : actionPanelVm.endOfGame != null ? (
              <MobileEndOfGameMenuTakeover
                endOfGame={actionPanelVm.endOfGame}
                canViewGameStats={canViewGameStats}
                onOpenGameStats={handleOpenGameStats}
                onClose={handleReturnToBoard}
                onReturnToMainMenu={onReturnToMainMenu}
                onRematch={actions.onRematch}
                onDownloadBattleLog={actions.onDownloadBattleLog}
              />
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

      {activeTakeover === null && boardVm.mode === 'board' && statPopoverAnchors ? (
        <MobileStatBreakdownPopovers
          boardVm={boardVm}
          topAnchorRect={statPopoverAnchors.top}
          bottomAnchorRect={statPopoverAnchors.bottom}
          topPopoverRef={topStatPopoverRef}
          bottomPopoverRef={bottomStatPopoverRef}
        />
      ) : null}

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

function snapshotRect(rect: DOMRect): MobileStatAnchorRect {
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}
