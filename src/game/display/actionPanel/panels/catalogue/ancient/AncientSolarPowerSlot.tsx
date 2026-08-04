import type { ComponentType, MouseEventHandler } from 'react';
import {
  AncientEnergyCostPips,
  type AncientEnergyCostRow,
} from './AncientEnergyDisplay';

interface AncientSolarPowerSlotProps {
  graphic: ComponentType<{ className?: string }>;
  costRows: readonly AncientEnergyCostRow[];
  isDimmed?: boolean;
  costPlacement?: 'right' | 'below';
  showPlus?: boolean;
  onMouseEnter?: MouseEventHandler<HTMLElement>;
  onMouseLeave?: MouseEventHandler<HTMLElement>;
  onClick?: () => void;
  ariaLabel?: string;
}

export function AncientSolarPowerSlot({
  graphic: Graphic,
  costRows,
  isDimmed = false,
  costPlacement = 'right',
  showPlus = false,
  onMouseEnter,
  onMouseLeave,
  onClick,
  ariaLabel,
}: AncientSolarPowerSlotProps) {
  const className = costPlacement === 'below'
    ? 'ss-catalogueShipGraphic flex flex-col items-center gap-[8px] border-0 bg-transparent p-0 text-inherit'
    : 'ss-catalogueShipGraphic flex items-center gap-[8px] border-0 bg-transparent p-0 text-inherit';
  const content = (
    <>
      <Graphic />
      <AncientEnergyCostPips rows={costRows} />
      {showPlus ? (
        <span
          aria-hidden="true"
          className="shrink-0 font-['Roboto'] text-[38px] font-bold leading-none text-white"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          +
        </span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        className={`${className} cursor-pointer`}
        style={{ opacity: isDimmed ? 0.4 : 1 }}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={className}
      aria-disabled="true"
      style={{ opacity: isDimmed ? 0.4 : 1 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {content}
    </div>
  );
}
