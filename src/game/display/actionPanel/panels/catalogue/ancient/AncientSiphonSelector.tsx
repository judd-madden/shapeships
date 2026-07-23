import { useState } from 'react';
import { Siphon } from '../../../../../../graphics/ancient/assets';
import { AncientEnergyCostPips } from './AncientEnergyDisplay';

interface AncientSiphonSelectorProps {
  maxSpend: number;
  availableWidth: number;
  onSelect: (lockedAmount: number) => void;
}

export function AncientSiphonSelector({
  maxSpend,
  availableWidth,
  onSelect,
}: AncientSiphonSelectorProps) {
  const [hoveredSpend, setHoveredSpend] = useState<number | null>(null);
  const maxDisplayedSpend = Math.max(13, maxSpend + 2);
  const candidates = Array.from(
    { length: maxDisplayedSpend - 1 },
    (_, index) => index + 2
  );

  return (
    <div
      className="absolute flex min-w-0 items-center gap-[16px]"
      style={{ left: '450px', top: '75px', width: `${availableWidth}px` }}
      onMouseLeave={() => setHoveredSpend(null)}
    >
      <div className="flex shrink-0 items-center justify-center">
        <Siphon />
      </div>

      <div
        className="flex w-[72px] shrink-0 flex-col items-end font-['Roboto'] text-right text-[18px] font-normal leading-[1.1] text-white"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        <span>Energy</span>
        <span className="mt-[18px]">Healing</span>
        <span className="mt-[6px]">Damage</span>
      </div>

      <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x">
        <div className="flex w-max flex-nowrap gap-[4px]">
          {candidates.map((candidate) => {
            const valid = candidate <= maxSpend;
            const effectAmount = candidate * (candidate + 1) / 2;
            const cumulativelyHovered =
              hoveredSpend !== null && valid && candidate <= hoveredSpend;

            return (
              <button
                key={candidate}
                type="button"
                disabled={!valid}
                aria-label={`Spend ${candidate} green and ${candidate} red Energy for ${effectAmount} Healing and ${effectAmount} Damage`}
                className="flex shrink-0 flex-col items-center gap-[12px] rounded-[10px] bg-[var(--shapeships-grey-90)] px-[16px] py-[24px] focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_white] disabled:cursor-default"
                style={{
                  opacity: valid ? 1 : 0.4,
                  boxShadow: cumulativelyHovered ? 'inset 0 0 0 2px white' : undefined,
                }}
                onMouseEnter={() => setHoveredSpend(valid ? candidate : null)}
                onClick={() => {
                  if (valid) onSelect(candidate);
                }}
              >
                <AncientEnergyCostPips
                  rows={[
                    { color: 'green', count: candidate === 2 ? 2 : 1 },
                    { color: 'red', count: candidate === 2 ? 2 : 1 },
                  ]}
                />
                <div
                  className="flex flex-col items-center gap-[8px] font-['Roboto'] text-[22px] font-bold leading-none"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  <span className="text-[var(--shapeships-pastel-green)]">{effectAmount}</span>
                  <span className="text-[var(--shapeships-pastel-red)]">{effectAmount}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
