import type { AncientCatalogueEnergyDisplay } from '../../../../../client/gameSession/types';

export type AncientEnergyColor = 'green' | 'red' | 'cyan';

export interface AncientEnergyCostRow {
  color: AncientEnergyColor;
  count: number;
}

export interface AncientEnergySpendPreview {
  green: number;
  red: number;
  blue: number;
}

const ENERGY_COLOR_CSS: Record<AncientEnergyColor, string> = {
  green: 'var(--shapeships-green)',
  red: 'var(--shapeships-red)',
  cyan: 'var(--shapeships-cyan)',
};

function EnergyPip({
  color,
  dulled = false,
  outlined = false,
}: {
  color: AncientEnergyColor;
  dulled?: boolean;
  outlined?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className="size-[14px] shrink-0 rounded-full"
      style={{
        backgroundColor: ENERGY_COLOR_CSS[color],
        opacity: dulled ? 0.4 : 1,
        boxShadow: outlined
           ? 'inset 0 0 0 2px white'
           : undefined,
      }}
    />
  );
}

export function AncientEnergyCostPips({ rows }: { rows: readonly AncientEnergyCostRow[] }) {
  return (
    <div className="flex shrink-0 flex-col gap-[6px]">
      {rows.map((row) => (
        <div key={row.color} className="flex items-center gap-[4px]">
          {Array.from({ length: row.count }, (_, index) => (
            <EnergyPip key={index} color={row.color} />
          ))}
        </div>
      ))}
    </div>
  );
}

function normalizeEnergyDisplayAmount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function AncientEnergyDisplay({
  mode,
  pool,
  capacity,
  spendPreview,
}: AncientCatalogueEnergyDisplay & {
  spendPreview?: AncientEnergySpendPreview | null;
}) {
  const rows = [
    {
      color: 'green' as const,
      amount: normalizeEnergyDisplayAmount(pool.green),
      capacity: normalizeEnergyDisplayAmount(capacity.green),
      requestedSpend: normalizeEnergyDisplayAmount(spendPreview?.green ?? 0),
    },
    {
      color: 'red' as const,
      amount: normalizeEnergyDisplayAmount(pool.red),
      capacity: normalizeEnergyDisplayAmount(capacity.red),
      requestedSpend: normalizeEnergyDisplayAmount(spendPreview?.red ?? 0),
    },
    {
      color: 'cyan' as const,
      amount: normalizeEnergyDisplayAmount(pool.blue),
      capacity: normalizeEnergyDisplayAmount(capacity.blue),
      requestedSpend: normalizeEnergyDisplayAmount(spendPreview?.blue ?? 0),
    },
  ];

  return (
    <div className="flex items-start gap-[24px]">
      {rows.map((row) => {
        const filledCount = Math.min(row.amount, row.capacity);
        const outlinedCount =
          mode === 'active'
            ? Math.min(row.requestedSpend, filledCount)
            : 0;

        return (
          <div key={row.color} className="flex items-center gap-[8px]">
            <span
              className="shrink-0 text-[22px] font-bold leading-[normal]"
              style={{
                color: ENERGY_COLOR_CSS[row.color],
              }}
            >
              {row.amount}
            </span>
            <div
              className="flex w-fit max-w-[150px] flex-wrap justify-left gap-x-[4px] gap-y-[6px]"
            >
              {Array.from({ length: Math.max(1, row.capacity) }, (_, index) => (
                <EnergyPip
                  key={index}
                  color={row.color}
                  dulled={mode !== 'active' || index >= filledCount}
                  outlined={
                    index >= filledCount - outlinedCount &&
                    index < filledCount
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
