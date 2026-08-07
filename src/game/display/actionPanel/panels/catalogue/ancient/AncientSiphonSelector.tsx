import { useEffect, useState } from 'react';
import { Siphon } from '../../../../../../graphics/ancient/assets';
import {
  ANCIENT_SIPHON_DEFAULT_SELECTOR_MAX_SPEND,
  ANCIENT_SIPHON_MINIMUM_SPEND,
  calculateAncientSiphonEffect,
} from '../../../../../data/ancientSiphonRules';
import { AncientEnergyCostPips } from './AncientEnergyDisplay';

interface AncientSiphonSelectorProps {
  maxSpend: number;
  availableWidth: number;
  x: number;
  horizontalScrollOwner?: 'self' | 'ancestor';
  onSelect: (lockedAmount: number) => void;
  onHoveredSpendChange: (hoveredSpend: number | null) => void;
}

export function AncientSiphonSelector({
  maxSpend,
  availableWidth,
  x,
  horizontalScrollOwner = 'self',
  onSelect,
  onHoveredSpendChange,
}: AncientSiphonSelectorProps) {
  const [hoveredSpend, setHoveredSpend] = useState<number | null>(null);
  const maxDisplayedSpend = Math.max(
    ANCIENT_SIPHON_DEFAULT_SELECTOR_MAX_SPEND,
    maxSpend + 2,
  );
  const candidates = Array.from(
    { length: maxDisplayedSpend - ANCIENT_SIPHON_MINIMUM_SPEND + 1 },
    (_, index) => index + ANCIENT_SIPHON_MINIMUM_SPEND
  );

  useEffect(
    () => () => onHoveredSpendChange(null),
    [onHoveredSpendChange]
  );

  useEffect(() => {
    if (hoveredSpend !== null && hoveredSpend > maxSpend) {
      setHoveredSpend(null);
      onHoveredSpendChange(null);
    }
  }, [hoveredSpend, maxSpend, onHoveredSpendChange]);

  return (
    <div
      className="absolute flex min-w-0 items-center gap-[16px]"
      style={{ left: `${x}px`, top: '75px', width: `${availableWidth}px` }}
      onMouseLeave={() => {
        setHoveredSpend(null);
        onHoveredSpendChange(null);
      }}
    >
      <div className="flex shrink-0 items-center justify-center">
        <Siphon />
      </div>

      <div
        className="flex w-[72px] shrink-0 flex-col items-end font-['Roboto'] text-right text-[18px] font-normal leading-[1.1] text-white"
      >
        <span>Energy</span>
        <span className="mt-[18px]">Healing</span>
        <span className="mt-[6px]">Damage</span>
      </div>

      <div
        className={
          horizontalScrollOwner === 'self'
            ? 'min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x'
            : 'min-w-0 flex-1'
        }
      >
        <div className="flex w-max flex-nowrap gap-[4px]">
          {candidates.map((candidate) => {
            const effectAmount = calculateAncientSiphonEffect(candidate);
            const valid = candidate <= maxSpend && effectAmount !== null;
            const cumulativelyHovered =
              hoveredSpend !== null && valid && candidate <= hoveredSpend;

            return (
              <div
                key={candidate}
                className="flex shrink-0 flex-col items-center gap-[6px]"
                style={{ opacity: valid ? 1 : 0.4 }}
              >
                <button
                  type="button"
                  disabled={!valid}
                  aria-label={
                    effectAmount === null
                      ? `Siphon spend ${candidate} is unavailable`
                      : `Spend ${candidate} green and ${candidate} red Energy for ${effectAmount} Healing and ${effectAmount} Damage`
                  }
                  className="flex shrink-0 flex-col items-center gap-[12px] rounded-[10px] bg-[var(--shapeships-grey-90)] px-[16px] py-[24px] focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_white] disabled:cursor-default"
                  style={{
                    boxShadow: cumulativelyHovered ? 'inset 0 0 0 2px white' : undefined,
                  }}
                  onMouseEnter={() => {
                    const nextHoveredSpend = valid ? candidate : null;
                    setHoveredSpend(nextHoveredSpend);
                    onHoveredSpendChange(nextHoveredSpend);
                  }}
                  onClick={() => {
                    if (valid) {
                      setHoveredSpend(null);
                      onHoveredSpendChange(null);
                      onSelect(candidate);
                    }
                  }}
                >
                  <AncientEnergyCostPips
                    rows={[
                      {
                        color: 'green',
                        count: candidate === ANCIENT_SIPHON_MINIMUM_SPEND
                          ? ANCIENT_SIPHON_MINIMUM_SPEND
                          : 1,
                      },
                      {
                        color: 'red',
                        count: candidate === ANCIENT_SIPHON_MINIMUM_SPEND
                          ? ANCIENT_SIPHON_MINIMUM_SPEND
                          : 1,
                      },
                    ]}
                  />
                  {effectAmount !== null && (
                    <div
                      className="flex flex-col items-center gap-[8px] font-['Roboto'] text-[22px] font-bold leading-none"
                    >
                      <span className="text-[var(--shapeships-pastel-green)]">{effectAmount}</span>
                      <span className="text-[var(--shapeships-pastel-red)]">{effectAmount}</span>
                    </div>
                  )}
                </button>
                <span
                  aria-hidden="true"
                  className="pointer-events-none font-['Roboto'] text-center text-[16px] font-bold leading-none text-white"
                >
                  {candidate}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
