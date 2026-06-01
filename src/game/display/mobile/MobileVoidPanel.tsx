import type { BoardViewModel, HudViewModel } from '../../client/useGameSession';
import { VoidFleetStrip } from '../layout/boardStage/FleetArea';
import type { VoidFleetStackVm } from '../layout/boardStage/FleetArea';

type MobileBoardViewModel = Extract<BoardViewModel, { mode: 'board' }>;

const MOBILE_VOID_CELL_FIT_MAX_SCALE = 0.6;

interface MobileVoidPanelProps {
  hudVm: HudViewModel;
  boardVm: MobileBoardViewModel;
}

export function MobileVoidPanel({ hudVm, boardVm }: MobileVoidPanelProps) {
  return (
    <div
      aria-label="Mobile Void panel"
      className="relative h-[204px] w-full shrink-0 border-t border-[var(--shapeships-grey-70)] bg-black"
    >
      <div className="h-full overflow-y-auto overflow-x-hidden">
        <div className="flex min-h-full w-full flex-col items-center justify-center px-[16px] py-[16px]">
          <VoidGroup
            heading={`${hudVm.p2Name} Void`}
            ships={boardVm.opponentVoidFleet}
            order={boardVm.opponentFleetRenderOrder}
          />
          <div className="my-[16px] h-px w-full shrink-0 bg-[var(--shapeships-grey-70)]" />
          <VoidGroup
            heading={`${hudVm.p1Name} Void`}
            ships={boardVm.myVoidFleet}
            order={boardVm.myFleetRenderOrder}
          />
        </div>
      </div>
    </div>
  );
}

function VoidGroup({
  heading,
  ships,
  order,
}: {
  heading: string;
  ships: VoidFleetStackVm[];
  order: string[];
}) {
  return (
    <section className="flex w-full shrink-0 flex-col items-center">
      <h2 className="text-center text-[14px] font-normal leading-none text-white">
        {heading}
      </h2>
      <div className="mt-[12px] flex min-h-[32px] w-full items-center justify-center overflow-visible">
        <VoidFleetStrip
          ships={ships}
          order={order}
          wrap
          fitToCell
          className="max-w-full justify-center origin-center"
          gapClassName="gap-[8px]"
          cellClassName="relative flex items-center justify-center overflow-visible"
          cellHeightClassName="h-[32px]"
          cellWidthClassName="w-[32px]"
          scaleClassName={false}
          cellFitMinScale={0.15}
          cellFitMaxScale={MOBILE_VOID_CELL_FIT_MAX_SCALE}
          cellFitInitialScale={MOBILE_VOID_CELL_FIT_MAX_SCALE}
          cellFitAnimateScale={false}
          cellFitMeasureImmediatelyOnMount
        />
      </div>
    </section>
  );
}
