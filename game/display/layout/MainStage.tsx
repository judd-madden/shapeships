/**
 * Main Stage
 * Main game area with TopHud, BoardStage, BottomActionRail, and ActionPanel
 * NO LOGIC - composition matching Figma design exactly (Pass 1.25)
 */

import { GameVerticalLine } from '../../../components/ui/primitives';
import { TopHud } from './TopHud';
import { BoardStage } from './BoardStage';
import { BottomActionRail } from './BottomActionRail';
import { ActionPanelFrame } from '../actionPanel/ActionPanelFrame';
import { Tab } from '../../../components/ui/primitives/navigation/Tab';
import type { 
  HudViewModel, 
  BoardViewModel, 
  BottomActionRailViewModel, 
  ActionPanelViewModel,
  GameSessionActions 
} from '../../client/useGameSession';

interface MainStageProps {
  hudVm: HudViewModel;
  boardVm: BoardViewModel;
  bottomActionRailVm: BottomActionRailViewModel;
  actionPanelVm: ActionPanelViewModel;
  actions: GameSessionActions;
}

export function MainStage({ 
  hudVm, 
  boardVm, 
  bottomActionRailVm, 
  actionPanelVm, 
  actions 
}: MainStageProps) {
  return (
    <div
      className="content-stretch flex flex-col items-center relative flex-1 min-w-0 h-full py-[30px]"
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
        <BoardStage vm={boardVm} actions={actions} />

        {/* Bottom Action Rail - hidden during choose species */}
        {boardVm.mode !== 'choose_species' && (
          <BottomActionRail vm={bottomActionRailVm} actions={actions} />
        )}
      </div>

      {/* Action Panel Wrapper */}
      <div
        className="content-stretch flex flex-col h-[340px] items-end relative w-full"
        data-name="Action Panel Wrapper"
      >
        {/* Action Panel Tabs */}
        <div
          className="content-stretch flex gap-[8px] items-center justify-end relative shrink-0 z-30 top-[-2px] right-[-2px]"
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

        {/* Action Panel Content */}
        <div
          className="bg-black h-[300px] relative rounded-bl-[10px] rounded-br-[10px] rounded-tl-[10px]  w-full z-10"
          data-name="AP - Action Panel CONTENT"
        >
          <div
            aria-hidden="true"
            className="absolute border-2 border-[#555] border-solid inset-[-2px] pointer-events-none rounded-bl-[12px] rounded-br-[12px] rounded-tl-[12px]"
          />
          <ActionPanelFrame vm={actionPanelVm} />
        </div>
      </div>
    </div>
  );
}