import type { ShipPowerTag } from '../types/ShipTypes.core.ts';

export type ShipPowerTagLabel = 'MAKES SHIPS' | 'TARGETS SHIPS';

export interface ShipPowerTagSource {
  readonly tags?: readonly ShipPowerTag[];
}

const SHIP_POWER_TAG_PRESENTATION: readonly {
  readonly tag: ShipPowerTag;
  readonly label: ShipPowerTagLabel;
}[] = [
  { tag: 'makes_ships', label: 'MAKES SHIPS' },
  { tag: 'targets_ships', label: 'TARGETS SHIPS' },
];

/**
 * Aggregate raw per-power metadata into presentation-only ship tag labels.
 * Raw power indexes and activation timing are intentionally not exposed.
 */
export function getShipPowerTagLabels(
  powers: readonly ShipPowerTagSource[],
): ShipPowerTagLabel[] {
  const presentTags = new Set(
    powers.flatMap((power) => power.tags ?? []),
  );

  return SHIP_POWER_TAG_PRESENTATION
    .filter(({ tag }) => presentTags.has(tag))
    .map(({ label }) => label);
}
