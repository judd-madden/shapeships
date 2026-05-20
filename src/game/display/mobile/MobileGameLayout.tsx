import type {
  ActionPanelViewModel,
  BoardViewModel,
  BottomActionRailViewModel,
  GameSessionActions,
  HudViewModel,
  LeftRailViewModel,
} from '../../client/useGameSession';
import { MobileBoardView } from './MobileBoardView';
import { MobileBottomPhase } from './MobileBottomPhase';
import { MobileBottomTabs } from './MobileBottomTabs';
import { MobileTopNav } from './MobileTopNav';

type MobileBoardViewModel = Extract<BoardViewModel, { mode: 'board' }>;

interface MobileGameLayoutProps {
  hudVm: HudViewModel;
  boardVm: MobileBoardViewModel;
  leftRailVm: LeftRailViewModel;
  bottomActionRailVm: BottomActionRailViewModel;
  actionPanelVm: ActionPanelViewModel;
  actions: GameSessionActions;
}

export function MobileGameLayout({
  hudVm,
  boardVm,
  leftRailVm,
  bottomActionRailVm,
  actionPanelVm,
  actions,
}: MobileGameLayoutProps) {
  return (
    <div className="h-dvh min-h-dvh w-full min-w-0 overflow-hidden flex flex-col bg-[var(--shapeships-black)] text-white font-['Roboto']">
      <MobileTopNav turnNumber={leftRailVm.turn} />

      <MobileBoardView
        hudVm={hudVm}
        boardVm={boardVm}
        leftRailVm={leftRailVm}
      />

      <div className="shrink-0 flex flex-col gap-[12px] w-full">
        <MobileBottomPhase vm={bottomActionRailVm} actions={actions} />
        <MobileBottomTabs vm={actionPanelVm} actions={actions} />
      </div>
    </div>
  );
}
