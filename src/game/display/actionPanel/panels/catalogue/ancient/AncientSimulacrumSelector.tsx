import type { ComponentType } from 'react';
import { getShipDefinitionUI } from '../../../../../data/ShipDefinitionsUI';
import { AncientSolarPowerSlot } from './AncientSolarPowerSlot';

type SimulacrumSelectorLayout = 'standard' | 'long';

interface AncientSimulacrumSelectorProps {
  graphic: ComponentType<{ className?: string }>;
  blueAvailable: number;
  layout: SimulacrumSelectorLayout;
}

const SIMULACRUM_SELECTOR_LAYOUT: Record<
  SimulacrumSelectorLayout,
  {
    x: number;
    y: number;
    gap: number;
    rulesWidth: number;
    rulesFontSize: number;
  }
> = {
  standard: {
    x: 426,
    y: 70,
    gap: 30,
    rulesWidth: 307,
    rulesFontSize: 14,
  },
  long: {
    x: 466,
    y: 70,
    gap: 45,
    rulesWidth: 353,
    rulesFontSize: 16,
  },
};

const FALLBACK_SIMULACRUM_RULES = [
  'Each ship may only be targeted ONCE per turn.',
  'Ships with charges are copied as they are at the START of this battle phase.',
  "Copied ships CAN be upgraded via the opponent's species tab.",
] as const;

function splitSimulacrumRules(extraRules: string | undefined): string[] {
  const source = extraRules?.trim();
  if (!source) {
    return [...FALLBACK_SIMULACRUM_RULES];
  }

  return (source.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [source])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

const SIMULACRUM_RULE_PARAGRAPHS = splitSimulacrumRules(
  getShipDefinitionUI('SSIM')?.extraRules
);

export function AncientSimulacrumSelector({
  graphic,
  blueAvailable,
  layout,
}: AncientSimulacrumSelectorProps) {
  const selectorLayout = SIMULACRUM_SELECTOR_LAYOUT[layout];

  return (
    <div
      className="absolute flex items-center"
      style={{
        left: `${selectorLayout.x}px`,
        top: `${selectorLayout.y}px`,
        gap: `${selectorLayout.gap}px`,
      }}
    >
      <div className="shrink-0">
        <AncientSolarPowerSlot
          graphic={graphic}
          costRows={[{ color: 'cyan', count: 2 }]}
          showPlus
        />
      </div>

      <div className="flex w-[284px] shrink-0 flex-col gap-[16px] text-white">
        <div className="flex items-baseline gap-[24px] text-[18px] font-bold leading-normal">
          <span>Simulacrum</span>
          <span className="text-[var(--shapeships-cyan)]">
            {blueAvailable} blue available
          </span>
        </div>
        <p className="text-[18px] font-normal leading-[1.2]">
          Select a basic enemy ship on the battlefield to copy, up to the value of blue energy
          available.
        </p>
      </div>

      <div
        className="flex shrink-0 flex-col gap-[8px] font-normal leading-[1.2] text-[var(--shapeships-grey-50)]"
        style={{
          width: `${selectorLayout.rulesWidth}px`,
          fontSize: `${selectorLayout.rulesFontSize}px`,
        }}
      >
        {SIMULACRUM_RULE_PARAGRAPHS.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}
