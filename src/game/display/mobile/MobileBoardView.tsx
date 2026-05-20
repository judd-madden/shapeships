import type {
  BoardViewModel,
  HudViewModel,
  LeftRailViewModel,
} from '../../client/useGameSession';
import { FleetArea, toSpeciesKey } from '../layout/boardStage/FleetArea';
import { usePresentedFleetRevealPulse } from '../layout/boardStage/usePresentedFleetRevealPulse';
import { MobileStatusRail } from './MobileStatusRail';

type MobileBoardViewModel = Extract<BoardViewModel, { mode: 'board' }>;

interface MobileBoardViewProps {
  hudVm: HudViewModel;
  boardVm: MobileBoardViewModel;
  leftRailVm: LeftRailViewModel;
}

export function MobileBoardView({ hudVm, boardVm, leftRailVm }: MobileBoardViewProps) {
  const opponentSpeciesKey = toSpeciesKey(boardVm.opponentSpeciesId);
  const mySpeciesKey = toSpeciesKey(boardVm.mySpeciesId);
  const leftRevealPulse = usePresentedFleetRevealPulse(boardVm.presentedMyRevealBlurSeq ?? 0);
  const rightRevealPulse = usePresentedFleetRevealPulse(boardVm.presentedOpponentRevealBlurSeq);

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full">
      <div
        aria-label="Opponent fleet area"
        className="flex flex-1 min-h-0 w-full overflow-visible"
      >
        <FleetArea
          title="OPPONENT FLEET"
          ships={boardVm.opponentFleet}
          voidShips={boardVm.opponentVoidFleet}
          order={boardVm.opponentFleetRenderOrder}
          species={opponentSpeciesKey}
          animTokens={boardVm.fleetAnim.opponent}
          flipEnabled={boardVm.mode === 'board'}
          side="opponent"
          activationIndexMap={boardVm.activationStaggerPlan?.opponentIndexByShipId}
          healthDeltaFlash={boardVm.opponentFleetHealthDeltaFlash}
          turnPulse={rightRevealPulse}
          fitMinScale={0.25}
          liveRowsLayout="pairedRows"
          liveLayoutCanvasClassName="w-[360px] h-[130px]"
          fitVoidToSlot
          voidSlotClassName="h-[28px]"
          voidFitMinScale={0.15}
          voidFitMaxScale={0.6}
          voidGapClassName="gap-[8px]"
        />
      </div>
      <MobileStatusRail hudVm={hudVm} boardVm={boardVm} leftRailVm={leftRailVm} />
      <div
        aria-label="Player fleet area"
        className="flex flex-1 min-h-0 w-full overflow-visible"
      >
        <FleetArea
          title="MY FLEET"
          ships={boardVm.myFleet}
          voidShips={boardVm.myVoidFleet}
          order={boardVm.myFleetRenderOrder}
          species={mySpeciesKey}
          animTokens={boardVm.fleetAnim.my}
          flipEnabled={boardVm.mode === 'board'}
          side="my"
          activationIndexMap={boardVm.activationStaggerPlan?.myIndexByShipId}
          healthDeltaFlash={boardVm.myFleetHealthDeltaFlash}
          turnPulse={leftRevealPulse}
          fitMinScale={0.25}
          liveRowsLayout="pairedRows"
          liveLayoutCanvasClassName="w-[360px] h-[130px]"
          fitVoidToSlot
          voidSlotClassName="h-[28px]"
          voidFitMinScale={0.15}
          voidFitMaxScale={0.6}
          voidGapClassName="gap-[8px]"
        />
      </div>
    </div>
  );
}
