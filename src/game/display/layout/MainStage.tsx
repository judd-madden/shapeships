/**
 * Main Stage
 * Main game area with TopHud, BoardStage, BottomActionRail, and ActionPanel
 * NO LOGIC - composition matching Figma design exactly (Pass 1.25)
 */

import { useEffect, useMemo, useState } from 'react';
import { GameVerticalLine } from '../../../components/ui/primitives';
import { TopHud } from './TopHud';
import { BoardStage } from './BoardStage';
import { BottomActionRail } from './BottomActionRail';
import { ActionPanelFrame } from '../actionPanel/ActionPanelFrame';
import { Tab } from '../../../components/ui/primitives/navigation/Tab';
import { GameStatsOverlayShell } from '../stats/GameStatsOverlayShell';
import type { 
  HudViewModel, 
  BoardViewModel, 
  BottomActionRailViewModel, 
  ActionPanelViewModel,
  GameSessionActions,
  GameSessionViewModel,
} from '../../client/useGameSession';

interface MainStageProps {
  hudVm: HudViewModel;
  boardVm: BoardViewModel;
  bottomActionRailVm: BottomActionRailViewModel;
  actionPanelVm: ActionPanelViewModel;
  gameStats: GameSessionViewModel['gameStats'];
  actions: GameSessionActions;
  onReturnToMainMenu: () => void;
}

export function MainStage({ 
  hudVm, 
  boardVm, 
  bottomActionRailVm, 
  actionPanelVm, 
  gameStats,
  actions,
  onReturnToMainMenu
}: MainStageProps) {
  const [isGameStatsOpen, setIsGameStatsOpen] = useState(false);
  const isEndGameResultPanel = actionPanelVm.activePanelId === 'ap.end_of_game.result';
  const canViewGameStats = gameStats != null;
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
        className="content-stretch flex flex-col grow items-center justify-between mb-[-24px] min-h-px min-w-px relative w-full z-20"
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
          <BottomActionRail vm={bottomActionRailVm} actions={actions} />
        )}
      </div>

      {/* Action Panel Wrapper */}
      <div
        className="content-stretch flex flex-col h-[344px] items-end relative w-full"
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
                disabled={actionPanelVm.tabInteractionLocked === true}
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
            onReturnToMainMenu={onReturnToMainMenu}
          />
        </div>
      </div>
    </div>
  );
}
