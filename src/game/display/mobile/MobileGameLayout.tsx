import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type {
  ActionPanelViewModel,
  BoardViewModel,
  BottomActionRailViewModel,
  GameSessionActions,
  GameSessionViewModel,
  HudViewModel,
  LeftRailViewModel,
  TurnPhasePresentationVm,
  TurnPhaseVm,
} from '../../client/useGameSession';
import type { ShipDefId } from '../../types/ShipTypes.engine';
import { SHIP_DEFINITIONS_MAP } from '../../data/ShipDefinitionsUI';
import type { ImplementedAncientManualSolarPowerId } from '../../client/gameSession/ancient/ancientChargeDeclaration';
import { FleetShipHoverCard } from '../layout/boardStage/FleetShipHoverCard';
import { MobileBoardView } from './MobileBoardView';
import { MobileBottomPhase } from './MobileBottomPhase';
import { MobileBottomTabs } from './MobileBottomTabs';
import {
  MobileStatBreakdownPopovers,
  type MobileStatAnchorRect,
} from './MobileStatBreakdownPopovers';
import { MobileActionPanel } from './actionPanel/MobileActionPanel';
import { MobileAutocastInfoModal } from './actionPanel/MobileAutocastInfoModal';
import { MobileShipModal } from './actionPanel/MobileShipModal';
import { MobileSolarPowerModal } from './actionPanel/MobileSolarPowerModal';
import { MobileSpeciesConfirmPhase, MobileSpeciesSelectionView } from './MobileSpeciesSelectionView';
import { MobileTopNav } from './MobileTopNav';
import { resolveAncientSimulacrumSpecies } from '../actionPanel/panels/catalogue/ancient/resolveAncientSimulacrumSpecies';
import { MobileVoidPanel } from './MobileVoidPanel';
import { MobileBattleLogTakeover } from './takeovers/MobileBattleLogTakeover';
import { MobileChatTakeover } from './takeovers/MobileChatTakeover';
import { MobileEndGameStatsTakeover } from './takeovers/MobileEndGameStatsTakeover';
import { MobileEndOfGameMenuTakeover } from './takeovers/MobileEndOfGameMenuTakeover';
import { MobileMenuTakeover } from './takeovers/MobileMenuTakeover';
import type { MainPhaseControl } from '../shared/mainPhaseControl';
import { MissionChallengeOverlay } from '../mission/MissionChallengeOverlay';
import {
  shouldLockMissionInteraction,
  shouldShowMissionChallengeAction,
  shouldShowPostgameMissionChallengeAction,
  type MissionOverlayMode,
} from '../mission/missionChallengePresentation';

interface MobileGameLayoutProps {
  gameId: string;
  hudVm: HudViewModel;
  boardVm: BoardViewModel;
  leftRailVm: LeftRailViewModel;
  turnPhasesVm: TurnPhaseVm;
  turnPhasePresentation: TurnPhasePresentationVm;
  bottomActionRailVm: BottomActionRailViewModel;
  actionPanelVm: ActionPanelViewModel;
  gameStats: GameSessionViewModel['gameStats'];
  viewer: GameSessionViewModel['viewer'];
  matchupIntro: GameSessionViewModel['matchupIntro'];
  missionChallenge: GameSessionViewModel['missionChallenge'];
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
type PostgameMissionPresentation = { loreUnlocked: boolean } | null;

type MobileStatPopoverAnchors = {
  top: MobileStatAnchorRect;
  bottom: MobileStatAnchorRect;
};

type MobileChatReadState = {
  gameCode: LeftRailViewModel['gameCode'];
  lastSeenChatMessageCount: number;
  baselineEstablished: boolean;
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
  gameId,
  hudVm,
  boardVm,
  leftRailVm,
  turnPhasesVm,
  turnPhasePresentation,
  bottomActionRailVm,
  actionPanelVm,
  gameStats,
  viewer,
  matchupIntro,
  missionChallenge,
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
  const isBattleReveal = actionPanelVm.menu.phaseKey === 'battle.reveal';
  const [activeTakeover, setActiveTakeover] = useState<ActiveTakeover>(null);
  const [isGameStatsOpen, setIsGameStatsOpen] = useState(false);
  const [activeMobileBottomPanel, setActiveMobileBottomPanel] =
    useState<ActiveMobileBottomPanel>('normal');
  const [activeShipModalId, setActiveShipModalId] = useState<ShipDefId | null>(null);
  const [isMissionReopenOpen, setIsMissionReopenOpen] = useState(false);
  const [postgameMissionPresentation, setPostgameMissionPresentation] =
    useState<PostgameMissionPresentation>(null);
  const isPostgameMissionOpen = postgameMissionPresentation !== null;

  useEffect(() => {
    if (matchupIntro) {
      setActiveTakeover(null);
    }
  }, [matchupIntro]);
  const [missionReferenceShipId, setMissionReferenceShipId] =
    useState<ShipDefId | null>(null);
  const [activeSolarModalId, setActiveSolarModalId] =
    useState<ImplementedAncientManualSolarPowerId | null>(null);
  const [isSiphonInspectionOpen, setIsSiphonInspectionOpen] = useState(false);
  const [isAutocastInfoOpen, setIsAutocastInfoOpen] = useState(false);
  const [activeFleetShipHover, setActiveFleetShipHover] =
    useState<ActiveFleetShipHover | null>(null);
  const [statPopoverAnchors, setStatPopoverAnchors] =
    useState<MobileStatPopoverAnchors | null>(null);
  const [mobileChatReadState, setMobileChatReadState] = useState<MobileChatReadState>(() => ({
    gameCode: leftRailVm.gameCode,
    lastSeenChatMessageCount: leftRailVm.chatMessages.length,
    baselineEstablished: false,
  }));
  const topStatusRowRef = useRef<HTMLDivElement | null>(null);
  const bottomStatusRowRef = useRef<HTMLDivElement | null>(null);
  const topStatsAnchorRef = useRef<HTMLDivElement | null>(null);
  const bottomStatsAnchorRef = useRef<HTMLDivElement | null>(null);
  const topStatPopoverRef = useRef<HTMLDivElement | null>(null);
  const bottomStatPopoverRef = useRef<HTMLDivElement | null>(null);
  const fleetShipHoverCardRef = useRef<HTMLDivElement | null>(null);
  const consumeMissionResultAutoOpenRequestRef = useRef(
    actions.onConsumeMissionResultAutoOpenRequest,
  );
  consumeMissionResultAutoOpenRequestRef.current =
    actions.onConsumeMissionResultAutoOpenRequest;
  const isCataloguePanelActive = CATALOGUE_PANEL_IDS.has(actionPanelVm.activePanelId);
  const isAncientCatalogueSurfaceActive =
    actionPanelVm.activePanelId === 'ap.catalog.ships.ancient' ||
    actionPanelVm.activePanelId === 'ap.battle.solar_powers.ancient';
  const ancientPresentation =
    actionPanelVm.menu.phaseKey === 'battle.charge_declaration' &&
    actionPanelVm.ancientChargeDeclaration?.stage === 'powers'
      ? 'declaration'
      : 'reference';
  const simulacrumSpecies = resolveAncientSimulacrumSpecies(boardVm);
  const isEndGamePanel = actionPanelVm.activePanelId === 'ap.end_of_game.result' || actionPanelVm.endOfGame != null;
  const isGameOver = actionPanelVm.endOfGame != null;
  const isMissionIntroPending = missionChallenge?.introPending === true;
  const shouldShowInitialMission = Boolean(
    boardVm.mode === 'board' &&
    missionChallenge &&
    !missionChallenge.isFinished &&
    missionChallenge.shouldPresentInitialIntro
  );
  const shouldShowReopenedMission = Boolean(
    !shouldShowInitialMission &&
    boardVm.mode === 'board' &&
    missionChallenge &&
    !missionChallenge.isFinished &&
    missionChallenge.introPending === false &&
    viewer.isPlayerViewer &&
    isMissionReopenOpen
  );
  const canShowPostgameMissionChallengeAction =
    shouldShowPostgameMissionChallengeAction({
      hasMission: missionChallenge !== null,
      isPlayerViewer: viewer.isPlayerViewer,
      isFinished: missionChallenge?.isFinished ?? false,
      hasResult: missionChallenge?.result !== null && missionChallenge?.result !== undefined,
    });
  const shouldShowPostgameMission = Boolean(
    boardVm.mode === 'board' &&
    canShowPostgameMissionChallengeAction &&
    isPostgameMissionOpen
  );
  const missionOverlayMode: MissionOverlayMode | null = shouldShowInitialMission
    ? 'initial'
    : shouldShowReopenedMission
      ? 'reopen'
      : shouldShowPostgameMission
        ? 'result'
        : null;
  const isMissionOverlayVisible = missionOverlayMode !== null;
  const isActiveMissionOverlayVisible =
    missionOverlayMode === 'initial' || missionOverlayMode === 'reopen';
  const isMissionInteractionLocked = shouldLockMissionInteraction({
    introPending: isMissionIntroPending,
    overlayVisible: isActiveMissionOverlayVisible,
  });
  const canShowMissionChallengeAction = shouldShowMissionChallengeAction({
    hasMission: missionChallenge !== null,
    isPlayerViewer: viewer.isPlayerViewer,
    isFinished: missionChallenge?.isFinished ?? false,
    introPending: missionChallenge?.introPending ?? false,
  });
  const hasVoidShips =
    boardVm.mode === 'board' &&
    (boardVm.myVoidFleet.length > 0 || boardVm.opponentVoidFleet.length > 0);
  const shouldForceMobileActionPanel =
    actionPanelVm.healthResolutionOverlay != null || isEndGamePanel;
  const canViewGameStats = gameStats != null;
  const endGameResultKey = actionPanelVm.endOfGame
    ? [
        actionPanelVm.endOfGame.bannerText,
        actionPanelVm.endOfGame.metaLeftText,
        actionPanelVm.endOfGame.metaRightText,
      ].join('\u0000')
    : null;
  const missionResultKey = missionChallenge?.result
    ? [
        missionChallenge.result.missionSucceeded,
        missionChallenge.result.fleetConditionMet,
        missionChallenge.result.challengeSucceeded,
      ].join('\u0000')
    : null;
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
  const currentChatMessageCount = leftRailVm.chatMessages.length;
  const isMobileChatBaselineEstablished =
    mobileChatReadState.gameCode === leftRailVm.gameCode &&
    mobileChatReadState.baselineEstablished;
  const mobileUnreadChatCount =
    activeTakeover === 'chat' || !isMobileChatBaselineEstablished
      ? 0
      : Math.max(
          0,
          currentChatMessageCount - mobileChatReadState.lastSeenChatMessageCount
        );
  const turnLabel = isGameOver ? 'Game Over' : `Turn ${leftRailVm.turn}`;
  const activeDestroyTargetSourceInstanceId =
    boardVm.mode === 'board' ? boardVm.destroyTargeting?.activeSourceInstanceId : null;
  const handleCloseStatPopovers = useCallback(() => {
    setStatPopoverAnchors(null);
  }, []);
  const handleCloseFleetShipHover = useCallback(() => {
    setActiveFleetShipHover(null);
  }, []);
  const handleCloseAutocastInfo = useCallback(() => {
    setIsAutocastInfoOpen(false);
  }, []);
  const handleCloseSolarModal = useCallback(() => {
    setActiveSolarModalId(null);
  }, []);
  const handleCloseSiphonInspection = useCallback(() => {
    setIsSiphonInspectionOpen(false);
  }, []);
  const closeConflictingMissionSurfaces = useCallback(() => {
    setActiveTakeover(null);
    setIsGameStatsOpen(false);
    setActiveMobileBottomPanel('normal');
    setActiveShipModalId(null);
    setMissionReferenceShipId(null);
    setActiveSolarModalId(null);
    setIsSiphonInspectionOpen(false);
    setIsAutocastInfoOpen(false);
    setActiveFleetShipHover(null);
    setStatPopoverAnchors(null);
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
    handleCloseSolarModal();
    handleCloseSiphonInspection();
    handleCloseAutocastInfo();
    setActiveFleetShipHover({
      shipId,
      anchorRect: anchorEl.getBoundingClientRect(),
      side,
    });
  }, [
    handleCloseAutocastInfo,
    handleCloseSiphonInspection,
    handleCloseSolarModal,
    handleCloseStatPopovers,
  ]);
  const handleCatalogueShipInspect = useCallback((shipId: ShipDefId) => {
    handleCloseStatPopovers();
    setActiveFleetShipHover(null);
    handleCloseSolarModal();
    handleCloseSiphonInspection();
    handleCloseAutocastInfo();
    setActiveShipModalId(shipId);
  }, [
    handleCloseAutocastInfo,
    handleCloseSiphonInspection,
    handleCloseSolarModal,
    handleCloseStatPopovers,
  ]);
  const handleSolarPowerInspect = useCallback((
    solarPowerId: ImplementedAncientManualSolarPowerId
  ) => {
    handleCloseStatPopovers();
    setActiveShipModalId(null);
    setActiveFleetShipHover(null);
    handleCloseAutocastInfo();
    handleCloseSiphonInspection();
    setActiveSolarModalId(solarPowerId);
  }, [
    handleCloseAutocastInfo,
    handleCloseSiphonInspection,
    handleCloseStatPopovers,
  ]);
  const handleViewSiphon = useCallback(() => {
    handleCloseStatPopovers();
    setActiveShipModalId(null);
    setActiveFleetShipHover(null);
    handleCloseAutocastInfo();
    handleCloseSolarModal();
    setIsSiphonInspectionOpen(true);
  }, [
    handleCloseAutocastInfo,
    handleCloseSolarModal,
    handleCloseStatPopovers,
  ]);
  const handleOpenAutocastInfo = useCallback(() => {
    handleCloseStatPopovers();
    setActiveShipModalId(null);
    handleCloseSolarModal();
    handleCloseSiphonInspection();
    setActiveFleetShipHover(null);
    setIsAutocastInfoOpen(true);
  }, [
    handleCloseSiphonInspection,
    handleCloseSolarModal,
    handleCloseStatPopovers,
  ]);
  const handleReturnToBoard = useCallback(() => {
    setIsGameStatsOpen(false);
    setPostgameMissionPresentation(null);
    setActiveTakeover(null);
  }, []);
  const handleCloseGameStats = useCallback(() => {
    setIsGameStatsOpen(false);
  }, []);
  const handleOpenGameStats = useCallback(() => {
    if (gameStats) {
      setPostgameMissionPresentation(null);
      setIsGameStatsOpen(true);
    }
  }, [gameStats]);
  const handleOpenTakeover = useCallback((takeover: Exclude<ActiveTakeover, null>) => {
    handleCloseStatPopovers();
    setActiveMobileBottomPanel('normal');
    setActiveShipModalId(null);
    handleCloseSolarModal();
    handleCloseSiphonInspection();
    setActiveFleetShipHover(null);
    handleCloseAutocastInfo();
    setPostgameMissionPresentation(null);
    setActiveTakeover(takeover);
  }, [
    handleCloseAutocastInfo,
    handleCloseSiphonInspection,
    handleCloseSolarModal,
    handleCloseStatPopovers,
  ]);
  const handleVoidTabClick = useCallback(() => {
    handleCloseStatPopovers();
    setActiveShipModalId(null);
    handleCloseSolarModal();
    handleCloseSiphonInspection();
    setActiveFleetShipHover(null);
    handleCloseAutocastInfo();
    setActiveMobileBottomPanel('void');
  }, [
    handleCloseAutocastInfo,
    handleCloseSiphonInspection,
    handleCloseSolarModal,
    handleCloseStatPopovers,
  ]);
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
    handleCloseSolarModal();
    handleCloseSiphonInspection();
    setActiveFleetShipHover(null);
    handleCloseAutocastInfo();
    setStatPopoverAnchors({
      top: snapshotRect(topStatsEl.getBoundingClientRect()),
      bottom: snapshotRect(bottomStatsEl.getBoundingClientRect()),
    });
  }, [
    handleCloseAutocastInfo,
    handleCloseSiphonInspection,
    handleCloseSolarModal,
    handleCloseStatPopovers,
    statPopoverAnchors,
  ]);
  const handleOpenChat = useCallback(() => {
    setMobileChatReadState({
      gameCode: leftRailVm.gameCode,
      lastSeenChatMessageCount: currentChatMessageCount,
      baselineEstablished: true,
    });
    handleOpenTakeover('chat');
  }, [currentChatMessageCount, handleOpenTakeover, leftRailVm.gameCode]);
  const handleOpenBattleLog = useCallback(() => {
    handleOpenTakeover('battleLog');
  }, [handleOpenTakeover]);
  const handleOpenMenu = useCallback(() => {
    handleOpenTakeover('menu');
  }, [handleOpenTakeover]);
  const handleOpenMissionChallenge = useCallback(() => {
    if (!canShowMissionChallengeAction) {
      return;
    }

    closeConflictingMissionSurfaces();
    setPostgameMissionPresentation(null);
    setIsMissionReopenOpen(true);
  }, [canShowMissionChallengeAction, closeConflictingMissionSurfaces]);
  const handleOpenPostgameMissionChallenge = useCallback((loreUnlocked = false) => {
    if (!canShowPostgameMissionChallengeAction) {
      return;
    }

    closeConflictingMissionSurfaces();
    setIsMissionReopenOpen(false);
    setPostgameMissionPresentation({ loreUnlocked });
  }, [canShowPostgameMissionChallengeAction, closeConflictingMissionSurfaces]);
  const handleMissionChallengeShipInspect = useCallback((shipId: ShipDefId) => {
    if (!isMissionOverlayVisible || !SHIP_DEFINITIONS_MAP[shipId]) {
      return;
    }

    setMissionReferenceShipId(shipId);
  }, [isMissionOverlayVisible]);
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
      handleCloseSolarModal();
      handleCloseSiphonInspection();
      setActiveFleetShipHover(null);
      handleCloseAutocastInfo();
      actions.onReadyToggle();
    },
    onActionPanelTabClick: (tabId) => {
      handleCloseStatPopovers();
      setActiveMobileBottomPanel('normal');
      setActiveShipModalId(null);
      handleCloseSolarModal();
      handleCloseSiphonInspection();
      setActiveFleetShipHover(null);
      handleCloseAutocastInfo();
      actions.onActionPanelTabClick(tabId);
    },
  };
  const ancientSelectorMode = actionPanelVm.ancientChargeDeclaration?.selectorMode ?? null;
  const usesMainBack =
    (ancientSelectorMode != null && ancientSelectorMode !== 'blackHole') ||
    (isSiphonInspectionOpen && ancientPresentation === 'declaration');
  const mainPhaseControl: MainPhaseControl =
    usesMainBack
      ? {
          mode: 'back',
          onActivate: () => {
            if (ancientSelectorMode != null) {
              actions.onCancelAncientSolarSelector();
              return;
            }
            handleCloseSiphonInspection();
          },
        }
      : {
          mode: 'ready',
          onActivate: mobileActions.onReadyToggle,
        };

  useEffect(() => {
    if (!isCataloguePanelActive) {
      setActiveShipModalId(null);
    }
  }, [isCataloguePanelActive]);

  useLayoutEffect(() => {
    setIsMissionReopenOpen(false);
    setPostgameMissionPresentation(null);
    setMissionReferenceShipId(null);
  }, [gameId, missionChallenge?.mission.id]);

  useEffect(() => {
    setPostgameMissionPresentation(null);
  }, [endGameResultKey, missionResultKey]);

  useLayoutEffect(() => {
    setIsMissionReopenOpen(false);
    setPostgameMissionPresentation(null);
    setMissionReferenceShipId(null);
  }, [actionPanelVm.menu.phaseKey, actionPanelVm.menu.turnNumber]);

  useEffect(() => {
    if (!canShowPostgameMissionChallengeAction || endGameResultKey === null) {
      setPostgameMissionPresentation(null);
    }
  }, [canShowPostgameMissionChallengeAction, endGameResultKey]);

  useEffect(() => {
    const request = missionChallenge?.postgameResultAutoOpenRequest;
    if (!request || !canShowPostgameMissionChallengeAction) {
      return;
    }

    handleOpenPostgameMissionChallenge(request.loreUnlocked);
    consumeMissionResultAutoOpenRequestRef.current(request.key);
  }, [
    canShowPostgameMissionChallengeAction,
    handleOpenPostgameMissionChallenge,
    missionChallenge?.postgameResultAutoOpenRequest,
  ]);

  useEffect(() => {
    if (
      boardVm.mode !== 'board' ||
      missionChallenge === null ||
      missionChallenge.isFinished ||
      missionChallenge.introPending
    ) {
      setIsMissionReopenOpen(false);
    }
  }, [boardVm.mode, missionChallenge]);

  useEffect(() => {
    if (!isMissionOverlayVisible) {
      setMissionReferenceShipId(null);
    }
  }, [isMissionOverlayVisible]);

  useLayoutEffect(() => {
    if (isMissionIntroPending) {
      setIsMissionReopenOpen(false);
      setPostgameMissionPresentation(null);
      closeConflictingMissionSurfaces();
    }
  }, [closeConflictingMissionSurfaces, isMissionIntroPending]);

  useLayoutEffect(() => {
    if (isMissionOverlayVisible) {
      closeConflictingMissionSurfaces();
    }
  }, [closeConflictingMissionSurfaces, isMissionOverlayVisible]);

  useEffect(() => {
    if (!isAncientCatalogueSurfaceActive) {
      handleCloseAutocastInfo();
      handleCloseSolarModal();
      handleCloseSiphonInspection();
    }
  }, [
    handleCloseAutocastInfo,
    handleCloseSiphonInspection,
    handleCloseSolarModal,
    isAncientCatalogueSurfaceActive,
  ]);

  useEffect(() => {
    if (actionPanelVm.ancientChargeDeclaration?.selectorMode != null) {
      handleCloseAutocastInfo();
      handleCloseSolarModal();
      handleCloseSiphonInspection();
    }
  }, [
    actionPanelVm.ancientChargeDeclaration?.selectorMode,
    handleCloseAutocastInfo,
    handleCloseSiphonInspection,
    handleCloseSolarModal,
  ]);

  useEffect(() => {
    setMobileChatReadState((state) => {
      if (state.gameCode !== leftRailVm.gameCode) {
        return {
          gameCode: leftRailVm.gameCode,
          lastSeenChatMessageCount: currentChatMessageCount,
          baselineEstablished: false,
        };
      }

      if (!state.baselineEstablished) {
        return {
          ...state,
          lastSeenChatMessageCount: currentChatMessageCount,
          baselineEstablished: true,
        };
      }

      if (
        activeTakeover === 'chat' ||
        currentChatMessageCount < state.lastSeenChatMessageCount
      ) {
        if (state.lastSeenChatMessageCount === currentChatMessageCount) {
          return state;
        }

        return {
          ...state,
          lastSeenChatMessageCount: currentChatMessageCount,
        };
      }

      return state;
    });
  }, [activeTakeover, currentChatMessageCount, leftRailVm.gameCode]);

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
    handleCloseSolarModal();
    handleCloseSiphonInspection();
    setActiveFleetShipHover(null);
    handleCloseAutocastInfo();
  }, [
    activeDestroyTargetSourceInstanceId,
    handleCloseAutocastInfo,
    handleCloseSiphonInspection,
    handleCloseSolarModal,
    handleCloseStatPopovers,
  ]);

  useEffect(() => {
    setActiveShipModalId(null);
    handleCloseSolarModal();
    handleCloseSiphonInspection();
    setActiveFleetShipHover(null);
    setActiveMobileBottomPanel('normal');
    handleCloseStatPopovers();
    handleCloseAutocastInfo();
  }, [
    actionPanelVm.menu.phaseKey,
    actionPanelVm.menu.turnNumber,
    boardVm.mode,
    isGameOver,
    handleCloseAutocastInfo,
    handleCloseSiphonInspection,
    handleCloseSolarModal,
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
    <div
      className="h-full min-h-0 w-full min-w-0 overflow-hidden flex flex-col bg-transparent text-white"
      data-turn-phase-milestone={turnPhasesVm.currentMilestone ?? undefined}
    >
      <div
        aria-hidden={isMissionInteractionLocked}
        inert={(isMissionInteractionLocked ? '' : undefined) as unknown as boolean | undefined}
        className={cx(isMissionInteractionLocked && 'pointer-events-none')}
      >
        <MobileTopNav
          turnLabel={turnLabel}
          isGameOver={isGameOver}
          activeTakeover={activeTakeover}
          unreadChatCount={mobileUnreadChatCount}
          onReturnToBoard={handleReturnToBoard}
          onOpenChat={handleOpenChat}
          onOpenBattleLog={handleOpenBattleLog}
          onOpenMenu={handleOpenMenu}
        />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col pt-[8px]">
        <div
          aria-hidden={activeTakeover !== null || isMissionInteractionLocked}
          inert={
            ((activeTakeover !== null || isMissionInteractionLocked) ? '' : undefined) as unknown as
              boolean | undefined
          }
          className={cx(
            'flex min-h-0 flex-1 flex-col',
            activeTakeover !== null && 'pointer-events-none opacity-0',
            isMissionInteractionLocked && 'pointer-events-none'
          )}
        >
          {boardVm.mode === 'board' ? (
            <MobileBoardView
              hudVm={hudVm}
              boardVm={boardVm}
              leftRailVm={leftRailVm}
              turnPhasesVm={turnPhasesVm}
              turnPhasePresentation={turnPhasePresentation}
              isBattleReveal={isBattleReveal}
              matchupIntro={matchupIntro}
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
              <MobileBottomPhase
                vm={bottomActionRailVm}
                mainPhaseControl={mainPhaseControl}
              />
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
                  onSolarPowerInspect={handleSolarPowerInspect}
                  siphonInspectionOpen={isSiphonInspectionOpen}
                  onCloseSiphonInspection={handleCloseSiphonInspection}
                  onOpenAutocastInfo={handleOpenAutocastInfo}
                  onOpenMenuTakeover={handleOpenMenu}
                  simulacrumSpecies={simulacrumSpecies}
                />
              )}
            </div>
          </div>
        </div>

        {activeTakeover && !isMissionInteractionLocked ? (
          <div className="absolute inset-0 z-[70] flex min-h-0 flex-col mt-[16px]">
            {shouldShowEndGameStatsTakeover ? (
              <MobileEndGameStatsTakeover
                gameStats={gameStats}
                onCloseStats={handleCloseGameStats}
              />
            ) : activeTakeover === 'chat' ? (
              <MobileChatTakeover vm={leftRailVm} actions={actions} onClose={handleReturnToBoard} />
            ) : activeTakeover === 'battleLog' ? (
              <MobileBattleLogTakeover
                vm={leftRailVm}
                isGameFinished={isGameOver}
                onDownloadBattleLog={actions.onDownloadBattleLog}
                onClose={handleReturnToBoard}
              />
            ) : actionPanelVm.endOfGame != null ? (
              <MobileEndOfGameMenuTakeover
                endOfGame={actionPanelVm.endOfGame}
                canViewGameStats={canViewGameStats}
                showChallengeAction={canShowPostgameMissionChallengeAction}
                onOpenChallenge={handleOpenPostgameMissionChallenge}
                onOpenGameStats={handleOpenGameStats}
                onClose={handleReturnToBoard}
                onReturnToMainMenu={onReturnToMainMenu}
                onRematch={actions.onRematch}
                onDownloadBattleLog={actions.onDownloadBattleLog}
              />
            ) : (
              <MobileMenuTakeover
                vm={actionPanelVm.menu}
                turnPhasesVm={turnPhasesVm}
                turnPhasePresentation={turnPhasePresentation}
                actions={actions}
                showChallengeAction={canShowMissionChallengeAction}
                onOpenChallenge={handleOpenMissionChallenge}
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

      {missionOverlayMode && missionChallenge && boardVm.mode === 'board' ? (
        <div
          className={cx(
            'pointer-events-auto fixed inset-x-0 bottom-0 z-[50] flex items-center justify-center py-[16px]',
            missionOverlayMode === 'result' ? 'top-[45px]' : 'top-0'
          )}
          onClick={(event) => {
            if (
              event.target !== event.currentTarget ||
              missionOverlayMode === 'initial'
            ) {
              return;
            }

            if (missionOverlayMode === 'result') {
              setPostgameMissionPresentation(null);
            } else {
              setIsMissionReopenOpen(false);
            }
          }}
        >
          <MissionChallengeOverlay
            loreUnlocked={
              missionOverlayMode === 'result'
                ? postgameMissionPresentation?.loreUnlocked ?? false
                : false
            }
            missionChallenge={missionChallenge}
            mode={missionOverlayMode}
            onChallengeShipInspect={handleMissionChallengeShipInspect}
            onClose={missionOverlayMode === 'result'
              ? () => setPostgameMissionPresentation(null)
              : () => setIsMissionReopenOpen(false)}
            onPlay={actions.onAcknowledgeMissionIntro}
            onSetMinimizeMissionsThisSession={
              actions.onSetMinimizeMissionsThisSession
            }
            opponentSpecies={boardVm.opponentSpeciesId}
            playerName={
              viewer.viewerMode === 'p1_player'
                ? viewer.p1Name
                : viewer.viewerMode === 'p2_player'
                  ? viewer.p2Name
                  : ''
            }
            playerSpecies={boardVm.mySpeciesId}
          />
        </div>
      ) : null}

      {!isMissionInteractionLocked && activeTakeover === null && boardVm.mode === 'board' && statPopoverAnchors ? (
        <MobileStatBreakdownPopovers
          boardVm={boardVm}
          topAnchorRect={statPopoverAnchors.top}
          bottomAnchorRect={statPopoverAnchors.bottom}
          topPopoverRef={topStatPopoverRef}
          bottomPopoverRef={bottomStatPopoverRef}
        />
      ) : null}

      {!isMissionInteractionLocked && activeTakeover === null && activeShipModalId ? (
        <MobileShipModal
          shipId={activeShipModalId}
          buildCatalogue={actionPanelVm.buildCatalogue}
          actions={mobileActions}
          onClose={() => setActiveShipModalId(null)}
        />
      ) : null}

      {!isMissionInteractionLocked && activeTakeover === null && activeSolarModalId ? (
        <MobileSolarPowerModal
          solarPowerId={activeSolarModalId}
          declarationVm={actionPanelVm.ancientChargeDeclaration}
          isDeclarationStageActive={
            actionPanelVm.menu.phaseKey === 'battle.charge_declaration'
          }
          actions={mobileActions}
          onViewSiphon={handleViewSiphon}
          onClose={handleCloseSolarModal}
        />
      ) : null}

      {!isMissionInteractionLocked && activeTakeover === null && isAutocastInfoOpen ? (
        <MobileAutocastInfoModal onClose={handleCloseAutocastInfo} />
      ) : null}

      {!isMissionInteractionLocked && activeTakeover === null && activeFleetShipHover ? (
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

      {missionOverlayMode && missionReferenceShipId ? (
        <MobileShipModal
          shipId={missionReferenceShipId}
          buildCatalogue={actionPanelVm.buildCatalogue}
          actions={mobileActions}
          referenceOnly={true}
          onClose={() => setMissionReferenceShipId(null)}
        />
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
