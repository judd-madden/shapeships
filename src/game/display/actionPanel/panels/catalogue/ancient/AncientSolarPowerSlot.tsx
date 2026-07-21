import type { ComponentType, MouseEventHandler } from 'react';
import {
  AncientEnergyCostPips,
  type AncientEnergyCostRow,
} from './AncientEnergyDisplay';

interface AncientSolarPowerSlotProps {
  graphic: ComponentType<{ className?: string }>;
  costRows: readonly AncientEnergyCostRow[];
  costPlacement?: 'right' | 'below';
  showPlus?: boolean;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
}

export function AncientSolarPowerSlot({
  graphic: Graphic,
  costRows,
  costPlacement = 'right',
  showPlus = false,
  onMouseEnter,
  onMouseLeave,
}: AncientSolarPowerSlotProps) {
  return (
    <div
      className={
        costPlacement === 'below'
          ? 'flex flex-col items-center gap-[8px]'
          : 'flex items-center gap-[8px]'
      }
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
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
    </div>
  );
}
