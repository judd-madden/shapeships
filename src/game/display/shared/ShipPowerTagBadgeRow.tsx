import type { ShipPowerTagLabel } from '../../data/ShipPowerTags';

interface ShipPowerTagBadgeRowProps {
  labels: readonly ShipPowerTagLabel[];
}

export function ShipPowerTagBadgeRow({ labels }: ShipPowerTagBadgeRowProps) {
  if (labels.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-[4px]">
      {labels.map((label) => (
        <span
          key={label}
          className="whitespace-nowrap rounded-[4px] bg-white/15 px-[8px] py-[5px] text-[12px] font-normal uppercase leading-none text-[var(--shapeships-grey-20)]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}
