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
  onMouseEnter?: MouseEventHandler<HTMLElement>;
  onMouseLeave?: MouseEventHandler<HTMLElement>;
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export function AncientSolarPowerSlot({
  graphic: Graphic,
  costRows,
  costPlacement = 'right',
  showPlus = false,
  onMouseEnter,
  onMouseLeave,
  onClick,
  disabled = false,
  ariaLabel,
}: AncientSolarPowerSlotProps) {
  const className = costPlacement === 'below'
    ? 'flex flex-col items-center gap-[8px] border-0 bg-transparent p-0 text-inherit'
    : 'flex items-center gap-[8px] border-0 bg-transparent p-0 text-inherit';
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
        className={className}
        disabled={disabled}
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
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {content}
    </div>
  );
}
