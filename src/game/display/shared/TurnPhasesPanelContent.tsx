import type { TurnPhaseVm } from '../../client/useGameSession';
import { LeftRailScrollArea } from '../layout/leftRail/LeftRailScrollArea';
import { TurnPhaseList } from './TurnPhaseList';

export function TurnPhasesPanelContent({ vm }: { vm: TurnPhaseVm }) {
  return (
    <LeftRailScrollArea outerClassName="basis-0 flex-1 px-[18px] py-[14px]">
      <TurnPhaseList vm={vm} />
    </LeftRailScrollArea>
  );
}
