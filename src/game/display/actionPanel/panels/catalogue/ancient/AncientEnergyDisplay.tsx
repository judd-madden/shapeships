export type AncientEnergyColor = 'green' | 'red' | 'cyan';

export interface AncientEnergyCostRow {
  color: AncientEnergyColor;
  count: number;
}

const ENERGY_COLOR_CSS: Record<AncientEnergyColor, string> = {
  green: 'var(--shapeships-green)',
  red: 'var(--shapeships-red)',
  cyan: 'var(--shapeships-cyan)',
};

const ENERGY_FIXTURES = [
  { color: 'green', available: 5, total: 8 },
  { color: 'red', available: 5, total: 8 },
  { color: 'cyan', available: 5, total: 8 },
] as const satisfies ReadonlyArray<{
  color: AncientEnergyColor;
  available: number;
  total: number;
}>;

function EnergyPip({ color, used = false }: { color: AncientEnergyColor; used?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="size-[14px] shrink-0 rounded-full"
      style={{
        backgroundColor: ENERGY_COLOR_CSS[color],
        opacity: used ? 0.4 : 1,
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

export function AncientEnergyDisplay() {
  return (
    <div className="flex items-start gap-[24px]">
      {ENERGY_FIXTURES.map((fixture) => (
        <div key={fixture.color} className="flex items-center gap-[8px]">
          <span
            className="shrink-0 text-[22px] font-bold leading-[normal]"
            style={{
              color: ENERGY_COLOR_CSS[fixture.color],
              fontVariationSettings: "'wdth' 100",
            }}
          >
            {fixture.available}
          </span>
          <div
            className="flex w-fit max-w-[150px] flex-wrap justify-left gap-x-[4px] gap-y-[6px]"
          >
            {Array.from({ length: fixture.total }, (_, index) => (
              <EnergyPip
                key={index}
                color={fixture.color}
                used={index >= fixture.available}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
