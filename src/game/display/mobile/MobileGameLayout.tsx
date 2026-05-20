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

export function MobileGameLayout({
  hudVm,
  boardVm,
  leftRailVm,
  bottomActionRailVm,
  actionPanelVm,
  actions,
}: MobileGameLayoutProps) {
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
          <MobileBottomPhase vm={bottomActionRailVm} actions={actions} />
        ) : (
          <MobileSpeciesConfirmPhase
            boardVm={boardVm}
            bottomActionRailVm={bottomActionRailVm}
            actions={actions}
          />
        )}
        <MobileBottomTabs vm={actionPanelVm} actions={actions} />
      </div>
    </div>
  );
}
