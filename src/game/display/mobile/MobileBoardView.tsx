import type {
  BoardViewModel,
  HudViewModel,
  LeftRailViewModel,
} from '../../client/useGameSession';
import { MobileStatusRail } from './MobileStatusRail';

type MobileBoardViewModel = Extract<BoardViewModel, { mode: 'board' }>;

interface MobileBoardViewProps {
  hudVm: HudViewModel;
  boardVm: MobileBoardViewModel;
  leftRailVm: LeftRailViewModel;
}

export function MobileBoardView({ hudVm, boardVm, leftRailVm }: MobileBoardViewProps) {
  return (
    <div className="flex-1 min-h-0 flex flex-col w-full">
      <MobileFleetPlaceholder ariaLabel="Opponent fleet area placeholder" />
      <MobileStatusRail hudVm={hudVm} boardVm={boardVm} leftRailVm={leftRailVm} />
      <MobileFleetPlaceholder ariaLabel="Player fleet area placeholder" />
    </div>
  );
}

function MobileFleetPlaceholder({ ariaLabel }: { ariaLabel: string }) {
  return (
    <div
      aria-label={ariaLabel}
      className="flex-1 min-h-0 w-full overflow-hidden"
    />
  );
}
