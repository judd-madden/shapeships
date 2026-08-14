/**
 * Main Stage
 * Main game area with TopHud, BoardStage, BottomActionRail, and ActionPanel
 * NO LOGIC - composition matching Figma design exactly (Pass 1.25)
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { GameVerticalLine } from '../../../components/ui/primitives';
import { TopHud } from './TopHud';
import { BoardStage } from './BoardStage';
import { BottomActionRail } from './BottomActionRail';
import { ActionPanelFrame } from '../actionPanel/ActionPanelFrame';
import { resolveAncientSimulacrumSpecies } from '../actionPanel/panels/catalogue/ancient/resolveAncientSimulacrumSpecies';
import { Tab } from '../../../components/ui/primitives/navigation/Tab';
import { GameStatsOverlayShell } from '../stats/GameStatsOverlayShell';
import { MissionChallengeOverlay } from '../mission/MissionChallengeOverlay';
import {
  getMissionPresentationIdentity,
  isNewVisibleMissionPresentation,
  shouldLockMissionInteraction,
  shouldShowMissionChallengeAction,
  type MissionOverlayMode,
} from '../mission/missionChallengePresentation';
import type { MainPhaseControl } from '../shared/mainPhaseControl';
import type { 
  HudViewModel, 
  BoardViewModel, 
  BottomActionRailViewModel, 
  ActionPanelViewModel,
  GameSessionActions,
  GameSessionViewModel,
} from '../../client/useGameSession';

interface MainStageProps {
  gameId: string;
  hudVm: HudViewModel;
  boardVm: BoardViewModel;
  bottomActionRailVm: BottomActionRailViewModel;
  actionPanelVm: ActionPanelViewModel;
  gameStats: GameSessionViewModel['gameStats'];
  viewer: GameSessionViewModel['viewer'];
  missionChallenge: GameSessionViewModel['missionChallenge'];
  actions: GameSessionActions;
  soundEnabled: boolean;
  boardFlashEnabled: boolean;
  onSoundEnabledChange: (checked: boolean) => void;
  onBoardFlashEnabledChange: (checked: boolean) => void;
  onReturnToMainMenu: () => void;
}

export function MainStage({ 
  gameId,
  hudVm, 
  boardVm, 
  bottomActionRailVm, 
  actionPanelVm, 
  gameStats,
  viewer,
  missionChallenge,
  actions,
  soundEnabled,
  boardFlashEnabled,
  onSoundEnabledChange,
  onBoardFlashEnabledChange,
  onReturnToMainMenu
}: MainStageProps) {
  const [isGameStatsOpen, setIsGameStatsOpen] = useState(false);
  const [isSiphonInspectionOpen, setIsSiphonInspectionOpen] = useState(false);
  const [isMissionReopenOpen, setIsMissionReopenOpen] = useState(false);
  const previousMissionPresentationIdentityRef = useRef<string | null>(null);
  const markMissionFindingsSeenRef = useRef(actions.onMarkCurrentMissionFindingsSeen);
  markMissionFindingsSeenRef.current = actions.onMarkCurrentMissionFindingsSeen;
  const simulacrumSpecies = resolveAncientSimulacrumSpecies(boardVm);
  const isEndGameResultPanel = actionPanelVm.activePanelId === 'ap.end_of_game.result';
  const canViewGameStats = gameStats != null;
  const ancientSelectorMode = actionPanelVm.ancientChargeDeclaration?.selectorMode ?? null;
  const ancientDeclarationStage = actionPanelVm.ancientChargeDeclaration?.stage ?? null;
  const isAncientCatalogueSurfaceActive =
    actionPanelVm.activePanelId === 'ap.catalog.ships.ancient' ||
    actionPanelVm.activePanelId === 'ap.battle.solar_powers.ancient';
  const ancientPresentation =
    actionPanelVm.menu.phaseKey === 'battle.charge_declaration' &&
    ancientDeclarationStage === 'powers'
      ? 'declaration'
      : 'reference';
  const isBoardMode = boardVm.mode === 'board';
  const shouldShowInitialMission = Boolean(
    isBoardMode &&
    missionChallenge &&
    !missionChallenge.isFinished &&
    missionChallenge.shouldPresentInitialIntro,
  );
  const shouldShowReopenedMission = Boolean(
    !shouldShowInitialMission &&
    isBoardMode &&
    missionChallenge &&
    !missionChallenge.isFinished &&
    missionChallenge.introPending === false &&
    viewer.isPlayerViewer &&
    isMissionReopenOpen,
  );
  const missionOverlayMode: MissionOverlayMode | null = shouldShowInitialMission
    ? 'initial'
    : shouldShowReopenedMission
      ? 'reopen'
      : null;
  const isMissionOverlayVisible = missionOverlayMode !== null;
  const isMissionInteractionLocked = shouldLockMissionInteraction({
    introPending: missionChallenge?.introPending === true,
    overlayVisible: isMissionOverlayVisible,
  });
  const missionPresentationIdentity = missionChallenge
    ? getMissionPresentationIdentity({
        gameId,
        missionId: missionChallenge.mission.id,
        mode: missionOverlayMode,
      })
    : null;
  const canShowMissionChallengeAction = shouldShowMissionChallengeAction({
    hasMission: missionChallenge !== null,
    isPlayerViewer: viewer.isPlayerViewer,
    isFinished: missionChallenge?.isFinished ?? false,
    introPending: missionChallenge?.introPending ?? false,
  });
  const endGameResultKey = useMemo(() => {
    const endOfGame = actionPanelVm.endOfGame;

    if (!endOfGame) {
      return null;
    }

    return [
      endOfGame.bannerText,
      endOfGame.metaLeftText,
      endOfGame.metaRightText,
    ].join('\u0000');
  }, [actionPanelVm.endOfGame]);

  useEffect(() => {
    if (!isEndGameResultPanel || !canViewGameStats) {
      setIsGameStatsOpen(false);
    }
  }, [canViewGameStats, isEndGameResultPanel]);

  useEffect(() => {
    setIsGameStatsOpen(false);
  }, [endGameResultKey]);

  useEffect(() => {
    if (!isAncientCatalogueSurfaceActive || ancientSelectorMode != null) {
      setIsSiphonInspectionOpen(false);
    }
  }, [ancientSelectorMode, isAncientCatalogueSurfaceActive]);

  useEffect(() => {
    setIsSiphonInspectionOpen(false);
  }, [ancientDeclarationStage, ancientPresentation]);

  useEffect(() => {
    setIsMissionReopenOpen(false);
  }, [gameId, missionChallenge?.mission.id]);

  useLayoutEffect(() => {
    setIsMissionReopenOpen(false);
  }, [actionPanelVm.menu.phaseKey, actionPanelVm.menu.turnNumber]);

  useEffect(() => {
    if (
      missionChallenge === null ||
      missionChallenge.isFinished ||
      missionChallenge.introPending
    ) {
      setIsMissionReopenOpen(false);
    }
  }, [missionChallenge]);

  useEffect(() => {
    const previousIdentity = previousMissionPresentationIdentityRef.current;
    if (
      isNewVisibleMissionPresentation(
        previousIdentity,
        missionPresentationIdentity,
      )
    ) {
      markMissionFindingsSeenRef.current();
    }
    previousMissionPresentationIdentityRef.current = missionPresentationIdentity;
  }, [missionPresentationIdentity]);

  function handleOpenGameStats() {
    if (canViewGameStats) {
      setIsGameStatsOpen(true);
    }
  }

  function handleCloseGameStats() {
    setIsGameStatsOpen(false);
  }

  function handleToggleGameStats() {
    if (!canViewGameStats) {
      setIsGameStatsOpen(false);
      return;
    }

    setIsGameStatsOpen((current) => !current);
  }

  function handleOpenSiphonInspection() {
    if (isAncientCatalogueSurfaceActive && ancientSelectorMode == null) {
      setIsSiphonInspectionOpen(true);
    }
  }

  function handleOpenMissionChallenge() {
    if (
      missionChallenge &&
      !missionChallenge.isFinished &&
      missionChallenge.introPending === false &&
      viewer.isPlayerViewer
    ) {
      setIsMissionReopenOpen(true);
    }
  }

  function handleReadyActivate() {
    setIsSiphonInspectionOpen(false);
    actions.onReadyToggle();
  }

  function handleBackActivate() {
    if (ancientSelectorMode != null) {
      actions.onCancelAncientSolarSelector();
      return;
    }
    setIsSiphonInspectionOpen(false);
  }

  const usesMainBack =
    (ancientSelectorMode != null && ancientSelectorMode !== 'blackHole') ||
    (isSiphonInspectionOpen && ancientPresentation === 'declaration');
  const mainPhaseControl: MainPhaseControl =
    usesMainBack
      ? { mode: 'back', onActivate: handleBackActivate }
      : { mode: 'ready', onActivate: handleReadyActivate };

  return (
    <div
      className="content-stretch flex flex-col items-center relative flex-1 min-w-0 min-h-0 h-full pt-[30px] pb-[25px] min-[768px]:max-[1599px]:pb-[16px]"
      data-name="Main Stage"
    >
      {/* Background vertical line */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <GameVerticalLine
          className="absolute h-full left-[49.74%] max-w-none top-0"
        />
      </div>

      {/* Main Stage Wrapper */}
      <div
        className={`content-stretch flex flex-col grow items-center justify-between mb-[-24px] min-h-px min-w-px relative w-full z-20 ${
          isMissionInteractionLocked ? 'pointer-events-none' : ''
        }`}
        data-name="Main Stage Wrapper"
      >
        {/* Top Hud */}
        <TopHud vm={hudVm} />

        {/* Board Stage */}
        <BoardStage vm={boardVm} actions={actions} phaseKey={actionPanelVm.menu.phaseKey} />

        {isGameStatsOpen && gameStats ? (
          <div className="absolute left-0 right-0 top-[100px] bottom-[-170px] z-40 flex items-stretch justify-center ">
            <div className="h-full w-full">
              <GameStatsOverlayShell
                gameStats={gameStats}
                onClose={handleCloseGameStats}
                variant="desktop"
              />
            </div>
          </div>
        ) : null}

        {/* Bottom Action Rail - hidden during choose species */}
        {boardVm.mode !== 'choose_species' && (
          <BottomActionRail
            vm={bottomActionRailVm}
            actions={actions}
            mainPhaseControl={mainPhaseControl}
          />
        )}
      </div>

      {/* Action Panel Wrapper */}
      <div
        className={`content-stretch flex flex-col h-[344px] items-end relative w-full ${
          isMissionInteractionLocked ? 'pointer-events-none' : ''
        }`}
        data-name="Action Panel Wrapper"
      >
        {isGameStatsOpen ? (
          <div
            aria-hidden="true"
            className="h-[42px] w-full shrink-0"
            data-name="Action Panel Tabs Spacer"
          />
        ) : (
          /* Action Panel Tabs */
          <div
            className="content-stretch flex gap-[8px] h-[42px] items-center justify-end relative shrink-0 z-30"
            data-name="Action Panel Tabs"
          >
            {actionPanelVm.tabs.filter(t => t.visible).map((tab) => (
              <Tab
                key={tab.tabId}
                label={tab.label}
                selected={actionPanelVm.activePanelId === tab.targetPanelId}
                onClick={() => actions.onActionPanelTabClick(tab.tabId)}
              />
            ))}
          </div>
        )}

        {/* Action Panel Content */}
        <div
          className={`bg-black h-[302px] border-2 border-[var(--shapeships-grey-70)] border-solid relative rounded-bl-[10px] rounded-br-[10px] rounded-tl-[10px] w-full ${
            actionPanelVm.healthResolutionOverlay ? 'z-[70]' : 'z-10'
          }`}
          data-name="AP - Action Panel CONTENT"
        >
          <div
            aria-hidden="true"
            className="absolute pointer-events-none rounded-bl-[12px] rounded-br-[12px] rounded-tl-[12px]"
          />
          <ActionPanelFrame
            vm={actionPanelVm}
            actions={actions}
            isGameStatsOpen={isGameStatsOpen}
            canViewGameStats={canViewGameStats}
            onOpenGameStats={handleOpenGameStats}
            onToggleGameStats={handleToggleGameStats}
            soundEnabled={soundEnabled}
            boardFlashEnabled={boardFlashEnabled}
            onSoundEnabledChange={onSoundEnabledChange}
            onBoardFlashEnabledChange={onBoardFlashEnabledChange}
            onReturnToMainMenu={onReturnToMainMenu}
            showChallengeAction={canShowMissionChallengeAction}
            onOpenChallenge={handleOpenMissionChallenge}
            simulacrumSpecies={simulacrumSpecies}
            siphonInspectionOpen={isSiphonInspectionOpen}
            onOpenSiphonInspection={handleOpenSiphonInspection}
            onCloseSiphonInspection={() => setIsSiphonInspectionOpen(false)}
          />
        </div>
      </div>

      {missionOverlayMode && missionChallenge && isBoardMode ? (
        <div className="pointer-events-auto absolute inset-0 z-50 flex items-start justify-center pb-[16px] pt-[170px] min-[768px]:max-[1599px]:pt-[120px]">
          <MissionChallengeOverlay
            missionChallenge={missionChallenge}
            mode={missionOverlayMode}
            onClose={() => setIsMissionReopenOpen(false)}
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
    </div>
  );
}
