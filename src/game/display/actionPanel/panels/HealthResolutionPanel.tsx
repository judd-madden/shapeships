import type {
  HealthResolutionPresentationVm,
  HealthResolutionSideVm,
} from '../../../client/gameSession/types';

interface HealthResolutionPanelProps {
  vm: HealthResolutionPresentationVm;
  layout?: 'desktop' | 'mobile';
}

function getValueColor(side: HealthResolutionSideVm): string {
  switch (side.valueTone) {
    case 'damage':
      return 'var(--shapeships-pastel-red)';
    case 'heal':
      return 'var(--shapeships-pastel-green)';
    case 'neutral':
    default:
      return 'var(--shapeships-grey-50)';
  }
}

function OutcomeLine({
  side,
  layout,
}: {
  side: HealthResolutionSideVm;
  layout: 'desktop' | 'mobile';
}) {
  return (
    <p
      className={`max-w-full whitespace-nowrap font-['Roboto'] font-normal leading-none text-white ${
        layout === 'mobile' ? 'text-[22px]' : 'text-[clamp(26px,2.9vw,44px)]'
      }`}
      style={{ fontVariationSettings: "'wdth' 100" }}
    >
      <span>{side.prefixText}</span>
      <span className="font-bold" style={{ color: getValueColor(side) }}>
        {side.valueText}
      </span>
      <span>{side.suffixText}</span>
    </p>
  );
}

function PlayerResult({
  side,
  layout,
  alignment,
}: {
  side: HealthResolutionSideVm;
  layout: 'desktop' | 'mobile';
  alignment: 'left' | 'right';
}) {
  const isMobile = layout === 'mobile';

  return (
    <div
      className={`flex w-full min-w-0 max-w-full flex-col ${
        isMobile ? 'gap-[4px]' : 'gap-[24px]'
      } ${alignment === 'right' ? 'items-end text-right' : 'items-start text-left'}`}
    >
      <p
        className={`w-full truncate font-['Roboto'] font-medium leading-none text-white ${
          isMobile ? 'text-[14px]' : 'text-[clamp(18px,1.7vw,26px)]'
        }`}
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {side.nameText}
      </p>
      <OutcomeLine side={side} layout={layout} />
    </div>
  );
}

function TurnCard({
  turnNumber,
  layout,
}: {
  turnNumber: number;
  layout: 'desktop' | 'mobile';
}) {
  const usesTeenNumberAdjustment = turnNumber >= 10 && turnNumber <= 19;
  const numberTrackingClass = usesTeenNumberAdjustment
    ? 'tracking-[-0.12em]'
    : 'tracking-[-0.04em]';
  const numberStyle = usesTeenNumberAdjustment
    ? { transform: `translateX(${layout === 'mobile' ? '-6px' : '-12px'})` }
    : undefined;

  if (layout === 'mobile') {
    return (
      <div className="flex min-w-[125px] flex-col items-center justify-center gap-0 rounded-[10px] bg-white px-[20px] py-[15px] text-center text-black">
        <p className="font-['Roboto'] text-[13px] font-medium leading-none">Turn</p>
        <p
          className={`font-['Roboto'] text-[75px] font-black leading-none ${numberTrackingClass}`}
          style={numberStyle}
        >
          {turnNumber}
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center gap-0 rounded-[20px] bg-white text-center text-black"
      style={{
        minWidth: 'clamp(160px, 16vw, 250px)',
        paddingInline: 'clamp(20px, 2.6vw, 40px)',
        paddingBlock: 'clamp(20px, 2vw, 30px)',
      }}
    >
      <p className="font-['Roboto'] text-[clamp(18px,1.7vw,26px)] font-medium leading-none">
        Turn
      </p>
      <p
        className={`font-['Roboto'] text-[clamp(90px,9.8vw,150px)] font-black leading-none ${numberTrackingClass}`}
        style={numberStyle}
      >
        {turnNumber}
      </p>
    </div>
  );
}

export function HealthResolutionPanel({ vm, layout = 'desktop' }: HealthResolutionPanelProps) {
  if (layout === 'mobile') {
    return (
      <div className="relative flex size-full items-center justify-center overflow-hidden bg-black px-[12px]">
        <div className="grid w-full max-w-[420px] grid-cols-[125px_minmax(0,1fr)] items-center gap-[20px]">
          <TurnCard turnNumber={vm.displayTurnNumber} layout="mobile" />

          <div className="flex min-w-0 flex-col items-start">
            <PlayerResult side={vm.right} layout="mobile" alignment="left" />
            <div
              aria-hidden="true"
              className="my-[16px] h-px w-full shrink-0 bg-[var(--shapeships-grey-70)]"
            />
            <PlayerResult side={vm.left} layout="mobile" alignment="left" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex size-full items-center justify-center overflow-hidden rounded-[8px] bg-black px-[clamp(12px,2vw,40px)]">
      <div
        className="grid w-full max-w-[1300px] items-center"
        style={{
          gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
          columnGap: 'clamp(20px, 3vw, 50px)',
        }}
      >
        <div className="w-full min-w-0">
          <PlayerResult side={vm.left} layout="desktop" alignment="right" />
        </div>

        <TurnCard turnNumber={vm.displayTurnNumber} layout="desktop" />

        <div className="w-full min-w-0">
          <PlayerResult side={vm.right} layout="desktop" alignment="left" />
        </div>
      </div>
    </div>
  );
}
